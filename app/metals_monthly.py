"""Стратегия для металлов на месячных данных за 55 лет.

Модель: каждый месяц взнос идёт в резерв; план месяца — обычный взнос (1), взнос и доля g резерва (1 + g), продать долю f позиции (−f).
Решение по данным месяца исполняется по средней цене следующего месяца (и ещё через месяц — берётся худший вариант); комиссия 0,1%.
Итог — к обычному DCA, %.

Маркеры вершины и дна — из metals_long.py. Пороги («высоко» — выше 70-го процентиля, «низко» — ниже 30-го) считаются
только по месяцам до 1999 года. Правила выбираются по 1965–1998 годам на всех восьми металлах, проверка — 1999–2026.

Запуск: python3 app/metals_monthly.py
"""
import itertools
import os
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import metals_long as ml  # noqa: E402
from metals_strategy import sim  # noqa: E402

CUT = "1999-01-01"
TOP = [("Цена к средней за 3 года", "hi"), ("Изменение за год, %", "hi"), ("Нефть: изменение за год, %", "hi"), ("Доллар к средней за 5 лет", "lo"),
       ("Инфляция: изменение за год, п.п.", "hi"), ("Реальная ставка: изменение за год, п.п.", "lo"), ("Золото к серебру: уровень", "lo")]
BOT = [("Цена к средней за 3 года", "lo"), ("Доллар: изменение за год, %", "hi"), ("Нефть к средней за 3 года", "lo"), ("Ставка ФРС: изменение за год, п.п.", "lo"),
       ("Инфляция: изменение за год, п.п.", "lo"), ("Кривая: 10 лет минус ставка ФРС, п.п.", "hi"), ("Безработица выше минимума за 3 года, п.п.", "hi")]


def build(q_hi=0.7, q_lo=0.3):
    X = ml.monthly_table()
    F = {k: ml.features(X, k) for k in ml.METALS}
    train = pd.concat([F[k][F[k].index < CUT] for k in ml.METALS])
    thr = {}
    for f, d in TOP + BOT:
        v = train[f].dropna()
        thr[(f, d)] = float(v.quantile(q_hi if d == "hi" else q_lo))
    A = {}
    for k in ml.METALS:
        start = "1972-01-01" if k in ("gold", "silver") else "1965-01-01"
        c = X[k][X.index >= start].dropna()
        f = F[k].reindex(c.index)
        cnt = lambda marks: sum(((f[m] > thr[(m, d)]) if d == "hi" else (f[m] < thr[(m, d)])).fillna(False).astype(int) for m, d in marks)   # noqa: E731
        ma12 = c.rolling(12, min_periods=9).mean()
        A[k] = {"c": c.values.astype(np.float64), "t": c.index, "tn": cnt(TOP).values, "bn": cnt(BOT).values,
                "up12": (c > ma12).values, "cross": ((c > ma12) & (c.shift(1) <= ma12.shift(1))).values, "m3": (c / ma12).values}
    return A, thr, X


SELLS = [None] + [(k, f) for k in (2, 3, 4, 5) for f in (0.05, 0.1, 0.25)]
BUYS = [None] + [(k, g) for k in (2, 3, 4, 5) for g in (0.25, 0.5, 1.0)]
RETS = [None, ("cross", 1.0), ("up_calm", 1.0), ("up_calm", 0.25)]


def plan_of(a, cand):
    s, b, r = cand
    conds, acts = [], []
    if b:
        conds.append(a["bn"] >= b[0]); acts.append(1 + b[1])
    if s:
        conds.append(a["tn"] >= s[0]); acts.append(-s[1])
    if r:
        m = a["cross"] if r[0] == "cross" else (a["up12"] & (a["tn"] <= 1))
        conds.append(m); acts.append(1 + r[1])
    return np.select(conds, acts, default=1.0).astype(np.float64) if conds else np.ones(len(a["c"]))


def text(cand):
    s, b, r = cand
    out = []
    if b:
        out.append(f"маркеров дна ≥ {b[0]} из 7 → взнос и {int(b[1] * 100)}% резерва")
    if s:
        out.append(f"маркеров вершины ≥ {s[0]} из 7 → продать {int(s[1] * 100)}%")
    if r:
        out.append(("цена поднялась выше средней за год" if r[0] == "cross" else "цена выше средней за год и маркеров вершины ≤ 1") + f" → вернуть {int(r[1] * 100)}% резерва")
    return " | ".join(out) or "DCA"


