"""Крипта: сигналы «монета к BTC», ETH/BTC, доля стейблкоинов и торговля на страхе.

Те же правила проверки, что в quant.py: гипотезы заданы заранее, набор монет — топ-40 на январь 2018,
тест на случайность сдвигом сигнала (один и тот же сдвиг для всех монет, потому что рыночные сигналы общие).

Доля стейблкоинов — приближение USDT.D: все стейблкоины / (стейблкоины + капитализация BTC + капитализация ETH).

Данные по стейблкоинам до 2020 года неполные, поэтому этот сигнал надо смотреть в прогоне с 2020 года.

Запуск: python3 dca/quant2.py
        DCA_START=2020-07-01 python3 dca/quant2.py
"""
import json
import os
import time
import urllib.request

import numpy as np
import pandas as pd

import backtest as bt
import grid
import quant

TOL = bt.TOL
N_SHIFT = 1000
START = os.environ.get("DCA_START", "2018-03-01")   # индекс страха существует с февраля 2018
COINS = quant.UNIVERSE["Крипта: топ-2018"]
INF = 1e9

# имя: (сигнал, пороги, действия по зонам; отрицательное = продажа)
HYP = {
    "Цена/SMA200 (для сравнения)": ("sma", (0.8, 1.0, 1.4), (3, 2, 1, 0)),
    "Монета/BTC к своей SMA200": ("alt_btc", (0.8, 1.0, 1.4), (3, 2, 1, 0)),
    "ETH/BTC к своей SMA200": ("eth_btc", (0.8, 1.0, 1.4), (3, 2, 1, 0)),
    "Доля стейблов к своей SMA200": ("stable", (0.8, 1.0, 1.2), (0, 1, 2, 3)),
    "Страх: только покупки": ("fng", (25, 45, 75), (3, 2, 1, 0)),
    "Страх: покупки + продажа ×1 на жадности": ("fng", (25, 45, 75), (3, 2, 1, -1)),
    "Страх: покупки + продажа ×3 на жадности": ("fng", (25, 45, 75), (3, 2, 1, -3)),
    "Страх: покупка только на страхе, продажа на жадности": ("fng", (25, 45, 75), (3, 1, 0, -3)),
}


def cached(name, loader):
    path = os.path.join(bt.CACHE, name)
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < 20 * 3600:
        return pd.read_csv(path, index_col=0, parse_dates=True).iloc[:, 0]
    s = loader()
    s.to_frame().to_csv(path)
    return s


def _json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def stable_supply():
    d = _json("https://stablecoins.llama.fi/stablecoincharts/all")
    s = pd.Series({pd.to_datetime(int(x["date"]), unit="s").normalize(): float(x["totalCirculatingUSD"]["peggedUSD"])
                   for x in d}, name="stables")
    return s.sort_index()


def btc_cap():
    d = _json("https://api.blockchain.info/charts/market-cap?timespan=all&format=json&sampled=false")
    s = pd.Series({pd.to_datetime(x["x"], unit="s").normalize(): float(x["y"]) for x in d["values"]}, name="btc_cap")
    return s[~s.index.duplicated(keep="last")].sort_index()


def ratio_to_sma(s):
    return s / s.rolling(200, min_periods=bt.WARMUP).mean()


