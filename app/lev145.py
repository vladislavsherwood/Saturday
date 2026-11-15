"""Проверка плеча ×1,45 (паника и разворот BTC; дно ×2 как было): P9 маржа на споте и четыре перпа (USELESS, XMR, ZEC, FARTCOIN) на одном счёте.
Стресс −20/−30%, сдвиги −1/0/+1 для P9. Запуск: python3 app/lev145.py"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo_margin import SETS  # noqa: E402
from bybit_msim import sim6 as simb  # noqa: E402
from perp_margin import fill, ST  # noqa: E402
from agent4d_margin import STARTS  # noqa: E402

PX.POL.update(on=True, k=0.0, m=2.0, A=0)
for lev in (1.45, 1.5):
    S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", lp=lev, lr=lev)
    bad, ms, lv = [], [], 99
    for pn in SETS:
        o = C3M.full6(I6.LP(SETS[pn]), S, L, 0.2, 0.11 / 365, (0.5, 0.5), 0.0)
        ms.append(f"{pn} {o['m0']:+.0f}"); lv = min(lv, o["lvl"]); bad += [pn] if not o["safe"] else []
    print(f"маржа на споте ×{lev}: {'0 ликв.' if not bad else 'ЛИКВ ' + ','.join(bad)} | запас {lv:.2f} | " + " | ".join(ms), flush=True)
    coins = [("USELESS36828-USD", "alt"), ("XMR-USD", "alt"), ("ZEC-USD", "alt"), ("FARTCOIN-USD", "alt")]
    P = I6.LP(coins); fill(P); ok = np.where(np.isfinite(P.B.C).any(axis=1))[0]; last = int(ok[-1]); sl = slice(0, last + 1)
    A, G = P.mats(S, all_lag=0); k = I6.cfg(P, WT=(0.5, 0.5), SPL=C3M.SPLIT, hlx=True, hl=2, perp_all=True, fund=0.10 / 365, mino=1.0, minb=1.0)
    MK = np.array([2.0, 1.0, 1.0, 2.0])
    st = [int(s) for s in STARTS if s < last - 90]
    f = lambda s, sv: simb(P.B.C[sl], P.B.LO[sl], P.B.HI[sl], A[sl], G[sl], np.zeros(P.B.C[sl].shape), np.ones(P.B.C[sl].shape), s, P.B.levmat(L), sv,  # noqa: E731
                           0.15 / 365, 0.11 / 365, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0, MK)
    o = [f(s, 1.0) for s in st]; x = np.array([q[1] for q in o]) * 100
    print(f"перпы (4 монеты, один счёт) ×{lev}: медиана {np.median(x):+.0f}% | ликв {sum(int(q[0] > 0) for q in o)} | −20%: {sum(int(f(s, 0.8)[0] > 0) for s in st)} | −30%: {sum(int(f(s, 0.7)[0] > 0) for s in st)}", flush=True)
