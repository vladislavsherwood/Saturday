"""Рыночные индикаторы слоёв combo7 для приложения (как c7_margin.py / c7_lib.js): по календарным дням, ffill, только прошлое.
  au_r30 — золото (GC=F) за 30 календарных дней, %; agau30 — серебро (SI=F) за 30 дней минус золото, п.п.;
  op_vvix — VVIX (^VVIX); op_dvp — перцентиль DVOL BTC (Deribit) за 365 дней (доля дней окна со значением ≤ текущего);
  k4_mvmin180 — минимум MVRV BTC за 180 дней (нет данных → 9).
Yahoo — через data.history (кэш data.py); DVOL — Deribit, публичный API без ключа (кэш cache/dvol_btc.json на 6 часов; при ошибке — прежний кэш
или cache/op_mkt.json). Использование: import mkt7; mkt7.series() → {имя: pd.Series по календарю}."""
import json
import os
import time
import urllib.request
from datetime import datetime, timezone

import pandas as pd

import data

HERE = os.path.dirname(os.path.abspath(__file__))
_S = None


def _dvol():
    path = os.path.join(data.CACHE, "dvol_btc.json")
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < 6 * 3600:
        js = json.load(open(path))
        return pd.Series(js["c"], index=pd.to_datetime(js["d"]))
    try:
        end = int(datetime.now(timezone.utc).timestamp() * 1000); start = int(datetime(2021, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
        rows, e = {}, end
        for _ in range(20):
            url = (f"https://www.deribit.com/api/v2/public/get_volatility_index_data?currency=BTC&start_timestamp={start}&end_timestamp={e}&resolution=1D")
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30) as r:
                js = json.load(r)["result"]
            for ts, o, h, l, c in js["data"]:
                rows[ts] = c
            cont = js.get("continuation")
            if not cont or not js["data"] or int(cont) <= start:
                break
            e = int(cont); time.sleep(0.3)
        today = datetime.now(timezone.utc).date()
        ks = [k for k in sorted(rows) if datetime.fromtimestamp(k / 1000, timezone.utc).date() < today]   # незакрытые сутки не берём
        out = {"d": [datetime.fromtimestamp(k / 1000, timezone.utc).strftime("%Y-%m-%d") for k in ks], "c": [rows[k] for k in ks]}
        json.dump(out, open(path + ".tmp", "w")); os.replace(path + ".tmp", path)
        return pd.Series(out["c"], index=pd.to_datetime(out["d"]))
    except Exception as ex:  # noqa: BLE001
        print("DVOL: нет свежих данных —", str(ex)[:120])
        if os.path.exists(path):
            js = json.load(open(path))
        else:
            js = json.load(open(os.path.join(HERE, "cache", "op_mkt.json")))["DVOL_BTC"]
        return pd.Series(js["c"], index=pd.to_datetime(js["d"]))


def series():
    global _S
    if _S is not None:
        return _S
    end = pd.Timestamp.utcnow().tz_localize(None).normalize() + pd.Timedelta(days=2)
    cal = pd.date_range("2009-01-01", end, freq="D")
    f = lambda s: s[~s.index.duplicated(keep="last")].sort_index().reindex(cal.union(s.index)).ffill().reindex(cal)  # noqa: E731
    y = lambda sym: data.history(sym)[0].dropna()  # noqa: E731
    au, ag = f(y("GC=F")), f(y("SI=F"))
    S = {"au_r30": (au / au.shift(30) - 1) * 100}
    S["agau30"] = (ag / ag.shift(30) - 1) * 100 - S["au_r30"]
    S["op_vvix"] = f(y("^VVIX"))
    dv = f(_dvol())
    S["op_dvp"] = dv.rolling(365, min_periods=365).apply(lambda w: (w <= w[-1]).mean(), raw=True)
    S["k4_mvmin180"] = f(data.mvrv_history()).rolling(180, min_periods=1).min().fillna(9.0)
    _S = S
    return S
