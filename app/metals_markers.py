"""Металлы «от обратного»: что объединяет хорошие точки входа и выхода по золоту, серебру, платине, палладию и меди.

Тот же порядок, что для крипты (markers.py), но с макромаркерами:
1. Крупные вершины и впадины каждого металла размечаются задним числом (разворот крупный, если цена ушла на порог металла).
2. На каждый день считаются признаки без заглядывания в будущее: цена металла, ставки и кривая доходности, реальная ставка,
   отклонение ставки ФРС от нейтральной, инфляция, безработица, нефть, доллар, акции, облигации, связь металла с акциями и облигациями,
   соотношения металлов между собой.
3. Для каждого признака — насколько он отличает зону вершины и зону дна (AUC) в четырёх срезах:
   две группы металлов (золото, серебро, медь / платина, палладий) × до и после 2013 года.
4. Условный вопрос: металл на 90-дневном максимуме (минимуме) — что отличает разворот от продолжения, и что было с ценой через полгода.

Запуск: python3 app/metals_markers.py <куда.json>
"""
import json
import os
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import data  # noqa: E402
import macro  # noqa: E402
from markers import auc, pivots, roll  # noqa: E402

# металл: (тикер, название, во сколько раз должна уйти цена, чтобы разворот считался крупным, группа)
METALS = {"gold": ("GC=F", "Золото", 1.20, "A"), "silver": ("SI=F", "Серебро", 1.40, "A"), "copper": ("HG=F", "Медь", 1.35, "A"),
          "platinum": ("PL=F", "Платина", 1.30, "B"), "palladium": ("PA=F", "Палладий", 1.50, "B")}
Y, H = 252, 126           # торговых дней в году и в полугодии


def metal_features(c, v, gold, M):
    r = c.pct_change()
    lr = np.log(c).diff()
    F = pd.DataFrame(index=c.index)
    F["Цена к средней за 200 дней"] = c / roll(c, 200)
    F["Цена к средней за 50 дней"] = c / roll(c, 50)
    F["Просадка от годового максимума, %"] = (1 - c / roll(c, Y, "max")) * 100
    F["До исторического максимума, %"] = (1 - c / c.cummax()) * 100
    F["Рост от годового минимума, %"] = (c / roll(c, Y, "min") - 1) * 100
    for n, name in ((21, "месяц"), (63, "квартал"), (126, "полгода"), (252, "год")):
        F[f"Изменение за {name}, %"] = (c / c.shift(n) - 1) * 100
    F["RSI за 14 дней"] = 100 - 100 / (1 + r.clip(lower=0).ewm(alpha=1 / 14).mean() / (-r.clip(upper=0)).ewm(alpha=1 / 14).mean())
    F["Волатильность за 30 дней, %"] = roll(lr, 30, "std") * 100
    F["Волатильность: месяц к году"] = roll(lr, 21, "std") / roll(lr, Y, "std")
    F["Отклонение от средней 200 в сигмах"] = (np.log(c) - roll(np.log(c), 200)) / roll(np.log(c), 200, "std")
    if v is not None and (v > 0).mean() > 0.8:
        dv = v.where(v > 0)
        F["Объём: месяц к году"] = roll(dv, 21) / roll(dv, Y)
    rg = c / gold.reindex(c.index, method="ffill")
    F["Металл к золоту против своей средней за 200 дней"] = rg / roll(rg, 200)
    F["Металл к золоту: изменение за квартал, %"] = (rg / rg.shift(63) - 1) * 100
    # связь с акциями, облигациями и долларом: корреляция дневных изменений за 90 торговых дней
    for key, name in (("spx", "акциями"), ("tlt", "облигациями"), ("dxy", "долларом"), ("oil", "нефтью")):
        if key in M:
            F[f"Связь металла с {name} (корреляция за 90 дней)"] = r.rolling(90, min_periods=60).corr(M[key].reindex(c.index).pct_change())
    return F


