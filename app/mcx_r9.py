"""Круг 9 mcx: сборка лучших вариантов семей поверх mb1; отдельные дневные стратегии против DCA. Запуск: python3 app/mcx_r9.py"""
import numpy as np

import mcx_lib as C
from mcx_r3 import core
from mcx_r4 import flight
from mcx_r5 import piggy, t_vix
from mcx_r7 import heat


def combo(DD, parts):
    fns = [p for p in parts]

    def fn(X):
        ts = np.zeros(X.n); tb = np.zeros(X.n); tk = np.zeros(X.n); tm = np.zeros(X.n)
        for g in fns:
            r = g(X)
            r = tuple(r) + ((np.zeros(X.n),) if len(r) == 3 else ())
            ts = np.maximum(ts, r[0]); tb = np.maximum(tb, r[1]); tk = np.maximum(tk, r[2]); tm = np.maximum(tm, r[3])
        tb = np.where(ts > 0, 0.0, tb)
        tk = np.where(tb > 0, 0.0, tk)
        return ts, tb, tk, tm
    return fn


def main():
    C.tee("r9.txt")
    D, DD, MM, base = C.load()
    H = heat(DD, 3.5, 0.05, "B3")
    V = piggy(DD, 0.25, t_vix(30), 1.0)
    F = flight(DD, 0.04, 0.015, 0.0)
    print("=== H9a: сборка поверх mb1 ===")
    for nm, parts, cap in (("перегрев + VIX-копилка", [H, V], 0.10), ("перегрев + VIX-копилка + доллар", [H, V, F], 0.10),
                           ("перегрев + доллар", [H, F], 1.0)):
        L = C.Layer(combo(DD, parts), capf=cap)
        o = C.report(nm, L)
        ex = C.check(L, ["palladium"], starts=False)
        print(f"    экзамен палладий A {ex['cells'][('palladium', 'A')]:+.1f} B {ex['cells'][('palladium', 'B')]:+.1f}; " + C.fafter(o))
    print("\n=== H9b: отдельные дневные стратегии (DCA + слой) — итог к DCA, % (A 2005–15 / B 2016–25 / 2005–25); для сравнения mb1 ===")
    S = {"mb1 (макро, без слоя)": C.NULL,
         "ядро combo7 (страх 2%/день, k 1)": C.Layer(core(DD, 0.02, 1.0), standalone=True),
         "перегрев 3,5σ + откуп под SMA50": C.Layer(H, standalone=True),
         "копилка 25% + VIX > 30": C.Layer(V, standalone=True, capf=0.10),
         "доллар T 4% (только отложенные взносы)": C.Layer(F, standalone=True),
         "всё вместе (перегрев + VIX + доллар)": C.Layer(combo(DD, [H, V, F]), standalone=True, capf=0.10)}
    for nm, L in S.items():
        row = []
        good = 0
        for k in C.DSEL + ["palladium"]:
            X = MM[k]
            sg = C.segs(X)
            v = [C.run(X, base, L, s)[0] for s in (sg["A"], sg["B"], (sg["A"][0], sg["B"][1]))]
            if k in C.DSEL and v[0] > 0 and v[1] > 0:
                good += 1
            row.append(f"{C.NAME[k][:3]} {v[0]:+.1f}/{v[1]:+.1f}/{v[2]:+.1f}")
        print(f"  {nm}: " + "; ".join(row) + f" | лучше DCA в обеих половинах: {good}/4")
    print("\nТочность отдельной стратегии «всё вместе» (2005–25):")
    p = C.prec_agg(S["всё вместе (перегрев + VIX + доллар)"])
    print("  " + C.pfmt(p))


if __name__ == "__main__":
    main()