def main():
    btc = bt.yahoo("BTC-USD")["close"]
    eth = bt.yahoo("ETH-USD")["close"]
    stables = cached("stables.csv", stable_supply).reindex(btc.index, method="ffill")
    cap = cached("btc_cap.csv", btc_cap).reindex(btc.index, method="ffill")
    eth_cap = eth.reindex(btc.index) * 110e6                       # предложение ETH ~110 млн, грубо
    dom = stables / (stables + cap + eth_cap)
    market = pd.DataFrame({
        "eth_btc": ratio_to_sma(eth.reindex(btc.index) / btc),
        "stable": ratio_to_sma(dom),
        "fng": bt.fear_greed().reindex(btc.index, method="ffill"),
    })
    print(f"доля стейблов (приближение): сейчас {dom.iloc[-1] * 100:.1f}%, "
          f"мин {dom[START:].min() * 100:.1f}%, макс {dom[START:].max() * 100:.1f}%")

    fracs = np.random.default_rng(11).uniform(0.1, 0.9, N_SHIFT)
    dca = np.ones(5, dtype=np.int8)
    rows, perm = [], {}
    for sym in COINS:
        close = bt.yahoo(sym)["close"]
        sig = pd.DataFrame({"sma": ratio_to_sma(close),
                            "alt_btc": ratio_to_sma(close / btc.reindex(close.index))})
        sig = sig.join(market.reindex(close.index)).shift(1)       # сигнал по вчерашнему закрытию
        close = close[close.index >= START]
        if len(close) < 500:
            continue
        sig = sig.loc[close.index]
        price = close.values
        years = (close.index[-1] - close.index[0]).days / 365.25
        z0 = np.zeros(len(price), dtype=np.int8)
        cf = np.empty((len(price) - 1) // grid.BUCKET + 2)
        b_irr, b_profit, b_inv, _ = grid._sim(price, z0, dca, years, cf)
        floor = b_profit - 0.10 * abs(b_profit)
        offs = (fracs * len(price)).astype(np.int64)
        for h, (key, th, act) in HYP.items():
            if key == "alt_btc" and sym == "BTC-USD":
                continue
            a = np.array(list(act) + [1], dtype=np.int8)
            x = sig[key].values
            z = np.searchsorted(np.array(th, dtype=float), x, side="right").astype(np.int8)
            z[np.isnan(x)] = 4
            irr, profit, inv, nsell = grid._sim(price, z, a, years, cf)
            e = irr - b_irr
            perm[(sym, h)] = quant.shifts(price, z, a, years, b_irr, offs)
            verdict = "хуже" if (e < -TOL or (nsell > 0 and profit < floor)) else ("лучше" if e > TOL else "наравне")
            rows.append({"ticker": sym, "hypothesis": h, "dca_irr": b_irr, "edge": e, "verdict": verdict,
                         "money": inv / b_inv, "profit": profit, "dca_profit": b_profit,
                         "sells_per_year": nsell / years})
    df = pd.DataFrame(rows)
    tag = "" if START == "2018-03-01" else "_" + START[:4]
    df.to_csv(os.path.join(bt.OUT, f"quant2_tickers{tag}.csv"), index=False)

    out = []
    for h, g in df.groupby("hypothesis", sort=False):
        P = np.array([perm[(s, h)] for s in g.ticker])
        actual = g.edge.median()
        p = (1 + (np.median(P, axis=0) >= actual).sum()) / (N_SHIFT + 1)
        out.append({
            "гипотеза": h, "монет": len(g), "медиана_пп": round(actual, 1),
            "лучше": int((g.verdict == "лучше").sum()), "наравне": int((g.verdict == "наравне").sum()),
            "хуже": int((g.verdict == "хуже").sum()),
            "p_случайность": round(p, 3),
            "деньги_к_DCA": round(g.money.median(), 2),
            "прибыль_всего_$": round(g.profit.sum()), "прибыль_DCA_$": round(g.dca_profit.sum()),
            "продаж_в_год": round(g.sells_per_year.median()),
        })
    summ = pd.DataFrame(out)
    summ.to_csv(os.path.join(bt.OUT, f"quant2_summary{tag}.csv"), index=False)
    pd.set_option("display.width", 250, "display.max_colwidth", 60)
    print(summ.to_string(index=False))
    big = df[df.ticker.isin(["BTC-USD", "ETH-USD", "BNB-USD", "DOGE-USD", "XRP-USD"])]
    print()
    print(big.pivot(index="hypothesis", columns="ticker", values="edge").reindex(list(HYP)).round(1).to_string())
    print()
    print((big.assign(r=big.profit / big.dca_profit).pivot(index="hypothesis", columns="ticker", values="r")
           .reindex(list(HYP)).round(2)).to_string())


if __name__ == "__main__":
    main()
