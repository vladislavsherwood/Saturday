"""P9 по combo4 с маржой (основная схема ×1,5, шорт BTC 20%, сделки 50/50) и без плеча — старт 1 / 2 / 3 года назад, итог на последний день.
Прибыль к вложенному (fin / inv − 1) по sim6, исполнение в срок, ставка 11%. Запуск: python3 app/earn_p9_margin.py"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo_margin import SETS  # noqa: E402
from combo3_msim import sim6  # noqa: E402

PX.POL.update(on=True, k=0.0, m=2.0)
ST = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "combo3-best.json")))
P = I6.LP(SETS["P9"]); n = P.B.C.shape[0]
last = int(np.max(np.where(np.isfinite(P.B.C[:, 0]))[0]))
for nm, mm, shw, WT in (("маржа ×1,5", {"lp": 1.5}, 0.2, (0.5, 0.5)), ("без плеча", {"lev": False}, 0.0, (1.0,))):
    S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", **mm)
    A, G = P.mats(S, all_lag=0)
    k = I6.cfg(P, WT=WT, SPL=C3M.SPLIT if len(WT) > 1 else [0] * 8)
    W = P.W * shw if shw else np.zeros(P.B.C.shape)
    for Y in (1, 2, 3):
        s = last - 365 * Y
        r = sim6(P.B.C[:last + 1], P.B.LO[:last + 1], P.B.HI[:last + 1], A[:last + 1], G[:last + 1], W[:last + 1], np.ones(P.B.C[:last + 1].shape), int(s), P.B.levmat(L), 1.0,
                 0.15 / 365, 0.11 / 365, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0)
        print(f"{nm} | {Y} г.: прибыль к вложенному {r[1] * 100:+.0f}%, ликвидаций {int(r[0])}, мин. запас {r[2]:.2f}")
