"""Хорошие зоны для покупки в крипте: отклонение цены + маркеры дна + доминации.

Цель — не точное дно, а зона, из которой разворот вероятнее обычного.
Исход для каждого дня: «разворот» = цена сначала выросла на 30%, раньше чем упала на 20% (в пределах 180 дней).
Дополнительно: рост за 90 дней и худшая просадка за 90 дней после входа.

Условия = индикатор в нижней или верхней пятой части собственной истории (20% / 80%).
Перебираются одиночные условия, пары и тройки «отклонение × маркер × доминация».
Проверка: две половины периода, доля монет, где зона лучше обычного дня, отдельно крупные монеты.

Доминации — приближения (точной истории USDT.D и BTC.D в бесплатных источниках нет):
- доля стейблов = все стейблкоины / (стейблкоины + капитализация BTC + ETH), данные с 2020 года;
- альты к BTC = медиана по монетам отношения (монета/BTC) к своей SMA200;
- ETH/BTC к своей SMA200.

Запуск: python3 dca/zones.py
"""
import itertools
import os

import numpy as np
import pandas as pd
from numba import njit

import backtest as bt
import quant
import quant2

START = "2020-07-01"
COINS = quant.UNIVERSE["Крипта: топ-2018"] + ["SOL-USD"]
MAJORS = ["BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD", "DOGE-USD"]
LO, HI = 0.20, 0.80
UP, DOWN, HORIZON = 0.30, 0.20, 180

# группа -> {имя условия: (столбец, сторона)}; сторона: lo/hi по процентилю, flag — готовый признак
DEV = {
    "цена/SMA200 низко": ("sma200", "lo"), "цена/SMA50 низко": ("sma50", "lo"),
    "падение за 30 дн": ("ret30", "lo"), "падение за 90 дн": ("ret90", "lo"),
    "глубокая просадка от год. макс.": ("dd", "hi"), "ниже полосы Боллинджера": ("bbz", "lo"),
}
MARK = {
    "RSI14 низко": ("rsi14", "lo"), "RSI недельный низко": ("rsi_w", "lo"), "MFI низко": ("mfi", "lo"),
    "волатильность высокая": ("vol30", "hi"), "всплеск объёма": ("volsurge", "hi"),
    "Fear&Greed низко": ("fng", "lo"), "RSI вышел из перепроданности": ("rsi_turn", "flag"),
    "отскок за 7 дн": ("ret7", "hi"),
}
DOM = {
    "доля стейблов высокая": ("stable", "hi"), "доля стейблов развернулась вниз": ("stable_turn", "flag"),
    "приток стейблов за 30 дн высокий": ("stable_growth", "hi"),
    "ETH/BTC низко": ("eth_btc", "lo"), "альты к BTC низко": ("alt_idx", "lo"),
    "монета к BTC низко": ("coin_btc", "lo"), "монета к BTC высоко": ("coin_btc", "hi"),
    "BTC ниже своей SMA200": ("btc_below", "flag"), "BTC выше своей SMA200": ("btc_above", "flag"),
    "BTC упал за 30 дн": ("btc_ret30", "lo"),
}


@njit(cache=True)
def outcomes(c):
    n = len(c)
    win = np.zeros(n, dtype=np.bool_)
    mae = np.full(n, np.nan)
    for i in range(n):
        lo = c[i]
        for j in range(i + 1, min(n, i + HORIZON + 1)):
            if c[j] >= c[i] * (1 + UP):
                win[i] = True
                break
            if c[j] <= c[i] * (1 - DOWN):
                break
        m = c[i]
        for j in range(i + 1, min(n, i + 91)):
            if c[j] < m:
                m = c[j]
        mae[i] = m / c[i] - 1
    return win, mae


def pct(s):
    return s.expanding(min_periods=200).rank(pct=True)