def macro_features(M, prices):
    X = pd.DataFrame(index=M.index)
    X["Ставка 3 месяца, %"] = M["y3m"]
    X["Доходность 10 лет, %"] = M["y10"]
    X["Доходность 10 лет: изменение за квартал, п.п."] = M["y10"] - M["y10"].shift(63)
    X["Реальная доходность 10 лет (TIPS), %"] = M["real10"]
    X["Реальная доходность: изменение за квартал, п.п."] = M["real10"] - M["real10"].shift(63)
    X["Реальная доходность: изменение за год, п.п."] = M["real10"] - M["real10"].shift(Y)
    X["Ожидаемая инфляция на 10 лет (безубыточность), %"] = M["y10"] - M["real10"]
    X["Ожидаемая инфляция: изменение за квартал, п.п."] = X["Ожидаемая инфляция на 10 лет (безубыточность), %"].diff(63)
    X["Кривая: 10 лет минус 2 года, п.п."] = M["y10"] - M["y2"]
    X["Кривая: 10 лет минус 3 месяца, п.п."] = M["y10"] - M["y3m"]
    X["Рынок ждёт снижения ставки: 2 года минус 3 месяца, п.п."] = M["y2"] - M["y3m"]
    X["Ставка: изменение за год, п.п."] = M["y3m"] - M["y3m"].shift(Y)
    X["Ставка: изменение за полгода, п.п."] = M["y3m"] - M["y3m"].shift(H)
    realpol = M["y3m"] - M["cpi_yoy"]
    X["Реальная ставка ФРС (ставка минус инфляция), %"] = realpol
    X["Нейтральная ставка r*, %"] = M["rstar"]
    X["Отклонение ставки от нейтральной, п.п."] = realpol - M["rstar"]
    X["Отклонение от нейтральной: изменение за год, п.п."] = (realpol - M["rstar"]).diff(Y)
    X["Инфляция за год, %"] = M["cpi_yoy"]
    X["Инфляция: изменение за полгода, п.п."] = M["cpi_yoy"] - M["cpi_yoy"].shift(H)
    X["Инфляция за 3 месяца в годовом выражении, %"] = M["cpi_3m"]
    X["Инфляция ускоряется: 3 месяца минус год, п.п."] = M["cpi_3m"] - M["cpi_yoy"]
    X["Безработица, %"] = M["unemp"]
    X["Безработица выше годового минимума, п.п."] = M["unemp_low"]
    X["Безработица: изменение за полгода, п.п."] = M["unemp"] - M["unemp"].shift(H)
    for key, name in (("oil", "Нефть"), ("dxy", "Доллар"), ("spx", "Акции"), ("tlt", "Облигации")):
        s = M[key]
        X[f"{name}: цена к средней за 200 дней"] = s / roll(s, 200)
        X[f"{name}: изменение за квартал, %"] = (s / s.shift(63) - 1) * 100
        X[f"{name}: изменение за год, %"] = (s / s.shift(Y) - 1) * 100
    X["Акции: до исторического максимума, %"] = (1 - M["spx"] / M["spx"].cummax()) * 100
    X["VIX"] = M["vix"]
    X["VIX к своей средней за год"] = M["vix"] / roll(M["vix"], Y)
    X["Связь акций с облигациями (корреляция за 90 дней)"] = M["spx"].pct_change().rolling(90, min_periods=60).corr(M["tlt"].pct_change())
    g, s, cu, pt = (prices[k].reindex(M.index, method="ffill") for k in ("gold", "silver", "copper", "platinum"))
    oil = M["oil"]
    for name, ratio in (("Золото к серебру", g / s), ("Медь к золоту", cu / g), ("Платина к золоту", pt / g), ("Золото к нефти", g / oil)):
        X[f"{name}: соотношение против средней за 200 дней"] = ratio / roll(ratio, 200)
        X[f"{name}: соотношение против средней за 5 лет"] = ratio / roll(ratio, 5 * Y)
    X["Золото к серебру: уровень"] = g / s
    X["Реальная цена золота: к индексу цен против средней за 10 лет"] = (g / (1 + M["cpi_yoy"].fillna(0) / 100 / Y).cumprod()) / roll(g / (1 + M["cpi_yoy"].fillna(0) / 100 / Y).cumprod(), 10 * Y)
    return X


