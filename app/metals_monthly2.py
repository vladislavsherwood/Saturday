"""Металлы на месячных данных, второй круг.

Первый круг: правила, выбранные по 1965–1998, держатся и в 1999–2026 (медиана +12% к DCA), кроме золота — продажи на признаках
разогрева в долгий бычий рынок золота 2001–2011 и 2016–2026 стоили ему 7–26%. У больших вершин золота (1974, 1980, 2011)
падение начиналось, когда ФРС переходила к ужесточению. Гипотезы:
1. продавать на маркерах вершины только после подтверждения — ставка ФРС или реальная ставка уже растёт;
2. возвращать резерв, когда цена после сильного падения снова выше средней за год;
3. посмотреть, нужна ли золоту своя версия (без продаж).
Выбор — по 1965–1998, проверка — 1999–2026. Запуск: python3 app/metals_monthly2.py
"""
import itertools
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import metals_long as ml  # noqa: E402
from metals_monthly import CUT, build, edge  # noqa: E402


def enrich(A, X):
    for k, a in A.items():
        F = ml.features(X, k).reindex(a["t"])
        c = X[k].reindex(a["t"])
        a["dff"] = F["Ставка ФРС: изменение за год, п.п."].fillna(0).values
        a["drr"] = F["Реальная ставка: изменение за год, п.п."].fillna(0).values
        a["dd3"] = (1 - c / c.rolling(36, min_periods=12).max()).fillna(0).values * 100
    return A


SELLS = [None] + [(k, f, conf) for k in (3, 4, 5) for f in (0.05, 0.1) for conf in (None, "ff", "rr")]
BUYS = [None] + [(k, g) for k in (4, 5) for g in (0.5, 1.0)]
RETS = [None, ("calm", 0.25), ("rebound", 1.0)]


def plan_of(a, cand):
    s, b, r = cand
    conds, acts = [], []
    if b:
        conds.append(a["bn"] >= b[0]); acts.append(1 + b[1])
    if s:
        k, f, conf = s
        m = a["tn"] >= k
        if conf == "ff":
            m = m & (a["dff"] > 0.5)
        elif conf == "rr":
            m = m & (a["drr"] > 0.5)
        conds.append(m); acts.append(-f)
    if r:
        m = (a["up12"] & (a["tn"] <= 1)) if r[0] == "calm" else (a["up12"] & (a["dd3"] > 20))
        conds.append(m); acts.append(1 + r[1])
    return np.select(conds, acts, default=1.0).astype(np.float64) if conds else np.ones(len(a["c"]))


def text(cand):
    s, b, r = cand
    out = []
    if b:
        out.append(f"маркеров дна ≥ {b[0]} → взнос и {int(b[1] * 100)}% резерва")
    if s:
        k, f, conf = s
        out.append(f"маркеров вершины ≥ {k}" + {None: "", "ff": " и ставка ФРС за год выросла на 0,5+ п.п.", "rr": " и реальная ставка за год выросла на 0,5+ п.п."}[conf] + f" → продать {int(f * 100)}%")
    if r:
        out.append(("цена выше средней за год и маркеров вершины ≤ 1 → вернуть 25% резерва" if r[0] == "calm" else "цена выше средней за год после падения на 20%+ от максимума за 3 года → вернуть весь резерв"))
    return " | ".join(out) or "DCA"


def main():
    A, thr, X = build()
    A = enrich(A, X)
    names = {k: v[1] for k, v in ml.METALS.items()}
    C = [c for c in itertools.product(SELLS, BUYS, RETS) if c != (None, None, None)]
    rows = []
    for c in C:
        tr, te, fu = {}, {}, {}
        for k, a in A.items():
            p = plan_of(a, c)
            m = int(np.searchsorted(a["t"].values, np.datetime64(CUT)))
            tr[k], te[k], fu[k] = edge(a, p, 0, m), edge(a, p, m, len(a["c"])), edge(a, p, 0, len(a["c"]))
        rows.append({"c": c, "tr": tr, "te": te, "fu": fu})
    v = lambda d: np.array(list(d.values()))                                  # noqa: E731
    ok = [r for r in rows if (v(r["tr"]) > 0).all()]
    print(f"вариантов {len(rows)}; до 1999 все восемь металлов в плюсе: {len(ok)}")
    best = sorted(ok, key=lambda r: -(v(r["tr"]).min() + np.median(v(r["tr"])) / 2))
    print("\nЛУЧШИЕ ПО 1965–1998 → 1999–2026:")
    for r in best[:10]:
        print(f"  {text(r['c'])}\n     до 1999: худший {v(r['tr']).min():.0f}%, медиана {np.median(v(r['tr'])):.0f}% | после 1999: в плюсе {(v(r['te']) > 0).sum()}/8, худший {v(r['te']).min():.0f}%, медиана {np.median(v(r['te'])):.0f}% | "
              + ", ".join(f"{names[k]} {x:.0f}" for k, x in r["te"].items()))
    t20 = [np.median(v(r["te"])) for r in best[:20]]
    print(f"топ-20: после 1999 медиана {np.median(t20):.0f}%, худший металл (медиана по топ-20) {np.median([v(r['te']).min() for r in best[:20]]):.0f}%")
    for name, pick in (("продажа без подтверждения", lambda c: c[0] and c[0][2] is None), ("продажа после роста ставки ФРС", lambda c: c[0] and c[0][2] == "ff"),
                       ("продажа после роста реальной ставки", lambda c: c[0] and c[0][2] == "rr"), ("возврат после падения", lambda c: c[2] and c[2][0] == "rebound")):
        sel = [r for r in rows if pick(r["c"])]
        print(f"  {name}: золото после 1999 — медиана {np.median([r['te']['gold'] for r in sel]):.0f}%; все металлы после 1999 — медиана {np.median([np.median(v(r['te'])) for r in sel]):.0f}%")
    # золото отдельно: лучший вариант по золоту до 1999 и что он дал после
    g = sorted(rows, key=lambda r: -r["tr"]["gold"])[:5]
    print("\nЗОЛОТО ОТДЕЛЬНО: лучшие по золоту до 1999 →")
    for r in g:
        print(f"  {text(r['c'])}: до 1999 {r['tr']['gold']:.0f}% → после 1999 {r['te']['gold']:.0f}%")
    b = best[0]
    print(f"\nВЫБРАННАЯ: {text(b['c'])}\n  вся история: " + ", ".join(f"{names[k]} {x:.0f}%" for k, x in b["fu"].items()))
    for k, a in A.items():
        act = plan_of(a, b["c"])[-1]
        say = "обычный взнос" if act == 1 else (f"продать {-act * 100:.0f}%" if act < 0 else f"взнос и {(act - 1) * 100:.0f}% резерва")
        print(f"  {names[k]} ({a['t'][-1]:%Y-%m}): маркеров вершины {a['tn'][-1]}, дна {a['bn'][-1]}, ставка ФРС за год {a['dff'][-1]:+.2f} п.п. → {say}")


if __name__ == "__main__":
    main()
