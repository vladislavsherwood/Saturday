"""Круг 6: другие правила, отклонённые прошлыми агентами из-за 1965–81 (по журналам), на новом протоколе. Основа — Q2.
F1 «усреднение вниз» (2-й агент, круг 4): в серии цена ниже цены месяца начала серии на dd (0/5/10%) → доля g_hi, иначе g_lo
   (g_lo = 20/33%, g_hi = 50/67%); в 1982–98 у агента 2 было +2,7, в 1965–81 −35.
F2 «вторая ступень пузыря» (круг 17b): цена к ср. 3 г. И рост за год > q (q98/q99) → продать s2 (30/40/50%).
F3 «упорство вершины» (круг 8a): маркеров вершины ≥ n−3 подряд p мес. (2/3/4/6) → продать s (5/10/15%); в 1982–98 было +0…+5.
F4 «парабола» (круг 17a): рост за 6 мес. > q (q95/97/99 по 8 металлам 1965–98) → продать s (10/20/30%).
Каждое семейство отбирается отдельно (sel_ok против Q2 + плато), вето — только для лучшего прошедшего в семействе.
Запуск: python3 app/metals_agent3_loop6.py"""
import numpy as np
import pandas as pd

import metals_agent2_lib as A
import metals_agent3_lib as T
import metals_agent_lib as L
from metals_agent3_loop2 import q1
from metals_agent3_loop5 import cool


def q2(d):
    return cool(q1, 0.2, 24)(d)


def avg_down(base, dd, glo, ghi):
    def f(d):
        p = base(d).copy()
        c = d["c"]
        ref = np.nan
        for i in range(len(p)):
            if p[i] > 1.0:
                if i == 0 or p[i - 1] <= 1.0:
                    ref = c[i]
                p[i] = 1 + (ghi if c[i] <= ref * (1 - dd) and not (i == 0 or p[i - 1] <= 1.0) else glo)
        return p
    return f


def bubble(base, a, b, s):
    def f(d):
        p = base(d)
        return np.where(T.heat(d, a, b) & (p <= 1.0 + 1e-9), np.minimum(p, -s), p)
    return f


def persist_top(base, pm, s):
    def f(d):
        p = base(d)
        hit = A.runs(d["tn3"] >= d["nt"] - 3) >= pm
        return np.where(hit & (p >= 0) & (p <= 1.0), -s, p)
    return f


def r6m(d):
    c = pd.Series(d["c"])
    return (c / c.shift(6) - 1).values * 100


def parabola(base, thr, s):
    def f(d):
        p = base(d)
        hit = np.nan_to_num(r6m(d)) > thr
        return np.where(hit & (p <= 1.0), np.minimum(p, -s), p)
    return f


def fam(D, R3, Qr, name, C, meta, axes):
    print(f"\n=== {name} ===")
    rows = T.study(D, C, Qr, show=5)
    good, by = T.pick(rows, meta, axes)
    print(f"  прошли с плато: {len(good)}")
    if good:
        b = good[0]
        print(f"  ВЫБРАН: {b['name']}\n    {T.fs(b['s'])}\n    по металлам 1982–98: {T.bym(b['s'], 'h2')}\n    1982–98: " + T.fprox(b["a"]))
        T.veto(b, R3, Qr)
    return good


def main():
    D = T.load()
    R3, Q = T.run(D, A.ver("R3")), T.run(D, q2)
    print("Q2 1982–98: " + T.fprox(T.agg(Q)))
    # F1
    C, meta = {}, {}
    DD, GL, GH = (0.0, 0.05, 0.10), (0.2, 0.33), (0.5, 0.67)
    for dd in DD:
        for gl in GL:
            for gh in GH:
                nm = f"F1 ниже начала серии на {dd:.0%} → {gh:.0%}, иначе {gl:.0%}"
                C[nm] = avg_down(q2, dd, gl, gh); meta[nm] = (dd, gl, gh)
    fam(D, R3, Q, "F1 усреднение вниз", C, meta, (DD, GL, GH))
    # F2
    C, meta = {}, {}
    QS, SS = (0.98, 0.99), (0.3, 0.4, 0.5)
    for q in QS:
        a, b = L.pooled(D, A.P3, q), L.pooled(D, A.Y1, q)
        for s in SS:
            nm = f"F2 пузырь q{int(q * 100)} (×{a:.2f}, +{b:.0f}%) → {s:.0%}"
            C[nm] = bubble(q2, a, b, s); meta[nm] = (q, s)
    fam(D, R3, Q, "F2 вторая ступень пузыря", C, meta, (QS, SS))
    # F3
    C, meta = {}, {}
    PS, SS = (2, 3, 4, 6), (0.05, 0.10, 0.15)
    for pm in PS:
        for s in SS:
            nm = f"F3 вершина ≥ n−3 подряд {pm} мес. → {s:.0%}"
            C[nm] = persist_top(q2, pm, s); meta[nm] = (pm, s)
    fam(D, R3, Q, "F3 упорство вершины", C, meta, (PS, SS))
    # F4
    C, meta = {}, {}
    v = np.concatenate([r6m(D[k])[: D[k]["m"]] for k in T.SEL])
    v = v[np.isfinite(v)]
    QS, SS = (0.95, 0.97, 0.99), (0.1, 0.2, 0.3)
    for q in QS:
        thr = float(np.quantile(v, q))
        for s in SS:
            nm = f"F4 рост за 6 мес. > q{int(q * 100)} (+{thr:.0f}%) → {s:.0%}"
            C[nm] = parabola(q2, thr, s); meta[nm] = (q, s)
    fam(D, R3, Q, "F4 парабола", C, meta, (QS, SS))


if __name__ == "__main__":
    main()
