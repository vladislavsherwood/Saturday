"""Загрузка рыночных данных с кэшем на диске."""
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

import pandas as pd

CACHE = os.environ.get("DCA_CACHE", os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache"))
UA = {"User-Agent": "Mozilla/5.0"}


def _get(url, timeout=30):
    req = urllib.request.Request(url, headers=UA)
    last = None
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except OSError as e:
            last = e
            time.sleep(1 + attempt)
    raise last


def _cached(name, ttl, loader):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, name)
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < ttl:
        with open(path) as f:
            return json.load(f)
    try:
        value = loader()
    except Exception:
        if os.path.exists(path):          # источник недоступен — отдаём старое
            with open(path) as f:
                return json.load(f)
        raise
    with open(path + ".tmp", "w") as f:
        json.dump(value, f)
    os.replace(path + ".tmp", path)
    return value


def history(symbol):
    """Дневные закрытия (только завершённые дни) и последняя цена.

    Возвращает (Series закрытий, последняя цена, валюта)."""
    def load():
        url = ("https://query1.finance.yahoo.com/v8/finance/chart/" + urllib.parse.quote(symbol)
               + "?period1=1230768000&period2=9999999999&interval=1d")
        res = _get(url)["chart"]["result"][0]
        q = res["indicators"]["quote"][0]
        meta = res["meta"]
        return {"t": res["timestamp"], "c": q["close"], "o": q.get("open"), "h": q.get("high"), "l": q.get("low"), "v": q.get("volume"),
                "price": meta.get("regularMarketPrice"), "currency": meta.get("currency", "USD")}
    safe = "".join(ch if ch.isalnum() else "_" for ch in symbol)
    d = _cached(f"ohlcv_{safe}.json", 3600, load)
    idx = pd.to_datetime(d["t"], unit="s").normalize()
    df = pd.DataFrame({k: pd.Series(d.get(k) or d["c"], index=idx, dtype=float) for k in ("o", "h", "l", "c")})
    df["v"] = pd.Series(d.get("v") or [0] * len(idx), index=idx, dtype=float).fillna(0)      # объём торгов за день
    df = df[df["c"] > 0]
    df = df[~df.index.duplicated(keep="last")]
    today = pd.Timestamp(datetime.now(timezone.utc).date())
    df = df[df.index < today]                                # сегодняшний день ещё не закрыт
    for k in ("o", "h", "l"):                                # дыры в свечах закрываем ценой закрытия
        df[k] = df[k].where(df[k] > 0, df["c"])
    df["h"] = df[["o", "h", "l", "c"]].max(axis=1)
    df["l"] = df[["o", "h", "l", "c"]].min(axis=1)
    _ohlc[symbol] = df
    s = df["c"]
    price = d["price"] or (float(s.iloc[-1]) if len(s) else None)
    return s, price, d["currency"]


_ohlc = {}


def ohlc(symbol):
    """Свечи по дням: open, high, low, close (после вызова history)."""
    if symbol not in _ohlc:
        history(symbol)
    return _ohlc[symbol]


def search(query):
    url = ("https://query1.finance.yahoo.com/v1/finance/search?q=" + urllib.parse.quote(query)
           + "&quotesCount=8&newsCount=0")
    out = []
    for q in _get(url).get("quotes", []):
        if not q.get("symbol"):
            continue
        out.append({"symbol": q["symbol"], "name": q.get("shortname") or q.get("longname") or q["symbol"],
                    "kind": q.get("quoteType", ""), "exchange": q.get("exchDisp") or q.get("exchange", "")})
    return out


def mvrv():
    """Последнее значение MVRV биткоина (рыночная капитализация к реализованной)."""
    def load():
        start = (datetime.now(timezone.utc) - timedelta(days=14)).strftime("%Y-%m-%d")
        url = ("https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=CapMVRVCur"
               f"&frequency=1d&start_time={start}")
        rows = _get(url)["data"]
        last = rows[-1]
        return {"date": last["time"][:10], "value": float(last["CapMVRVCur"])}
    return _cached("mvrv.json", 6 * 3600, load)


def fear_greed():
    """Индекс страха и жадности по дням (с 2018 года)."""
    def load():
        rows = _get("https://api.alternative.me/fng/?limit=0")["data"]
        return {"t": [int(r["timestamp"]) for r in rows], "v": [float(r["value"]) for r in rows]}
    d = _cached("fng.json", 6 * 3600, load)
    return pd.Series(d["v"], index=pd.to_datetime(d["t"], unit="s").normalize()).sort_index()