def main(out):
    hist, vols = {}, {}
    for k, (sym, _, _, _) in METALS.items():
        df = macro.long_history(sym)
        hist[k], vols[k] = df["c"], df["v"]
    idx = hist["gold"].index
    M = macro.table(idx)
    X = macro_features(M, hist)
    rows, piv_all = [], []
    for k, (sym, name, factor, grp) in METALS.items():
        c = hist[k]
        F = metal_features(c, vols[k], hist["gold"], M).join(X, how="left")
        pv = pivots(c.values, factor)
        top = np.zeros(len(c), bool); bot = np.zeros(len(c), bool)
        for i, s in pv:
            seg = np.arange(max(0, i - 21), min(len(c), i + 22))                     # месяц до и после разворота
            band = 1 - (factor - 1) * 0.3                                            # зона — в пределах 30% от порога разворота
            if s > 0:
                top[seg[c.values[seg] >= band * c.values[i]]] = True
            else:
                bot[seg[c.values[seg] <= c.values[i] / band]] = True
            piv_all.append((name, str(c.index[i].date()), int(s), float(c.values[i])))
        F["top"], F["bot"], F["grp"], F["coin"] = top, bot, grp, name
        F["_f63"], F["_f126"], F["_f252"] = (c.shift(-63) / c - 1) * 100, (c.shift(-126) / c - 1) * 100, (c.shift(-252) / c - 1) * 100
        F["_hi90"] = (c >= c.rolling(90, min_periods=60).max()).rolling(7).max() > 0
        F["_lo90"] = (c <= c.rolling(90, min_periods=60).min()).rolling(7).max() > 0
        last = pv[-1][0] if pv else 0
        rows.append(F.iloc[260:last + 22] if pv else F.iloc[0:0])
        tops = [str(c.index[i].date())[:7] for i, s in pv if s > 0]
        print(f"{name:9} дней {len(c)} с {c.index[0].date()}, разворотов {len(pv)}; вершины: {', '.join(tops)}")
    A = pd.concat(rows)
    feats = [k for k in A.columns if k not in ("top", "bot", "grp", "coin") and not k.startswith("_")]
    print(f"\nдней {len(A)}, признаков {len(feats)}; зона вершины {A.top.mean() * 100:.1f}% дней, зона дна {A.bot.mean() * 100:.1f}%")
    cells = {"A до 2013": (A.grp == "A") & (A.index < "2013-01-01"), "A после": (A.grp == "A") & (A.index >= "2013-01-01"),
             "B до 2013": (A.grp == "B") & (A.index < "2013-01-01"), "B после": (A.grp == "B") & (A.index >= "2013-01-01")}

    def study(D, lab, fwd, good, title, top_n=24):
        y = D[lab].values.astype(bool)
        early = (D.index < "2013-01-01")
        masks = [((D.grp == g).values & (early if e else ~early)) for g in ("A", "B") for e in (True, False)]
        print(f"\n=== {title} ===\nдней {len(D)}; в зоне разворота {y.mean() * 100:.0f}%; цена через полгода: медиана {D[fwd].median():.0f}%")
        res = []
        for f in feats:
            x = D[f].values.astype(float)
            if np.isfinite(x).mean() < 0.5:
                continue
            cs = [auc(x[m], y[m]) for m in masks]
            v = [a for a in cs if not np.isnan(a)]
            if len(v) < 3:
                continue
            q1, q2 = np.nanquantile(x, 1 / 3), np.nanquantile(x, 2 / 3)
            g = [D[x <= q1], D[(x > q1) & (x <= q2)], D[x > q2]]
            res.append({"f": f, "auc": auc(x, y), "cells": cs, "ok": all(a > 0.5 for a in v) or all(a < 0.5 for a in v), "min": min(abs(a - 0.5) for a in v), "q": [float(q1), float(q2)],
                        "zone": [float(k[lab].mean() * 100) for k in g], "fwd": [float(k[fwd].median()) for k in g], "win": [float((k[fwd] * good > 0).mean() * 100) for k in g]})
        R = pd.DataFrame(res)
        print(f"{'признак':60} {'AUC':>5} {'A до':>6} {'A после':>7} {'B до':>6} {'B после':>7} | зона по третям, % | через полгода по третям, % | границы третей")
        for _, r in R[R.ok].sort_values("min", ascending=False).head(top_n).iterrows():
            print(f"{r.f[:60]:60} {r.auc:5.2f} " + " ".join(f"{(a if not np.isnan(a) else 0):>6.2f}" for a in r.cells) + "  | " + " / ".join(f"{z:3.0f}" for z in r.zone)
                  + "      | " + " / ".join(f"{z:4.0f}" for z in r.fwd) + "           | " + " / ".join(f"{z:.3g}" for z in r.q))
        print("  меняют знак между срезами (обманчивые): " + "; ".join(f"{r.f} ({r.auc:.2f})" for _, r in R[~R.ok].assign(d=lambda d: (d.auc - 0.5).abs()).sort_values("d", ascending=False).head(8).iterrows()))
        return json.loads(R.to_json(orient="records"))

    out_data = {}
    out_data["top_all"] = study(A[A["_f126"].notna()], "top", "_f126", -1, "ВЕРШИНЫ: все дни")
    out_data["bot_all"] = study(A[A["_f126"].notna()], "bot", "_f126", 1, "ДНО: все дни")
    out_data["top_hi"] = study(A[A["_hi90"].fillna(False).astype(bool) & A["_f126"].notna()], "top", "_f126", -1, "МЕТАЛЛ НА 90-ДНЕВНОМ МАКСИМУМЕ: вершина или продолжение роста")
    out_data["bot_lo"] = study(A[A["_lo90"].fillna(False).astype(bool) & A["_f126"].notna()], "bot", "_f126", 1, "МЕТАЛЛ НА 90-ДНЕВНОМ МИНИМУМЕ: дно или продолжение падения")

    # связь металлов с акциями и облигациями: в целом и по состояниям рынка
    print("\n=== СВЯЗЬ МЕТАЛЛОВ С АКЦИЯМИ И ОБЛИГАЦИЯМИ (корреляция дневных изменений) ===")
    rs, rb = M["spx"].pct_change(), M["tlt"].pct_change()
    sb = rs.rolling(90, min_periods=60).corr(rb)
    print(f"{'металл':10} {'с акциями':>10} {'с облигациями':>14} | акции падают (ниже средней 200): с акциями / с облигациями | акции и облигации ходят вместе (>0): с акциями / с облигациями")
    bear, same = (M["spx"] < roll(M["spx"], 200)), sb > 0
    for k, (sym, name, _, _) in METALS.items():
        r = hist[k].pct_change().reindex(M.index)
        c = lambda a, m=None: (r[m.values].corr(a[m.values]) if m is not None else r.corr(a))      # noqa: E731
        print(f"{name:10} {c(rs):10.2f} {c(rb):14.2f} | {c(rs, bear):6.2f} / {c(rb, bear):5.2f}                                         | {c(rs, same):6.2f} / {c(rb, same):5.2f}")
    print(f"акции и облигации ходят вместе в {same.mean() * 100:.0f}% дней (с 2003 года); в последние два года — в {same.iloc[-500:].mean() * 100:.0f}%")
    json.dump({"studies": out_data, "pivots": piv_all}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    A.to_pickle(out.replace(".json", ".pkl"))


if __name__ == "__main__":
    main(sys.argv[1])
