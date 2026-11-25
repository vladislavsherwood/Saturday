"""Круг 7 mop: внутри макро-серии — инверсия VIX, премия IV/RV, OVX/MOVE для меди. Запуск: python3 app/mop_r7.py (лог scratchpad/mop/r7.txt)"""
import numpy as np

import mop_lib as P
from mop_r2 import own_iv


def accel(cond, m):
    def f(X):
        p = P.mb1(X)
        F = fe(X)
        with np.errstate(invalid="ignore"):
            mask = np.nan_to_num(cond(F)).astype(bool) & (p > 1.0)
        q = p.copy()
        q[mask] = 1.0 + np.clip(1 - (1 - (p[mask] - 1.0)) ** m, 0, 0.999)
        return q
    return f


def pause(cond, W, only=None):
    def f(X):
        p = P.mb1(X)
        if only and X.k not in only:
            return p
        F = fe(X)
        with np.errstate(invalid="ignore"):
            ev = np.nan_to_num(cond(F)).astype(bool)
        wait = P.since_days(ev) <= W
        return P.defer_buys(p, wait)
    return f


_F = {}


def fe(X):
    if X.k not in _F:
        V = P.vol()
        iv, _, _ = own_iv(X)
        _F[X.k] = dict(inv=P.on(V["^VIX"], X) / P.on(V["^VIX3M"], X), vr=iv / P.rvol(X.c),
                       ovx=P.on(P.pctl(V["^OVX"]), X), move=P.on(P.pctl(V["^MOVE"]), X))
    return _F[X.k]


def main():
    P.tee("r7.txt")
    D, DD, MM = P.load()
    for k in P.DSEL:
        X = MM[k]
        p = P.mb1(X)
        s = (p > 1) & (X.t <= P.END25) & (X.t >= P.A0)
        F = fe(X)
        print(f"  {P.NAME[k]}: дней серии 2005–25 {int(s.sum())}, из них инверсия {int((s & (np.nan_to_num(F['inv']) > 1)).sum())}, IV/RV < 1 {int((s & (np.nan_to_num(F['vr'], nan=9) < 1)).sum())}")
    print("\n=== B1 инверсия → доля дня × m ===")
    for th in (1.0, 1.05):
        for m in (1.5, 2.0):
            P.both(MM, accel(lambda F, th=th: F["inv"] > th, m), f"VIX/VIX3M > {th}, ×{m}")
    print("\n=== B1b пауза докупок серии W дней после инверсии ===")
    for th in (1.0, 1.05):
        for W in (30, 60):
            P.both(MM, pause(lambda F, th=th: F["inv"] > th, W), f"VIX/VIX3M > {th}, W {W}")
    print("\n=== B2 медь: пауза W дней после всплеска OVX / MOVE (перцентиль > 0,9) ===")
    for nm in ("ovx", "move"):
        for W in (30, 60, 90):
            P.both(MM, pause(lambda F, nm=nm: F[nm] > 0.9, W, only=("copper",)), f"{nm.upper()} > 0,9, W {W}")
    print("\n=== B3 IV/RV < r → доля дня × 1,5 ===")
    for r in (0.9, 1.0, 1.1):
        P.both(MM, accel(lambda F, r=r: F["vr"] < r, 1.5), f"IV/RV < {r}")


if __name__ == "__main__":
    main()
