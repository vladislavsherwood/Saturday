"""Анализ вершин и доньев: чем они отличались и какие индикаторы их ловят.

1. Вершина — максимум в окне ±90 дней, после которого цена упала на заданный процент за год.
   Дно — минимум в окне ±90 дней, после которого цена выросла на заданный процент за год.
2. «Зона» вершины/дна — ±30 дней вокруг точки, пока цена рядом с экстремумом.
3. Каждый индикатор переводится в процентиль относительно собственной прошлой истории актива.
   Сигнал = индикатор в верхних или нижних 10% своей истории.
4. Для каждого сигнала: точность (доля дней сигнала, попавших в зону), подъём (во сколько раз это чаще случайного),
   охват (доля вершин/доньев, где сигнал был), универсальность (на какой доле активов он работает),
   устойчивость во времени (первая и вторая половина истории).

Запуск: python3 dca/peaks.py
"""
import itertools
import os

import numpy as np
import pandas as pd

import backtest as bt
import quant
import quant2

# класс: (тикеры, торговых дней в году, падение после вершины, рост после дна, допуск цены в зоне)
CLASSES = {
    "Крипта": (quant.UNIVERSE["Крипта: топ-2018"] + ["SOL-USD"], 365, 0.40, 0.70, 0.15),
    "Акции": (quant.UNIVERSE["Акции: ETF"] + ["AAPL", "NVDA", "^TA125.TA", "EIS"], 252, 0.15, 0.20, 0.05),
    "Металлы, сырьё, облигации": (quant.UNIVERSE["Металлы, сырьё, облигации"] + ["GC=F", "SI=F"], 252, 0.15, 0.20, 0.05),
}
NAMES = {
    "sma200": "цена/SMA200", "sma50": "цена/SMA50", "rsi14": "RSI14 дневной", "rsi_w": "RSI14 недельный",
    "ret30": "рост за 30 дн", "ret90": "рост за 90 дн", "ret365": "рост за год", "bbz": "Боллинджер z",
    "dd": "просадка от годового макс.", "up": "рост от годового мин.", "vol30": "волатильность 30 дн",
    "volsurge": "объём 30 дн / год", "mfi": "MFI14", "fng": "Fear&Greed", "alt_btc": "монета/BTC к SMA200",
    "btc_sma": "BTC цена/SMA200", "stable": "доля стейблов к SMA200", "vix": "VIX",
}
HI, LO = 0.90, 0.10


def turning_points(close, w, drop, rise, fwd):
    c = close.values
    s = pd.Series(c)
    mx = s.rolling(2 * w + 1, center=True).max().values
    mn = s.rolling(2 * w + 1, center=True).min().values
    fmin = s[::-1].rolling(fwd, min_periods=1).min()[::-1].values
    fmax = s[::-1].rolling(fwd, min_periods=1).max()[::-1].values
    tops = np.where((c == mx) & (fmin / c - 1 <= -drop))[0]
    bots = np.where((c == mn) & (fmax / c - 1 >= rise))[0]
    return tops, bots


def zone(close, points, z, tol, top):
    c = close.values
    lab = np.zeros(len(c), dtype=bool)
    for i in points:
        a, b = max(0, i - z), min(len(c), i + z + 1)
        seg = c[a:b]
        lab[a:b] |= (seg >= c[i] / (1 + tol)) if top else (seg <= c[i] * (1 + tol))
    return lab


