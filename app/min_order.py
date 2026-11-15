"""Минимальная сделка $10 на бирже: маржа на споте (Bybit), взнос $2 в день на монету (UNIT = 2 в симуляторе).
Без минимума / минимум $10 (взносы копятся, покупка, когда набралось ≥ $11; продажи меньше $10 пропускаются, если это не вся позиция).
Портфель P9 и монеты отдельно (USELESS, XMR, ZEC), исполнение в срок, стресс −20/−30%. Запуск: python3 app/min_order.py"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo_margin import SETS  # noqa: E402
from combo3_msim import sim6  # noqa: E402
from perp_margin import fill, ST  # noqa: E402

PX.POL.update(on=True, k=0.0, m=2.0, A=0)
for name, coins in [("P9", SETS["P9"]), ("USELESS", [("USELESS36828-USD", "alt")]), ("XMR", [("XMR-USD", "alt")]), ("ZEC", [("ZEC-USD", "alt")])]:
    P = I6.LP(coins); fill(P)
    ok = np.where(np.isfinite(P.B.C).any(axis=1))[0]; first, last = int(ok[0]), int(ok[-1]); sl = slice(0, last + 1)
    if len(coins) > 1:
        from agent4d_margin import STARTS
        starts = [int(s) for s in STARTS if s < last - 90]
    else:
        starts = list(range(first, last - 90, 90))
    print(f"\n== {name}: стартов {len(starts)}", flush=True)
    for lab, mm, WT in (("маржа ×1,5", {"lp": 1.5}, (0.5, 0.5)), ("без плеча", {"lev": False}, (1.0,))):
        S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", **mm); A, G = P.mats(S, all_lag=0)
        for mn, mb in ((0.0, 0.0), (10.0, 11.0)):
            k = I6.cfg(P, WT=WT, SPL=C3M.SPLIT if len(WT) > 1 else [0] * 8, mino=mn, minb=mb)
            f = lambda s, sv: sim6(P.B.C[sl], P.B.LO[sl], P.B.HI[sl], A[sl], G[sl], np.zeros(P.B.C[sl].shape), np.ones(P.B.C[sl].shape), int(s), P.B.levmat(L), sv,  # noqa: E731
                                   0.15 / 365, 0.11 / 365, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0)
            o = [f(s, 1.0) for s in starts]; x = np.array([q[1] for q in o]) * 100
            l30 = sum(int(f(s, 0.7)[0] > 0) for s in starts)
            print(f"   {lab:10s} {'мин $10' if mn else 'без мин.'}: медиана {np.median(x):+.0f}% | худший {x.min():+.0f}% | ликв {sum(int(q[0] > 0) for q in o)} | при −30% {l30} | пропущено продаж {np.median([q[5] for q in o]) * 100:.1f}% вложенного", flush=True)