def edge(a, plan, lo, hi):
    return min(sim(a["c"], plan, lo, hi, 0), sim(a["c"], plan, lo, hi, 1))


def evaluate(A, cand):
    tr, te, fu = {}, {}, {}
    for k, a in A.items():
        p = plan_of(a, cand)
        m = int(np.searchsorted(a["t"].values, np.datetime64(CUT)))
        n = len(a["c"])
        tr[k], te[k], fu[k] = edge(a, p, 0, m), edge(a, p, m, n), edge(a, p, 0, n)
    return tr, te, fu


def main():
    A, thr, X = build()
    print("пороги по 1965–1998:")
    for (f, d), v in thr.items():
        print(f"  {'вершина' if (f, d) in TOP else 'дно'}: {f} {'>' if d == 'hi' else '<'} {v:.3g}")
    C = [c for c in itertools.product(SELLS, BUYS, RETS) if c != (None, None, None)]
    rows = []
    for c in C:
        tr, te, fu = evaluate(A, c)
        rows.append({"c": c, "tr": tr, "te": te, "fu": fu})
    names = {k: v[1] for k, v in ml.METALS.items()}
    v = lambda d: np.array(list(d.values()))                                  # noqa: E731
    sc = lambda d: v(d).min() + np.median(v(d)) / 2                          # noqa: E731
    ok = [r for r in rows if (v(r["tr"]) > 0).all()]
    print(f"\nвариантов {len(rows)}; до 1999 все восемь металлов в плюсе: {len(ok)}")
    print(f"всё семейство после 1999: медиана {np.median([np.median(v(r['te'])) for r in rows]):.0f}%, в плюсе по медиане {sum(np.median(v(r['te'])) > 0 for r in rows)} из {len(rows)}")
    best = sorted(ok or rows, key=lambda r: -sc(r["tr"]))
    print("\nЛУЧШИЕ ПО 1965–1998 → что вышло в 1999–2026:")
    for r in best[:10]:
        print(f"  {text(r['c'])}\n     до 1999: худший {v(r['tr']).min():.0f}%, медиана {np.median(v(r['tr'])):.0f}% | после 1999: в плюсе {(v(r['te']) > 0).sum()}/8, худший {v(r['te']).min():.0f}%, медиана {np.median(v(r['te'])):.0f}% | "
              + ", ".join(f"{names[k]} {x:.0f}" for k, x in r["te"].items()))
    top20 = [np.median(v(r["te"])) for r in best[:20]]
    print(f"топ-20 по «до 1999»: после 1999 медиана {np.median(top20):.0f}%, в плюсе {sum(x > 0 for x in top20)} из 20")
    # вклад частей на «после 1999»
    for name, pick in (("без продаж", lambda c: c[0] is None), ("с продажами", lambda c: c[0] is not None), ("без покупки у дна", lambda c: c[1] is None), ("с покупкой у дна", lambda c: c[1] is not None),
                       ("без возврата", lambda c: c[2] is None), ("возврат при пересечении средней за год", lambda c: c[2] and c[2][0] == "cross"), ("возврат выше средней без маркеров вершины", lambda c: c[2] and c[2][0] == "up_calm")):
        t1 = [np.median(v(r["tr"])) for r in rows if pick(r["c"])]
        t2 = [np.median(v(r["te"])) for r in rows if pick(r["c"])]
        print(f"  {name}: медиана до 1999 {np.median(t1):.0f}%, после 1999 {np.median(t2):.0f}%")
    # лучший по «до 1999»: сегодняшний сигнал
    b = best[0]
    print(f"\nЛУЧШАЯ ПО «ДО 1999»: {text(b['c'])}\n  вся история: " + ", ".join(f"{names[k]} {x:.0f}%" for k, x in b["fu"].items()))
    for k, a in A.items():
        p = plan_of(a, b["c"])
        act = p[-1]
        say = "обычный взнос" if act == 1 else (f"продать {-act * 100:.0f}%" if act < 0 else f"взнос и {(act - 1) * 100:.0f}% резерва")
        print(f"  {names[k]} ({a['t'][-1]:%Y-%m}): маркеров вершины {a['tn'][-1]} из 7, дна {a['bn'][-1]} из 7 → {say}")


if __name__ == "__main__":
    main()
