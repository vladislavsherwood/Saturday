"""Проверка настоящих доминаций (USDT.D, BTC.D) как сигналов для покупки альткоинов и BTC.

Часть 1 — деньги: лестницы покупок против обычного DCA (годовая доходность, тест на случайность общим сдвигом).
Часть 2 — зоны: вероятность разворота (+30% раньше, чем -20%) в днях, когда условие выполнено.

Запуск: python3 dca/domtest.py
"""
import os

import numpy as np
import pandas as pd

import backtest as bt
import dominance
import grid
import quant
import zones

COINS = quant.UNIVERSE["Крипта: топ-2018"] + ["SOL-USD"]
N_SHIFT = 1000
TOL = bt.TOL


def signals():
    d = dominance.load()
    u, b = d["usdt_d"], d["btc_d"]
    ur = u / u.rolling(200).mean()
    br = b / b.rolling(200).mean()
    s = pd.DataFrame({
        "usdt_ratio": ur, "btc_ratio": br,
        "usdt_turn": ((ur.rolling(30).max() >= 1.2) & (u < u.rolling(20).mean())).astype(float),
        "usdt_fall30": (u < u.shift(30)).astype(float),
        "usdt_spike": (u / u.shift(14) - 1 >= 0.10).astype(float),
    })
    s.loc[ur.isna(), ["usdt_turn", "usdt_fall30", "usdt_spike"]] = np.nan
    return s


# имя: (столбец, пороги, множители по зонам)
HYP = {
    "USDT.D высокая → больше": ("usdt_ratio", (0.8, 1.0, 1.2), (0, 1, 2, 3)),
    "USDT.D низкая → больше": ("usdt_ratio", (0.8, 1.0, 1.2), (3, 2, 1, 0)),
    "USDT.D развернулась вниз после пика → ×3": ("usdt_turn", (0.5, 9, 9), (1, 3, 3, 3)),
    "USDT.D падает 30 дней → ×2": ("usdt_fall30", (0.5, 9, 9), (1, 2, 2, 2)),
    "USDT.D растёт 30 дней → ×2": ("usdt_fall30", (0.5, 9, 9), (2, 1, 1, 1)),
    "Всплеск USDT.D на 10% за 2 недели → ×3": ("usdt_spike", (0.5, 9, 9), (1, 3, 3, 3)),
    "BTC.D высокая → больше": ("btc_ratio", (0.9, 1.0, 1.1), (0, 1, 2, 3)),
    "BTC.D низкая → больше": ("btc_ratio", (0.9, 1.0, 1.1), (3, 2, 1, 0)),
}


