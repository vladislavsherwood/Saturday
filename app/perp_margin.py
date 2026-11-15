"""Плечо через фьючерсы (перпы) вместо маржинального займа: заёмная часть сделки combo4 (схема ×1,5) открывается лонгом на перпе.
Модель sim6 hl=2: залог перпов — только USDC (резерв) + отложенный залог col, спот не залог; заёмная часть b на перпе с залогом x = b × XC из своих денег
(плечо перпа = 1 + 1/XC); фандинг 10% годовых на номинал перпа; комиссии спот 0,07% / перп 0,045%; ликвидация по поддерживающей марже монеты.
Сравнение: спот-маржа (Bybit, займ 11%) / перп с залогом XC 2, 1, 0,5 / без плеча. По монете отдельно и на портфеле P9.
Запуск: python3 app/perp_margin.py"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo_margin import SETS  # noqa: E402
from combo3_msim import sim6  # noqa: E402

PX.POL.update(on=True, k=0.0, m=2.0, A=0)
HERE = os.path.dirname(os.path.abspath(__file__))
ST = {"base": 1, "rules": json.load(open(os.path.join(HERE, "found", "combo4-best.json")))["rules"]}


def fill(P):
    for k in range(P.B.C.shape[1]):
        C = P.B.C[:, k]; ok = np.where(np.isfinite(C))[0]
        if not len(ok): continue
        for M in (P.B.C, P.B.LO, P.B.HI):
            for i in range(ok[0] + 1, ok[-1] + 1):
                if not np.isfinite(M[i, k]): M[i, k] = P.B.C[i - 1, k]


def run(P, mode, starts, last):
    lev = mode != "спот"
    S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", **({"lp": 1.5} if lev else {"lev": False})); A, G = P.mats(S, all_lag=0)
    WT = (0.5, 0.5) if lev else (1.0,)
    if mode.startswith("перп"):
        k = I6.cfg(P, WT=WT, SPL=C3M.SPLIT, hlx=True, hl=2, fund=0.10 / 365, xc=float(mode.split()[-1]))
    else:
        k = I6.cfg(P, WT=WT, SPL=C3M.SPLIT if lev else [0] * 8)
    sl = slice(0, last + 1)
    out = []
    for s in starts:
        r = sim6(P.B.C[sl], P.B.LO[sl], P.B.HI[sl], A[sl], G[sl], np.zeros(P.B.C[sl].shape), np.ones(P.B.C[sl].shape), int(s), P.B.levmat(L), 1.0,
                 0.15 / 365, 0.11 / 365, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0)
        r7 = sim6(P.B.C[sl], P.B.LO[sl], P.B.HI[sl], A[sl], G[sl], np.zeros(P.B.C[sl].shape), np.ones(P.B.C[sl].shape), int(s), P.B.levmat(L), 0.7,
                  0.15 / 365, 0.11 / 365, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0)
        out.append((r[1], int(r[0] > 0), int(r7[0] > 0), r[2]))
    return out


MODES = ["спот-маржа", "перп XC 2", "перп XC 1", "перп XC 0.5", "спот"]
for name, coins in [("USELESS", [("USELESS36828-USD", "alt")]), ("XMR", [("XMR-USD", "alt")]), ("ZEC", [("ZEC-USD", "alt")]), ("P9", SETS["P9"])]:
    P = I6.LP(coins); fill(P)
    ok = np.where(np.isfinite(P.B.C).any(axis=1))[0]; first, last = int(ok[0]), int(ok[-1])
    if len(coins) == 1:
        starts = list(range(first, last - 90, 90))
    else:
        from agent4d_margin import STARTS
        starts = [int(s) for s in STARTS if s < last - 90]
    print(f"\n== {name}: стартов {len(starts)}", flush=True)
    for mode in MODES:
        o = run(P, mode, starts, last); x = np.array([q[0] for q in o]) * 100
        print(f"   {mode:12s} медиана {np.median(x):+.0f}% | худший {x.min():+.0f}% | ликвидаций {sum(q[1] for q in o)} | при −30% {sum(q[2] for q in o)} | мин. запас {min(q[3] for q in o):.2f}", flush=True)