def build():
    btc = bt.yahoo("BTC-USD")["close"]
    eth = bt.yahoo("ETH-USD")["close"].reindex(btc.index)
    st = quant2.cached("stables.csv", quant2.stable_supply).reindex(btc.index, method="ffill")["2020-01-01":]
    cap = quant2.cached("btc_cap.csv", quant2.btc_cap).reindex(btc.index, method="ffill")
    dom = st / (st + cap + eth * 110e6)
    closes = {s: bt.yahoo(s) for s in COINS}
    ratios = pd.DataFrame({s: (lambda r: r / r.rolling(200).mean())(d["close"] / btc.reindex(d.index))
                           for s, d in closes.items() if s != "BTC-USD"})
    eb = eth / btc
    btc_sma = btc / btc.rolling(200).mean()
    dom_p = pct(dom)
    market = pd.DataFrame({
        "stable": dom_p,
        "stable_turn": ((dom_p.rolling(30).max() >= HI) & (dom < dom.rolling(20).mean())).astype(float),
        "stable_growth": pct(st / st.shift(30) - 1),
        "eth_btc": pct(eb / eb.rolling(200).mean()),
        "alt_idx": pct(ratios.median(axis=1)),
        "btc_below": (btc_sma < 1).astype(float),
        "btc_above": (btc_sma >= 1).astype(float),
        "btc_ret30": pct(btc / btc.shift(30) - 1),
        "fng": pct(bt.fear_greed().reindex(btc.index, method="ffill")),
    })
    frames = []
    for sym, data in closes.items():
        close, volume = data["close"], data["volume"]
        ret = close.pct_change()
        rsi = bt.rsi(close, 14)
        f = pd.DataFrame(index=close.index)
        f["sma200"] = pct(close / close.rolling(200).mean())
        f["sma50"] = pct(close / close.rolling(50).mean())
        f["ret30"] = pct(close / close.shift(30) - 1)
        f["ret90"] = pct(close / close.shift(90) - 1)
        f["ret7"] = pct(close / close.shift(7) - 1)
        f["dd"] = pct(1 - close / close.rolling(365, min_periods=180).max())
        f["bbz"] = pct((close - close.rolling(20).mean()) / close.rolling(20).std())
        f["rsi14"] = pct(rsi)
        f["rsi_w"] = pct(bt.rsi(close, 98))
        f["rsi_turn"] = ((rsi.rolling(10).min() < 30) & (rsi > 40)).astype(float)
        f["vol30"] = pct(ret.rolling(30).std())
        if (volume > 0).mean() > 0.8:
            f["volsurge"] = pct(volume.rolling(30).mean() / volume.rolling(365).mean())
            mf = close * volume
            pos = mf.where(ret > 0, 0).rolling(14).sum()
            neg = mf.where(ret < 0, 0).rolling(14).sum()
            f["mfi"] = pct(100 - 100 / (1 + pos / neg.replace(0, np.nan)))
        else:
            f["volsurge"] = np.nan
            f["mfi"] = np.nan
        f["coin_btc"] = pct(ratios[sym]) if sym in ratios else np.nan
        f = f.join(market.reindex(close.index))
        win, mae = outcomes(close.values)
        f["win"] = win
        f["mae90"] = mae
        f["fwd90"] = close.shift(-90) / close - 1
        f["sym"] = sym
        f["date"] = close.index
        n = len(f)
        f = f[(np.arange(n) < n - HORIZON) & (f.index >= START)]
        frames.append(f)
    return pd.concat(frames, ignore_index=True)


def mask(d, col, side):
    x = d[col].values
    if side == "lo":
        return x <= LO
    if side == "hi":
        return x >= HI
    return x > 0.5


