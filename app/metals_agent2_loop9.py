"""Круг 9: откуп на пробое выше цены продажи; перегрев по реальной цене к средней за 20 лет. Основа — R5.
H9a — цена выше цены последней продажи на u, маркеров вершины < n−2 → доля b резерва (раз на продажу).
H9b — реальная цена к средней за 20 лет > процентиля q → продать s.
Критерий: select_ok + плато; после 1999 — только вето.
Запуск: python3 app/metals_agent2_loop9.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L

UA, BA = (0.3, 0.5, 1.0), (0.1, 0.2, 0.33)
QB, SB = (0.95, 0.97, 0.99), (0.1, 0.2, 0.3)
REAL = "Реальная цена (с поправкой на инфляцию) к средней за 20 лет"


def rebuy(u, b):
    base = A.ver("R5")

    def f(d):
        p = base(d).copy()
        c, tn, nt = d["c"], d["tn3"], d["nt"]
        last, used = np.nan, True
        for i in range(len(c)):
            if p[i] < 0:
                last, used = c[i], False
            elif p[i] == 1.0 and not used and np.isfinite(last) and c[i] >= last * (1 + u) and tn[i] < nt - 2:
                p[i] = 1 + b
                used = True
        return p
    return f


def realhot(a, s):
    base = A.ver("R5")

    def f(d):
        p = base(d)
        hot = np.nan_to_num(A.feat(d, REAL)) > a
        return np.where(hot & (p <= 1.0), np.minimum(p, -s), p)
    return f


def main():
    D = A.load()
    R5 = A.evaluate(D, A.ver("R5"))
    C, meta = {}, {}
    for u in UA:
        for b in BA:
            nm = f"H9a: цена выше последней продажи на {u:.0%} → откуп {b:.0%} резерва"
            C[nm] = rebuy(u, b); meta[nm] = ("a", u, b)
    for q in QB:
        a = L.pooled(D, REAL, q)
        for s in SB:
            nm = f"H9b: реальная цена к ср. 20 лет > {a:.2f} (q{int(q * 100)}) → продать {s:.0%}"
            C[nm] = realhot(a, s); meta[nm] = ("b", q, s)
    print(f"=== {len(C)} вариантов; только период подбора (до 1999) ===")
    rows = A.study(D, C, R5, show=8)
    good, by = A.pick(rows, meta, lambda key: (None, UA, BA) if key[0] == "a" else (None, QB, SB))
    print("\n  сетка: сумма до 1999 (половины) ✓")
    for fam, X, Y in (("a", UA, BA), ("b", QB, SB)):
        for x in X:
            print(f"    H9{fam} {x}: " + "  ".join(f"{y}: {by[(fam, x, y)]['s']['before']['logsum']:+6.1f} ({by[(fam, x, y)]['s']['h1']['logsum']:+.0f}/{by[(fam, x, y)]['s']['h2']['logsum']:+.0f})"
                                             f"{'✓' if by[(fam, x, y)]['ok'] else ' '}" for y in Y))
    for fam in ("a", "b"):
        r = max((r for r in rows if meta[r["name"]][0] == fam), key=lambda r: r["s"]["before"]["logsum"])
        print(f"  лучший H9{fam} по металлам до 1999: {A.bymetal(r['s'], 'before')}")
    print(f"\nпрошли критерий с плато: {len(good)}")
    if not good:
        print("R5 не меняется")
        return
    best = good[0]
    print(f"\nВЫБРАН по «до 1999»: {best['name']}\n  {A.fb(best['s'])}\n  до 1999 по металлам: {A.bymetal(best['s'], 'before')}")
    A.veto([best], R5)
    print("  итог к DCA: " + A.line(best["R"], A.SEL))


if __name__ == "__main__":
    main()
