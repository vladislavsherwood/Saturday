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
               + "?range=3y&interval=1d")
        res = _get(url)["chart"]["result"][0]
        closes = res["indicators"]["quote"][0]["close"]
        meta = res["meta"]
        return {"t": res["timestamp"], "c": closes, "price": meta.get("regularMarketPrice"),
                "currency": meta.get("currency", "USD")}
    safe = "".join(ch if ch.isalnum() else "_" for ch in symbol)
    d = _cached(f"h_{safe}.json", 3600, load)
    s = pd.Series(d["c"], index=pd.to_datetime(d["t"], unit="s").normalize(), dtype=float).dropna()
    s = s[s > 0]
    s = s[~s.index.duplicated(keep="last")]
    today = pd.Timestamp(datetime.now(timezone.utc).date())
    s = s[s.index < today]                                   # сегодняшний день ещё не закрыт
    price = d["price"] or (float(s.iloc[-1]) if len(s) else None)
    return s, price, d["currency"]


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