def money(sig, start):
    fr = np.random.default_rng(21).uniform(0.1, 0.9, N_SHIFT)
    rows, perm = [], {}
    for sym in COINS:
        close = bt.yahoo(sym)["close"]
        close = close[close.index >= start]
        if len(close) < 500:
            continue
        s = sig.shift(1).reindex(close.index)
        price = close.values
        years = (close.index[-1] - close.index[0]).days / 365.25
        cf = np.empty((len(price) - 1) // grid.BUCKET + 2)
        b_irr, b_profit, b_inv, _ = grid._sim(price, np.zeros(len(price), dtype=np.int8), np.ones(5, dtype=np.int8), years, cf)
        offs = (fr * len(price)).astype(np.int64)
        for h, (col, th, act) in HYP.items():
            x = s[col].values
            z = np.searchsorted(np.array(th, dtype=float), x, side="right").astype(np.int8)
            z[np.isnan(x)] = 4
            a = np.array(list(act) + [1], dtype=np.int8)
            irr, profit, inv, _ = grid._sim(price, z, a, years, cf)
            perm[(sym, h)] = quant.shifts(price, z, a, years, b_irr, offs)
            rows.append({"sym": sym, "h": h, "edge": irr - b_irr, "money": inv / b_inv, "profit": profit, "dca": b_profit})
    df = pd.DataFrame(rows)
    out = []
    for h, g in df.groupby("h", sort=False):
        P = np.median(np.array([perm[(s, h)] for s in g.sym]), axis=0)
        out.append({"гипотеза": h, "к DCA, п.п.": round(g.edge.median(), 1), "лучше": int((g.edge > TOL).sum()),
                    "хуже": int((g.edge < -TOL).sum()), "p": round((1 + (P >= g.edge.median()).sum()) / (N_SHIFT + 1), 3),
                    "деньги к DCA": round(g.money.median(), 2), "прибыль к DCA": round(g.profit.sum() / g.dca.sum(), 2),
                    "BTC": round(float(g[g.sym == "BTC-USD"].edge.iloc[0]), 1),
                    "ETH": round(float(g[g.sym == "ETH-USD"].edge.iloc[0]), 1)})
    return pd.DataFrame(out)


def zone_stats(sig, start):
    frames = []
    for sym in COINS:
        close = bt.yahoo(sym)["close"]
        win, mae = zones.outcomes(close.values)
        f = sig.reindex(close.index).copy()
        f["win"], f["fwd90"], f["sym"] = win, (close.shift(-90) / close - 1).values, sym
        f["date"] = close.index
        f = f.iloc[:-zones.HORIZON]
        frames.append(f[f.index >= start])
    d = pd.concat(frames, ignore_index=True).dropna(subset=["usdt_ratio"])
    mid = d["date"].sort_values().iloc[len(d) // 2]
    h1 = (d["date"] < mid).values
    major = d["sym"].isin(zones.MAJORS).values
    w = d["win"].values
    conds = {
        "USDT.D выше своей SMA200 на 20%": d.usdt_ratio >= 1.2,
        "USDT.D ниже своей SMA200 на 20%": d.usdt_ratio <= 0.8,
        "USDT.D развернулась вниз после пика": d.usdt_turn > 0.5,
        "USDT.D падает 30 дней": d.usdt_fall30 > 0.5,
        "USDT.D растёт 30 дней": d.usdt_fall30 < 0.5,
        "Всплеск USDT.D на 10% за 2 недели": d.usdt_spike > 0.5,
        "BTC.D выше своей SMA200 на 10%": d.btc_ratio >= 1.1,
        "BTC.D ниже своей SMA200 на 10%": d.btc_ratio <= 0.9,
        "USDT.D падает + BTC.D падает": (d.usdt_fall30 > 0.5) & (d.btc_ratio < 1.0),
        "USDT.D развернулась вниз + BTC.D высокая": (d.usdt_turn > 0.5) & (d.btc_ratio >= 1.0),
    }
    rows = []
    for name, m in conds.items():
        m = m.values
        rows.append({"условие": name, "дней %": round(m.mean() * 100, 1), "разворот %": round(w[m].mean() * 100),
                     "1-я пол., раз": round(w[m & h1].mean() / w[h1].mean(), 2) if (m & h1).sum() > 200 else np.nan,
                     "2-я пол., раз": round(w[m & ~h1].mean() / w[~h1].mean(), 2) if (m & ~h1).sum() > 200 else np.nan,
                     "рост 90 дн %": round(np.nanmedian(d.fwd90.values[m]) * 100),
                     "крупные: разворот %": round(w[m & major].mean() * 100),
                     "крупные: рост 90 дн %": round(np.nanmedian(d.fwd90.values[m & major]) * 100)})
    print(f"обычный день: разворот {w.mean() * 100:.0f}%, рост за 90 дн {np.nanmedian(d.fwd90) * 100:.0f}%; "
          f"крупные: {w[major].mean() * 100:.0f}% и {np.nanmedian(d.fwd90.values[major]) * 100:.0f}%; граница половин {mid.date()}")
    return pd.DataFrame(rows)


def main():
    sig = signals()
    pd.set_option("display.width", 260, "display.max_colwidth", 60)
    res = []
    for start in ("2018-03-01", "2021-01-01"):
        t = money(sig, start)
        t.insert(0, "с", start[:4])
        res.append(t)
        print(f"\nДеньги, с {start[:4]} года:")
        print(t.drop(columns="с").to_string(index=False))
    pd.concat(res).to_csv(os.path.join(bt.OUT, "domtest_money.csv"), index=False)
    print("\nЗоны, с 2018 года:")
    z = zone_stats(sig, "2018-03-01")
    z.to_csv(os.path.join(bt.OUT, "domtest_zones.csv"), index=False)
    print(z.to_string(index=False))


if __name__ == "__main__":
    main()
