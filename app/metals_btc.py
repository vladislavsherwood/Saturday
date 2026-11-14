"""Связь металлов с биткоином.

1. Связь движений: корреляция месячных изменений биткоина и металлов, в целом и по двухлетним отрезкам.
2. Совпадают ли вершины и дно: где были металлы, когда биткоин делал исторический максимум.
3. Что делали металлы после «тихой вершины» крипты (биткоин в 10% от максимума, а доля альткоинов выросла на 1,5+ п.п. за 90 дней)
   и просто после дней, когда биткоин у максимума: изменение цены металла через 3 и 6 месяцев против обычного дня.
4. Правило в стратегию: к месячной стратегии металлов добавляется продажа (или покупка) в месяцы тихой вершины; 2015–2026.

Запуск: python3 app/metals_btc.py
"""
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
import metals_long as ml  # noqa: E402
from metals_monthly import BOT, CUT, TOP, edge  # noqa: E402
from metals_monthly3 import plan  # noqa: E402

DAILY = {"gold": ("GC=F", "Золото"), "silver": ("SI=F", "Серебро"), "platinum": ("PL=F", "Платина"), "palladium": ("PA=F", "Палладий"), "copper": ("HG=F", "Медь")}


def main():
    btc = data.cmc_ohlc(1)["c"]
    btc = btc[~btc.index.duplicated()]
    dom = data.dominances()
    oth90 = (dom["oth"] - dom["oth"].shift(90)).reindex(btc.index, method="ffill")
    bath = (1 - btc / btc.cummax()) * 100
    qt = ((bath < 10) & (oth90 > 1.5)).astype(bool)
    near = bath < 10
    M = {k: macro.long_history(s)["c"] for k, (s, _) in DAILY.items()}
    print(f"биткоин с {btc.index[0].date()}, доминации с {dom.index[0].date()}; дней тихой вершины: {int(qt.sum())}, дней «биткоин у максимума»: {int(near.sum())}")

    # 1. корреляция месячных изменений
    bm = btc.resample("ME").last().pct_change()
    print("\n=== 1. СВЯЗЬ МЕСЯЧНЫХ ИЗМЕНЕНИЙ С БИТКОИНОМ (корреляция) ===")
    spans = [("2014", "2016"), ("2017", "2018"), ("2019", "2020"), ("2021", "2022"), ("2023", "2024"), ("2025", "2026")]
    print(f"{'металл':10} {'вся история':>12} " + " ".join(f"{a}–{b[2:]:>2}" for a, b in spans))
    for k, (s, name) in DAILY.items():
        mm = M[k].resample("ME").last().pct_change()
        j = pd.concat([bm, mm], axis=1).dropna()
        line = [j.iloc[:, 0][(j.index >= a) & (j.index <= b + "-12-31")].corr(j.iloc[:, 1][(j.index >= a) & (j.index <= b + "-12-31")]) for a, b in spans]
        print(f"{name:10} {j.iloc[:, 0].corr(j.iloc[:, 1]):12.2f} " + " ".join(f"{x:7.2f}" for x in line))

    # 2. вершины биткоина: где были металлы
    print("\n=== 2. ВЕРШИНЫ БИТКОИНА: ГДЕ БЫЛИ МЕТАЛЛЫ (цена металла к его максимуму за год; что было через 6 месяцев) ===")
    tops = []
    c = btc.values
    # крупные вершины биткоина: максимум, после которого цена упала минимум вдвое
    hi, ih, mode = c[0], 0, 1
    for i in range(1, len(c)):
        if mode == -1 and c[i] > hi:          # новый исторический максимум — начинается следующий цикл
            mode = 1
        if c[i] > hi:
            hi, ih = c[i], i
        if mode == 1 and c[i] < hi / 2:
            tops.append(btc.index[ih]); mode = -1
    tops.append(btc.index[int(np.argmax(c))]) if btc.index[int(np.argmax(c))] not in tops else None
    for t in tops:
        row = [f"{t.date()}"]
        for k, (s, name) in DAILY.items():
            x = M[k]
            if t < x.index[0]:
                continue
            p = x.asof(t)
            yr = x[(x.index > t - pd.Timedelta(days=365)) & (x.index <= t)]
            fwd = x.asof(t + pd.Timedelta(days=182))
            row.append(f"{name} {p / yr.max() * 100:.0f}% от макс., через полгода {(fwd / p - 1) * 100:+.0f}%")
        print("  " + " | ".join(row))

    # 3. событие: тихая вершина / биткоин у максимума → металлы через 3 и 6 месяцев
    print("\n=== 3. ЧТО ДЕЛАЛИ МЕТАЛЛЫ ПОСЛЕ ДНЕЙ ТИХОЙ ВЕРШИНЫ И ДНЕЙ «БИТКОИН У МАКСИМУМА» (с 2015 года) ===")
    print(f"{'металл':10} | {'обычный день: 3 / 6 мес.':>26} | {'тихая вершина: 3 / 6 мес.':>27} | {'реже роста за 6 мес.':>20} | {'биткоин у макс.: 3 / 6 мес.':>28}")
    for k, (s, name) in DAILY.items():
        x = M[k][M[k].index >= "2015-01-01"]
        f3 = x.shift(-63) / x - 1
        f6 = x.shift(-126) / x - 1
        q = qt.reindex(x.index, method="ffill").fillna(False).astype(bool)
        n = near.reindex(x.index, method="ffill").fillna(False).astype(bool)
        base3, base6 = f3.median() * 100, f6.median() * 100
        print(f"{name:10} | {base3:12.1f}% / {base6:6.1f}%    | {f3[q].median() * 100:13.1f}% / {f6[q].median() * 100:6.1f}%    | {(f6[q] > 0).mean() * 100:7.0f}% против {(f6 > 0).mean() * 100:.0f}%   | {f3[n].median() * 100:14.1f}% / {f6[n].median() * 100:6.1f}%")
    # по эпизодам тихой вершины
    days = qt[qt].index
    eps, cur = [], [days[0]]
    for d in days[1:]:
        if (d - cur[-1]).days > 45:
            eps.append(cur); cur = []
        cur.append(d)
    eps.append(cur)
    print("  по эпизодам (через 6 месяцев после первого дня):")
    for e in eps:
        print("   " + f"{e[0].date()}…{e[-1].date()}: " + ", ".join(f"{name} {(M[k].asof(e[0] + pd.Timedelta(days=182)) / M[k].asof(e[0]) - 1) * 100:+.0f}%" for k, (s, name) in DAILY.items()))

    # 4. правило в стратегию (месячные данные 2015–2026)
    print("\n=== 4. ТИХАЯ ВЕРШИНА КАК ПРАВИЛО В СТРАТЕГИИ МЕТАЛЛОВ (2015–2026, итог к DCA) ===")
    X = ml.monthly_table()
    X["palladium"] = M["palladium"].resample("ME").mean().reindex(X.index)
    keys = ["gold", "silver", "platinum", "palladium", "copper", "aluminum", "nickel", "lead", "zinc"]
    F = {k: ml.features(X, k) for k in keys}
    pool = pd.concat([F[k][F[k].index < CUT] for k in ml.METALS])
    thr = {(f, d): float(pool[f].dropna().quantile(0.8 if d == "hi" else 0.2)) for f, d in TOP + BOT}
    qm = qt.resample("ME").max().reindex(X.index).fillna(False).astype(bool)           # тихая вершина была хотя бы один день в месяце
    nm = near.resample("ME").max().reindex(X.index).fillna(False).astype(bool)
    title = {**{k: v[1] for k, v in ml.METALS.items()}, "palladium": "Палладий"}
    variants = [("итоговая стратегия металлов", None), ("+ тихая вершина → продать 10%", ("qt", -0.1)), ("+ тихая вершина → продать 30%", ("qt", -0.3)),
                ("+ тихая вершина → пропустить взнос", ("qt", 0.0)), ("+ тихая вершина → взнос и весь резерв", ("qt", 2.0)), ("+ биткоин у максимума → продать 10%", ("near", -0.1))]
    base = ((5, 0.1, True), (4, 1.0), None)
    for name, extra in variants:
        out = []
        for k in keys:
            c = X[k].dropna()
            c = c[c.index >= "2015-01-01"]
            tn = sum(((F[k][f] > thr[(f, d)]) if d == "hi" else (F[k][f] < thr[(f, d)])).fillna(False).astype(int) for f, d in TOP).reindex(c.index).values
            bn = sum(((F[k][f] > thr[(f, d)]) if d == "hi" else (F[k][f] < thr[(f, d)])).fillna(False).astype(int) for f, d in BOT).reindex(c.index).values
            p = plan(tn, bn, base)
            if extra:
                m = (qm if extra[0] == "qt" else nm).reindex(c.index).values & (p == 1.0)          # не перебивает сигналы самих металлов
                p = np.where(m, extra[1], p)
            out.append(edge({"c": c.values.astype(np.float64)}, p, 0, len(c)))
        out = np.array(out)
        print(f"  {name:40} в плюсе {(out > 0).sum()}/{len(out)}, медиана {np.median(out):+.0f}%, худший {out.min():+.0f}% | " + ", ".join(f"{title[k]} {x:+.0f}" for k, x in zip(keys, out)))
    print(f"  месяцев с тихой вершиной с 2015 года: {int(qm[qm.index >= '2015-01-01'].sum())}")


if __name__ == "__main__":
    main()