def main():
    d = build()
    win = d["win"].values
    fwd = d["fwd90"].values
    mae = d["mae90"].values
    sym = d["sym"].values
    mid = d["date"].sort_values().iloc[len(d) // 2]
    h1 = (d["date"] < mid).values
    major = np.isin(sym, MAJORS)
    ym = (d["date"].dt.year * 12 + d["date"].dt.month).values
    base = win.mean()
    coin_base = pd.Series(win).groupby(sym).mean()
    print(f"период с {START}, монет {d.sym.nunique()}, дней {len(d):,}; граница половин {mid.date()}")
    print(f"обычный день: разворот (+{UP:.0%} раньше чем -{DOWN:.0%}) в {base * 100:.0f}% случаев; "
          f"1-я половина {win[h1].mean() * 100:.0f}%, 2-я {win[~h1].mean() * 100:.0f}%; крупные монеты {win[major].mean() * 100:.0f}%; "
          f"рост за 90 дн {np.nanmedian(fwd) * 100:.0f}%, худшая просадка за 90 дн {np.nanmedian(mae) * 100:.0f}%")

    conds = {}
    for grp, items in (("отклонение", DEV), ("маркер", MARK), ("доминация", DOM)):
        for name, (col, side) in items.items():
            conds[name] = (grp, mask(d, col, side))

    def ev(name, m, kind):
        n = int(m.sum())
        if n < 400:
            return None
        ep = len(set(zip(sym[m], ym[m])))
        per = pd.Series(win[m]).groupby(sym[m]).agg(["mean", "size"])
        per = per[per["size"] >= 20]
        if len(per) < 15 or ep < 60:
            return None
        l1 = win[m & h1].mean() / win[h1].mean() if (m & h1).sum() >= 100 else np.nan
        l2 = win[m & ~h1].mean() / win[~h1].mean() if (m & ~h1).sum() >= 100 else np.nan
        mm = m & major
        return {"зона": name, "тип": kind, "дней %": n / len(m) * 100, "разворот %": win[m].mean() * 100,
                "к обычному, раз": win[m].mean() / base, "1-я пол., раз": l1, "2-я пол., раз": l2,
                "монет лучше обычного %": (per["mean"] > coin_base.reindex(per.index)).mean() * 100,
                "монет": len(per), "рост 90 дн %": np.nanmedian(fwd[m]) * 100, "просадка 90 дн %": np.nanmedian(mae[m]) * 100,
                "крупные: разворот %": win[mm].mean() * 100 if mm.sum() >= 50 else np.nan,
                "крупные: рост 90 дн %": np.nanmedian(fwd[mm]) * 100 if mm.sum() >= 50 else np.nan}

    rows = []
    for name, (grp, m) in conds.items():
        r = ev(name, m, grp)
        if r:
            rows.append(r)
    by = {g: [n for n, (gg, _) in conds.items() if gg == g] for g in ("отклонение", "маркер", "доминация")}
    for ga, gb in (("отклонение", "маркер"), ("отклонение", "доминация"), ("маркер", "доминация")):
        for a, b in itertools.product(by[ga], by[gb]):
            r = ev(f"{a} + {b}", conds[a][1] & conds[b][1], "пара")
            if r:
                rows.append(r)
    for a, b, c in itertools.product(by["отклонение"], by["маркер"], by["доминация"]):
        r = ev(f"{a} + {b} + {c}", conds[a][1] & conds[b][1] & conds[c][1], "тройка")
        if r:
            rows.append(r)
    t = pd.DataFrame(rows)
    t["худшая половина, раз"] = t[["1-я пол., раз", "2-я пол., раз"]].min(axis=1)
    t = t.sort_values("худшая половина, раз", ascending=False)
    os.makedirs(bt.OUT, exist_ok=True)
    t.to_csv(os.path.join(bt.OUT, "zones.csv"), index=False)
    print(f"проверено зон: {len(t)} (одиночных {(~t['тип'].isin(['пара', 'тройка'])).sum()}, пар {(t['тип'] == 'пара').sum()}, троек {(t['тип'] == 'тройка').sum()})")

    pd.set_option("display.width", 320, "display.max_colwidth", 95, "display.max_rows", 200)
    cols = ["зона", "дней %", "разворот %", "1-я пол., раз", "2-я пол., раз", "монет лучше обычного %",
            "рост 90 дн %", "просадка 90 дн %", "крупные: разворот %", "крупные: рост 90 дн %"]
    single = t[~t["тип"].isin(["пара", "тройка"])]
    for g in ("отклонение", "маркер", "доминация"):
        print(f"\n--- одиночные: {g}")
        print(single[single["тип"] == g][cols].round(1).to_string(index=False))
    print("\n--- лучшие пары (по худшей из двух половин)")
    print(t[t["тип"] == "пара"].head(12)[cols].round(1).to_string(index=False))
    print("\n--- лучшие тройки")
    print(t[t["тип"] == "тройка"].head(12)[cols].round(1).to_string(index=False))
    print("\n--- худшие зоны (где покупать не стоило)")
    print(t.sort_values("к обычному, раз").head(8)[cols].round(1).to_string(index=False))
    stable = t[(t["1-я пол., раз"] > 1.2) & (t["2-я пол., раз"] > 1.2) & (t["монет лучше обычного %"] >= 70)]
    print(f"\nзон, которые лучше обычного дня минимум в 1.2 раза в обеих половинах и на 70% монет: {len(stable)} из {len(t)}")
    names = pd.Series(" + ".join(stable["зона"]).split(" + ")).value_counts()
    print("какие условия чаще всего входят в устойчивые зоны:")
    print(names.head(12).to_string())


if __name__ == "__main__":
    main()
