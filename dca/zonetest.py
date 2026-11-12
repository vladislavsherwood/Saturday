"""Бэктест зоны «альты слабы к биткоину» в деньгах.

Зона: рыночный индикатор в нижней пятой части своей истории (по вчерашнему закрытию).
- альты к BTC = медиана по монетам отношения (монета/BTC) к своей SMA200;
- ETH/BTC к своей SMA200.

Две модели:
1. «Из сбережений»: в зоне покупка ×3, вне зоны ×1 (или ×0). Сравнение по годовой доходности и по долларам.
2. «Резерв»: $10 в день приходят в резерв; вне зоны тратится малая доля резерва, в зоне — большая.
   Деньги на входе те же, что у DCA; сравнение по итогу (позиция + резерв).

Запуск: python3 dca/zonetest.py
"""
import os

import numpy as np
import pandas as pd

import backtest as bt
import cashgrid
import grid
import quant

START = "2019-06-01"
COINS = quant.UNIVERSE["Крипта: топ-2018"] + ["SOL-USD"]
LO = 0.20
N_SHIFT = 1000


def pct(s):
    return s.expanding(min_periods=200).rank(pct=True)


def main():
    btc = bt.yahoo("BTC-USD")["close"]
    eth = bt.yahoo("ETH-USD")["close"].reindex(btc.index)
    closes = {s: bt.yahoo(s)["close"] for s in COINS}
    ratios = pd.DataFrame({s: (lambda r: r / r.rolling(200).mean())(c / btc.reindex(c.index))
                           for s, c in closes.items() if s != "BTC-USD"})
    eb = eth / btc
    alt = (pct(ratios.median(axis=1)) <= LO)
    ethz = (pct(eb / eb.rolling(200).mean()) <= LO)
    zones = {"альты к BTC низко": alt, "ETH/BTC низко": ethz, "любое из двух": alt | ethz}
    for k, z in zones.items():
        zz = z[START:]
        print(f"{k}: {zz.mean() * 100:.0f}% дней, эпизодов {(zz & ~zz.shift(1, fill_value=False)).sum()}")

    # модель 1: множители [вне зоны, в зоне]; модель 2: доли резерва [вне зоны, в зоне]
    savings = {"×1 вне зоны, ×3 в зоне": (1, 3), "×1 вне зоны, ×2 в зоне": (1, 2), "покупка только в зоне ×3": (0, 3)}
    reserve = {"2% резерва вне зоны, 25% в зоне": (0.02, 0.25), "5% вне зоны, 50% в зоне": (0.05, 0.50),
               "1% вне зоны, 10% в зоне": (0.01, 0.10), "ждать вне зоны, 25% в зоне": (0.0, 0.25)}
    fr = np.random.default_rng(3).uniform(0.1, 0.9, N_SHIFT)
    rows, perm = [], {}
    for sym, close in closes.items():
        close = close[close.index >= START]
        if len(close) < 500:
            continue
        price = close.values
        n = len(price)
        years = (close.index[-1] - close.index[0]).days / 365.25
        mid = n // 2
        offs = (fr * n).astype(np.int64)
        z0 = np.zeros(n, dtype=np.int8)
        cf = np.empty((n - 1) // grid.BUCKET + 2)
        b_irr, b_profit, b_inv, _ = grid._sim(price, z0, np.ones(2, dtype=np.int8), years, cf)
        b_w = cashgrid.sim(price, z0, np.ones(2))[0]
        for zname, zser in zones.items():
            z = zser.shift(1).reindex(close.index).fillna(False).values.astype(np.int8)
            for vname, act in savings.items():
                a = np.array(act, dtype=np.int8)
                irr, profit, inv, _ = grid._sim(price, z, a, years, cf)
                key = ("сбережения", zname, vname)
                perm[key + (sym,)] = quant.shifts(price, z, a, years, b_irr, offs)
                rows.append({"model": key[0], "zone": zname, "variant": vname, "sym": sym, "value": irr - b_irr,
                             "money": inv / b_inv, "profit": profit, "dca_profit": b_profit,
                             "h1": np.nan, "h2": np.nan})
            for vname, act in reserve.items():
                a = np.array(act, dtype=float)
                w, cash_share = cashgrid.sim(price, z, a)
                h = []
                for sl in (slice(0, mid), slice(mid, n)):
                    bb = cashgrid.sim(price[sl], z0[sl], np.ones(2))[0]
                    h.append((cashgrid.sim(price[sl], z[sl], a)[0] / bb - 1) * 100)
                key = ("резерв", zname, vname)
                perm[key + (sym,)] = cashgrid.shift_test(price, z, a, b_w, offs)
                rows.append({"model": key[0], "zone": zname, "variant": vname, "sym": sym, "value": (w / b_w - 1) * 100,
                             "money": 1.0, "profit": w - n * bt.UNIT, "dca_profit": b_w - n * bt.UNIT,
                             "h1": h[0], "h2": h[1], "cash": cash_share * 100})
    df = pd.DataFrame(rows)
    df.to_csv(os.path.join(bt.OUT, "zonetest_coins.csv"), index=False)

    out = []
    for (model, zname, vname), g in df.groupby(["model", "zone", "variant"], sort=False):
        P = np.array([perm[(model, zname, vname, s)] for s in g.sym])
        actual = g.value.median()
        pm = np.median(P, axis=0)
        tol = 0.5 if model == "сбережения" else 2.0
        r = {"модель": model, "зона": zname, "вариант": vname, "монет": len(g),
             "медиана": round(actual, 1), "лучше": int((g.value > tol).sum()), "хуже": int((g.value < -tol).sum()),
             "случайный сдвиг": round(pm.mean(), 1), "p": round((1 + (pm >= actual).sum()) / (N_SHIFT + 1), 3),
             "деньги к DCA": round(g.money.median(), 2),
             "прибыль $": round(g.profit.sum()), "прибыль DCA $": round(g.dca_profit.sum()),
             "BTC": round(float(g[g.sym == "BTC-USD"].value.iloc[0]), 1),
             "ETH": round(float(g[g.sym == "ETH-USD"].value.iloc[0]), 1)}
        if model == "резерв":
            r.update({"1-я пол.": round(g.h1.median(), 1), "2-я пол.": round(g.h2.median(), 1),
                      "резерв в среднем %": round(g.cash.median())})
        out.append(r)
    summ = pd.DataFrame(out)
    summ.to_csv(os.path.join(bt.OUT, "zonetest_summary.csv"), index=False)
    pd.set_option("display.width", 300, "display.max_colwidth", 40)
    s1 = summ[summ["модель"] == "сбережения"].drop(columns=["модель", "1-я пол.", "2-я пол.", "резерв в среднем %"])
    print("\nМодель 1, из сбережений (медиана = п.п. годовых к DCA):")
    print(s1.to_string(index=False))
    s2 = summ[summ["модель"] == "резерв"].drop(columns=["модель", "деньги к DCA"])
    print("\nМодель 2, резерв (медиана = итог к DCA, %):")
    print(s2.to_string(index=False))


if __name__ == "__main__":
    main()