def features(close, volume, bpy, market):
    wk = 7 if bpy == 365 else 5
    y = bpy
    ret = close.pct_change()
    f = pd.DataFrame(index=close.index)
    f["sma200"] = close / close.rolling(200).mean()
    f["sma50"] = close / close.rolling(50).mean()
    f["rsi14"] = bt.rsi(close, 14)
    f["rsi_w"] = bt.rsi(close, 14 * wk)
    for d, nm in ((30, "ret30"), (90, "ret90"), (365, "ret365")):
        f[nm] = close / close.shift(int(d * bpy / 365)) - 1
    f["bbz"] = (close - close.rolling(20).mean()) / close.rolling(20).std()
    f["dd"] = 1 - close / close.rolling(y, min_periods=y // 2).max()
    f["up"] = close / close.rolling(y, min_periods=y // 2).min() - 1
    f["vol30"] = ret.rolling(30).std()
    if (volume > 0).mean() > 0.8:
        f["volsurge"] = volume.rolling(30).mean() / volume.rolling(y).mean()
        mf = close * volume
        pos = mf.where(ret > 0, 0).rolling(14).sum()
        neg = mf.where(ret < 0, 0).rolling(14).sum()
        f["mfi"] = 100 - 100 / (1 + pos / neg.replace(0, np.nan))
    for k, s in market.items():
        f[k] = s.reindex(close.index, method="ffill")
    return f


def build():
    btc = bt.yahoo("BTC-USD")["close"]
    eth = bt.yahoo("ETH-USD")["close"]
    st = quant2.cached("stables.csv", quant2.stable_supply).reindex(btc.index, method="ffill")
    cap = quant2.cached("btc_cap.csv", quant2.btc_cap).reindex(btc.index, method="ffill")
    dom = (st / (st + cap + eth.reindex(btc.index) * 110e6))["2020-01-01":]
    crypto_market = {"fng": bt.fear_greed(), "btc_sma": btc / btc.rolling(200).mean(),
                     "stable": dom / dom.rolling(200).mean()}
    stock_market = {"vix": bt.yahoo("^VIX")["close"]}
    frames, points = [], []
    for cls, (syms, bpy, drop, rise, tol) in CLASSES.items():
        for sym in syms:
            try:
                data = bt.yahoo(sym)
            except Exception:  # noqa: BLE001
                continue
            data = data[data.index >= "2010-01-01"]
            close, volume = data["close"], data["volume"]
            if len(close) < 3 * bpy:
                continue
            market = dict(crypto_market) if cls == "Крипта" else (dict(stock_market) if cls == "Акции" else {})
            raw = features(close, volume, bpy, market)
            if cls == "Крипта" and sym != "BTC-USD":
                r = close / btc.reindex(close.index)
                raw["alt_btc"] = r / r.rolling(200).mean()
            pct = raw.expanding(min_periods=200).rank(pct=True)
            w, z = int(90 * bpy / 365), int(30 * bpy / 365)
            tops, bots = turning_points(close, w, drop, rise, bpy)
            df = pd.DataFrame({"cls": cls, "sym": sym, "date": close.index, "close": close.values})
            df["top"] = zone(close, tops, z, tol, True)
            df["bot"] = zone(close, bots, z, tol, False)
            df["is_top"] = False
            df["is_bot"] = False
            df.loc[tops, "is_top"] = True
            df.loc[bots, "is_bot"] = True
            h = int(90 * bpy / 365)
            df["fwd90"] = (close.shift(-h) / close - 1).values
            for c in raw.columns:
                df["raw_" + c] = raw[c].values
                df["p_" + c] = pct[c].values
            n = len(df)
            df["valid"] = (np.arange(n) >= bpy) & (np.arange(n) < n - w)
            frames.append(df)
            points.append({"cls": cls, "sym": sym, "tops": int((tops >= bpy).sum()), "bots": int((bots >= bpy).sum())})
    return pd.concat(frames, ignore_index=True), pd.DataFrame(points)


def evaluate(d, sig, target):
    """Метрики одного сигнала на наборе строк d (уже valid)."""
    y = d[target].values
    s = sig & ~np.isnan(d["close"].values)
    if s.sum() < 30:
        return None
    base = y.mean()
    prec = y[s].mean()
    # охват: доля точек разворота, в зоне которых был хотя бы один день сигнала
    key = "is_top" if target == "top" else "is_bot"
    pts = d.index[d[key].values]
    hit = 0
    pos = d.index.get_indexer(pts)
    sv = s
    symv = d["sym"].values
    for p in pos:
        a, b = max(0, p - 30), min(len(sv), p + 31)
        m = symv[a:b] == symv[p]
        hit += bool((sv[a:b] & m).any())
    # универсальность: доля активов, где подъём > 1.5
    g = pd.DataFrame({"sym": symv, "y": y, "s": s})
    per = g.groupby("sym").apply(lambda x: (x.y[x.s].mean() / x.y.mean()) if x.s.sum() >= 10 and x.y.mean() > 0 else np.nan)
    per = per.dropna()
    return {"дней сигнала %": s.mean() * 100, "точность %": prec * 100, "подъём": prec / base,
            "охват %": hit / max(len(pts), 1) * 100,
            "активов с подъёмом>1.5 %": (per > 1.5).mean() * 100 if len(per) else np.nan, "активов": len(per),
            "рост за 90 дн после сигнала %": np.nanmedian(d["fwd90"].values[s]) * 100}


def main():
    data, pts = build()
    data = data[data.valid].reset_index(drop=True)
    os.makedirs(bt.OUT, exist_ok=True)
    pd.set_option("display.width", 260, "display.max_rows", 200, "display.max_colwidth", 60)
    feats = [c[2:] for c in data.columns if c.startswith("p_")]
    all_rows = []
    for cls in CLASSES:
        d = data[data.cls == cls].reset_index(drop=True)
        p = pts[pts.cls == cls]
        print(f"\n===== {cls}: активов {d.sym.nunique()}, вершин {p.tops.sum()}, доньев {p.bots.sum()}, "
              f"дней в зоне вершины {d.top.mean() * 100:.1f}%, в зоне дна {d.bot.mean() * 100:.1f}%, "
              f"обычный рост за 90 дн {np.nanmedian(d.fwd90) * 100:.1f}%")
        # 1. чем характеризовались
        show = [f for f in ("sma200", "rsi14", "rsi_w", "ret90", "ret365", "dd", "up", "fng", "vix", "alt_btc", "btc_sma")
                if "raw_" + f in d and d["raw_" + f].notna().any()]
        ch = pd.DataFrame({
            "на вершине": [d.loc[d.is_top, "raw_" + f].median() for f in show],
            "на дне": [d.loc[d.is_bot, "raw_" + f].median() for f in show],
            "обычный день": [d["raw_" + f].median() for f in show],
            "процентиль на вершине": [d.loc[d.is_top, "p_" + f].median() for f in show],
            "процентиль на дне": [d.loc[d.is_bot, "p_" + f].median() for f in show],
        }, index=[NAMES[f] for f in show]).round(2)
        print("\nзначения индикаторов (медианы):")
        print(ch.to_string())

        mid = d.date.sort_values().iloc[len(d) // 2]
        for target, tname in (("top", "ВЕРШИНЫ"), ("bot", "ДНО")):
            rows = []
            sigs = {}
            for f in feats:
                x = d["p_" + f].values
                if np.isnan(x).mean() > 0.7:
                    continue
                for tail, m in (("высоко", x >= HI), ("низко", x <= LO)):
                    r = evaluate(d, m, target)
                    if r is None:
                        continue
                    h1 = evaluate(d[d.date < mid], m[(d.date < mid).values], target)
                    h2 = evaluate(d[d.date >= mid], m[(d.date >= mid).values], target)
                    r.update({"сигнал": f"{NAMES[f]} {tail}", "подъём 1-я пол.": h1["подъём"] if h1 else np.nan,
                              "подъём 2-я пол.": h2["подъём"] if h2 else np.nan})
                    rows.append(r)
                    sigs[r["сигнал"]] = m
            t = pd.DataFrame(rows).set_index("сигнал").sort_values("подъём", ascending=False)
            print(f"\n--- {tname}: одиночные сигналы (топ-8 по подъёму)")
            print(t.head(8).round(1).to_string())
            # пары
            good = list(t[t["подъём"] > 1.3].index[:10])
            prow = []
            for a, b in itertools.combinations(good, 2):
                m = sigs[a] & sigs[b]
                r = evaluate(d, m, target)
                if r is None:
                    continue
                h1 = evaluate(d[d.date < mid], m[(d.date < mid).values], target)
                h2 = evaluate(d[d.date >= mid], m[(d.date >= mid).values], target)
                r.update({"сигнал": f"{a} + {b}", "подъём 1-я пол.": h1["подъём"] if h1 else np.nan,
                          "подъём 2-я пол.": h2["подъём"] if h2 else np.nan})
                prow.append(r)
            if prow:
                tp = pd.DataFrame(prow).set_index("сигнал")
                tp["мин. подъём по половинам"] = tp[["подъём 1-я пол.", "подъём 2-я пол."]].min(axis=1)
                tp = tp.sort_values("мин. подъём по половинам", ascending=False)
                print(f"\n--- {tname}: пары сигналов (топ-5 по худшей из двух половин)")
                print(tp.head(5).round(1).to_string())
                tp["cls"], tp["target"], tp["kind"] = cls, tname, "пара"
                all_rows.append(tp.reset_index())
            t["cls"], t["target"], t["kind"] = cls, tname, "одиночный"
            all_rows.append(t.reset_index())
    pd.concat(all_rows).to_csv(os.path.join(bt.OUT, "peaks_signals.csv"), index=False)
    pts.to_csv(os.path.join(bt.OUT, "peaks_points.csv"), index=False)


if __name__ == "__main__":
    main()