def mvrv_history():
    """MVRV биткоина по дням."""
    def load():
        rows, url = [], ("https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc"
                         "&metrics=CapMVRVCur&frequency=1d&page_size=10000&start_time=2011-01-01")
        while url:
            d = _get(url, timeout=60)
            rows += d["data"]
            url = d.get("next_page_url")
        return {"t": [r["time"][:10] for r in rows], "v": [float(r["CapMVRVCur"]) for r in rows]}
    d = _cached("mvrv_hist.json", 6 * 3600, load)
    return pd.Series(d["v"], index=pd.to_datetime(d["t"])).sort_index()


def usdt_dominance():
    """USDT.D по дням, в процентах (капитализация USDT / вся капитализация рынка)."""
    return dominances()["usdt"].dropna()


def dominances():
    """Доли рынка по дням, в процентах: usdt, btc, eth и остальные (всё, кроме этих трёх).

    Считается из капитализаций: монета / вся капитализация рынка."""
    base = "https://api.coinmarketcap.com/data-api/v3"

    def load():
        total = {}
        for a, b in (("2015-01-01", "2019-12-31"), ("2020-01-01", "2024-12-31"), ("2025-01-01", "2030-01-01")):
            d = _get(f"{base}/global-metrics/quotes/historical?format=chart&interval=1d&timeStart={a}&timeEnd={b}", timeout=60)
            for q in d["data"]["quotes"]:
                # источник ставит на значение метку следующей полуночи: «13 ноября 00:00» — это итог дня 12 ноября
                day = (datetime.fromisoformat(q["timestamp"][:10]) - timedelta(days=1)).strftime("%Y-%m-%d")
                total[day] = q["quote"][0]["totalMarketCap"]
        caps = {}
        this_year = datetime.now(timezone.utc).year
        for name, cid in (("btc", 1), ("eth", 1027), ("usdt", 825)):
            caps[name] = {}
            for year in range(2015, this_year + 1):          # длинный запрос источник отдаёт по неделям, годовой — по дням
                t0 = int(datetime(year, 1, 1, tzinfo=timezone.utc).timestamp())
                t1 = int(datetime(year + 1, 1, 1, tzinfo=timezone.utc).timestamp())
                u = _get(f"{base}/cryptocurrency/historical?id={cid}&convertId=2781&timeStart={t0}&timeEnd={t1}&interval=1d",
                         timeout=60)
                for q in (u.get("data") or {}).get("quotes") or []:
                    caps[name][q["timeOpen"][:10]] = q["quote"]["marketCap"]
                time.sleep(0.25)
        days = sorted(k for k in total if total[k] and k in caps["btc"])
        out = {"t": days}
        for name in caps:
            out[name] = [(caps[name].get(k) or 0) / total[k] * 100 for k in days]
        return out
    d = _cached("dominances_v3.json", 12 * 3600, load)
    df = pd.DataFrame({k: d[k] for k in ("usdt", "btc", "eth")}, index=pd.to_datetime(d["t"])).sort_index()
    df = df.where(df > 0)                                  # до появления монеты доли нет
    df["oth"] = 100 - df["btc"] - df["eth"].fillna(0) - df["usdt"].fillna(0)
    return df


def cmc_ohlc(cid):
    """Дневные свечи монеты по её номеру на CoinMarketCap — для монет, которых нет или которые переименованы на Yahoo."""
    base = "https://api.coinmarketcap.com/data-api/v3"

    def load():
        rows = {}
        for year in range(2013, datetime.now(timezone.utc).year + 1):
            t0 = int(datetime(year, 1, 1, tzinfo=timezone.utc).timestamp())
            t1 = int(datetime(year + 1, 1, 1, tzinfo=timezone.utc).timestamp())
            u = _get(f"{base}/cryptocurrency/historical?id={cid}&convertId=2781&timeStart={t0}&timeEnd={t1}&interval=1d", timeout=60)
            for q in (u.get("data") or {}).get("quotes") or []:
                x = q["quote"]
                rows[q["timeOpen"][:10]] = [x["open"], x["high"], x["low"], x["close"], x.get("volume") or 0]
            time.sleep(0.25)
        days = sorted(rows)
        return {"t": days, "v": [rows[k] for k in days]}
    d = _cached(f"cmcv_{cid}.json", 6 * 3600, load)
    df = pd.DataFrame(d["v"], index=pd.to_datetime(d["t"]), columns=["o", "h", "l", "c", "v"]).astype(float)
    df = df[df["c"] > 0]
    today = pd.Timestamp(datetime.now(timezone.utc).date())
    return df[df.index < today]
