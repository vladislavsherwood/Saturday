"""«Только перпы на Bybit»: вся позиция монеты — лонг-перп (спота нет), залог — USDT резерва + маржа позиций (sim6 hl=2, PERP для всех монет).
Свои деньги идут в залог перпа, «заём» схемы — это плечо перпа; фандинг 10% годовых на весь номинал; комиссии перпа.
Сравнение для USELESS / XMR / ZEC (по отдельности и вместе): перпы со схемой ×1,5, перпы 1× (без плеча), спот без плеча, спот-маржа.
Стресс: минимумы дня −20/−30%. Запуск: python3 app/perp_only.py"""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo3_msim import sim6 as _sim6  # noqa: E402
from minbuy_msim import sim6 as _sim6b  # noqa: E402
from bybit_msim import sim6 as _sim6c  # noqa: E402
UNITS = {"USELESS36828-USD": 1.0, "XMR-USD": 2.0, "ZEC-USD": 2.0, "FARTCOIN-USD": 1.0}   # взнос пользователя, $ в день
sim6 = _sim6c if os.environ.get("BYBIT") else _sim6b if os.environ.get("SELLANY") else _sim6
from perp_margin import fill, ST  # noqa: E402

PX.POL.update(on=True, k=0.0, m=2.0, A=0)
LPS = [float(x) for x in os.environ.get("LPS", "1.5").split(",")]
MODES = [(f"перпы, схема ×{lp}", lp, True) for lp in LPS] + [("перпы 1× (без плеча)", 0, True), ("спот без плеча", 0, False)]
GR = [("USELESS", [("USELESS36828-USD", "alt")]), ("XMR", [("XMR-USD", "alt")]), ("ZEC", [("ZEC-USD", "alt")]),
       ("все три вместе", [("USELESS36828-USD", "alt"), ("XMR-USD", "alt"), ("ZEC-USD", "alt")]),
       ("FARTCOIN", [("FARTCOIN-USD", "alt")]),
       ("четыре вместе", [("USELESS36828-USD", "alt"), ("XMR-USD", "alt"), ("ZEC-USD", "alt"), ("FARTCOIN-USD", "alt")])]
if os.environ.get("ONLY"): GR = [g for g in GR if g[0] == os.environ["ONLY"]]
for name, coins in GR:
    P = I6.LP(coins); fill(P)
    ok = np.where(np.isfinite(P.B.C).any(axis=1))[0]; first, last = int(ok[0]), int(ok[-1]); sl = slice(0, last + 1)
    if len(coins) == 1: starts = list(range(first, last - 90, 90))
    else:
        from agent4d_margin import STARTS
        starts = [int(s) for s in STARTS if s < last - 90]
    print(f"\n== {name}: стартов {len(starts)}", flush=True)
    for lab, lev, perp in MODES:
        S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", **({"lp": lev} if lev else {"lev": False})); A, G = P.mats(S, all_lag=0)
        WT = (0.5, 0.5) if lev else (1.0,)
        k = I6.cfg(P, WT=WT, SPL=C3M.SPLIT if lev else [0] * 8, mino=float(os.environ.get("MINO", 0)), minb=float(os.environ.get("MINB", 0)), **(dict(hlx=True, hl=2, perp_all=True, fund=0.10 / 365) if perp else {}))
        MK = np.array([2.0 / UNITS.get(s, 2.0) for s, _ in coins])
        ex = (MK,) if os.environ.get("BYBIT") else ()
        f = lambda s, sv: sim6(P.B.C[sl], P.B.LO[sl], P.B.HI[sl], A[sl], G[sl], np.zeros(P.B.C[sl].shape), np.ones(P.B.C[sl].shape), int(s), P.B.levmat(L), sv,  # noqa: E731
                               0.15 / 365, 0.11 / 365, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0, *ex)
        o = [f(s, 1.0) for s in starts]; x = np.array([q[1] for q in o]) * 100
        l20 = sum(int(f(s, 0.8)[0] > 0) for s in starts); l30 = sum(int(f(s, 0.7)[0] > 0) for s in starts)
        print(f"   {lab:22s} медиана {np.median(x):+.0f}% | худший {x.min():+.0f}% | ликв {sum(int(q[0] > 0) for q in o)} | −20%: {l20} | −30%: {l30}", flush=True)
