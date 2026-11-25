"""Круг 5 mop: размер продаж mb1 по уровню опционной вол. Запуск: python3 app/mop_r5.py (лог scratchpad/mop/r5.txt)"""
import numpy as np

import mop_lib as P
from mop_r2 import own_iv


def sz(cond, m):
    def f(X):
        p = P.mb1(X)
        iv, sma, pc = own_iv(X)
        rv = P.rvol(X.c)
        F = dict(pc=pc, vr=iv / rv)
        with np.errstate(invalid="ignore"):
            mask = np.nan_to_num(cond(F)).astype(bool)
        return P.scale_sells(p, mask, m)
    return f


def main():
    P.tee("r5.txt")
    D, DD, MM = P.load()
    nsell = {k: int(((P.mb1(MM[k]) < 0) & (MM[k].t >= P.C08) & (MM[k].t <= P.END25)).sum()) for k in P.DSEL}
    print("Дней продаж mb1 2008-06…2025-12:", nsell)
    groups = [
        ("S1 перцентиль < p → ×m", lambda p: (lambda F: F["pc"] < p), (0.2, 0.3, 0.4), (1.5, 2.0)),
        ("S2 перцентиль > p → ×0,5", lambda p: (lambda F: F["pc"] > p), (0.7, 0.8, 0.9), (0.5,)),
        ("S3 вол/реализ. < r → ×1,5", lambda p: (lambda F: F["vr"] < p), (0.9, 1.0, 1.1), (1.5,)),
        ("S3b вол/реализ. > r → ×0,5", lambda p: (lambda F: F["vr"] > p), (1.3, 1.5), (0.5,)),
    ]
    for title, mk, ps, ms in groups:
        print(f"\n=== {title} ===")
        for m in ms:
            for p in ps:
                P.both(MM, sz(mk(p), m), f"p/r {p}, ×{m}")


if __name__ == "__main__":
    main()
