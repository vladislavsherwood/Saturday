"""Настоящие доминации: USDT.D, BTC.D, ETH.D и остальные.

Источник — публичные данные CoinMarketCap: общая капитализация рынка, доля BTC и ETH,
капитализация USDT по дням. USDT.D = капитализация USDT / общая капитализация.

Запуск: python3 dca/dominance.py  (сохраняет dca/out/dominance.csv)
"""
import json
import os
import time
import urllib.request

import pandas as pd

import backtest as bt

BASE = "https://api.coinmarketcap.com/data-api/v3"


def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return json.load(r)
        except OSError:
            if attempt == 4:
                raise
            time.sleep(2 * (attempt + 1))


def _global():
    rows = []
    for a, b in (("2013-05-01", "2018-12-31"), ("2019-01-01", "2023-12-31"), ("2024-01-01", "2030-01-01")):
        d = _get(f"{BASE}/global-metrics/quotes/historical?format=chart&interval=1d&timeStart={a}&timeEnd={b}")
        for q in d["data"]["quotes"]:
            rows.append({"date": pd.to_datetime(q["timestamp"]).tz_localize(None).normalize(),
                         "total": q["quote"][0]["totalMarketCap"], "btc_d": q["btcDominance"], "eth_d": q["ethDominance"]})
        time.sleep(0.5)
    return pd.DataFrame(rows).drop_duplicates("date").set_index("date").sort_index()


def _usdt():
    d = _get(f"{BASE}/cryptocurrency/historical?id=825&convertId=2781&timeStart=1420070400&timeEnd=1893456000&interval=1d")
    s = {pd.to_datetime(q["timeOpen"]).tz_localize(None).normalize(): q["quote"]["marketCap"] for q in d["data"]["quotes"]}
    return pd.Series(s, name="usdt_cap").sort_index()


def load():
    """Таблица по дням: usdt_d, btc_d, eth_d, others_d (всё в процентах), total."""
    path = os.path.join(bt.CACHE, "dominance.csv")
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < 20 * 3600:
        return pd.read_csv(path, index_col=0, parse_dates=True)
    os.makedirs(bt.CACHE, exist_ok=True)
    g = _global()
    u = _usdt().reindex(g.index).ffill()
    g["usdt_d"] = u / g["total"] * 100
    g["others_d"] = 100 - g["btc_d"] - g["eth_d"] - g["usdt_d"].fillna(0)
    g = g[["usdt_d", "btc_d", "eth_d", "others_d", "total"]]
    g.to_csv(path)
    return g


if __name__ == "__main__":
    d = load()
    os.makedirs(bt.OUT, exist_ok=True)
    d.round(4).to_csv(os.path.join(bt.OUT, "dominance.csv"))
    print(f"дней: {len(d)}, с {d.index[0].date()} по {d.index[-1].date()}")
    print(d.resample("YE").mean().round(2).to_string())
    print("сейчас:", d.iloc[-1].round(2).to_dict())
