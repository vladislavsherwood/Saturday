"""Круг 19: «остывание» после вершины — копить взносы в резерв после крупной продажи (H19a) или пока медь прошла вершину (H19b). Основа — R6.
Критерий: select_ok + плато; после 1999 — только вето. Запуск: python3 app/metals_agent2_loop19.py"""
import numpy as np

import metals_agent2_lib as A

VS, NS = (0.26, 0.5), (6, 12, 24)


def cool(v, N):
    base = A.ver("R6")

    def f(d):
        p = base(d)
        big = p <= -v + 1e-9
        s = A.since(big)
        return np.where((s >= 1) & (s <= N) & (p == 1.0), 0.0, p)
    return f


def copper_cool(d):
    p = A.ver("R6")(d)
    return np.where(d["cu_past"] & (p == 1.0), 0.0, p)


def main():
    D = A.load()
    R6 = A.evaluate(D, A.ver("R6"))
    C, meta = {}, {}
    for v in VS:
        for N in NS:
            nm = f"H19a: после продажи ≥ {v:.0%} копить взносы {N} мес."
            C[nm] = cool(v, N); meta[nm] = ("a", v, N)
    C["H19b: медь прошла вершину → остальные копят взносы"] = copper_cool; meta["H19b: медь прошла вершину → остальные копят взносы"] = ("b",)
    print(f"=== {len(C)} вариантов; только период подбора (до 1999) ===")
    rows = A.study(D, C, R6, show=10)
    good, by = A.pick(rows, meta, lambda key: (None, VS, NS) if key[0] == "a" else (None,))
    for r in rows:
        print(f"    {r['name']}: по металлам до 1999 {A.bymetal(r['s'], 'before')}")
    print(f"\nпрошли критерий с плато: {len(good)}")
    if not good:
        print("R6 не меняется")
        return
    best = good[0]
    print(f"\nВЫБРАН по «до 1999»: {best['name']}\n  {A.fb(best['s'])}")
    A.veto([best], R6)
    print("  итог к DCA: " + A.line(best["R"], A.SEL))


if __name__ == "__main__":
    main()
