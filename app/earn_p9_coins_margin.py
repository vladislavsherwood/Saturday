"""combo4 с маржой ×1,5 по каждой монете P9 отдельно (своя маржа на монету, без шорта BTC — он портфельный) против DCA: старт 1 / 2 / 3 года назад.
Прибыль к вложенному по sim6, исполнение в срок, ставка 11%; DCA и вложено — $2 в день. Запуск: python3 app/earn_p9_coins_margin.py"""
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
S, L = C3M.scheme6(ST, lp=1.5, sr=1.0, t1grp="off")
OUT = {}
for sym, kind in SETS["P9"]:
    P = I6.LP([(sym, kind)]); C = P.B.C[:, 0]; ok = np.where(np.isfinite(C))[0]; first, last = int(ok[0]), int(ok[-1])
    for M in (P.B.C, P.B.LO, P.B.HI):  # пропуск дня внутри истории (у HYPE один) — заполняю вчерашней ценой, иначе sim6 видит обвал до нуля
        for i in range(first + 1, last + 1):
            if not np.isfinite(M[i, 0]): M[i, 0] = P.B.C[i - 1, 0]
    A, G = P.mats(S, all_lag=0); k = I6.cfg(P, WT=(0.5, 0.5), SPL=C3M.SPLIT); sl = slice(0, last + 1)
    row = {}
    for Y in (1, 2, 3):
        s = max(first, last - 365 * Y)
        r = sim6(P.B.C[sl], P.B.LO[sl], P.B.HI[sl], A[sl], G[sl], np.zeros(P.B.C[sl].shape), np.ones(P.B.C[sl].shape), int(s), P.B.levmat(L), 1.0,
                 0.15 / 365, 0.11 / 365, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0)
        days = last - s + 1; inv = 2.0 * days; dca = sum(2.0 * 0.999 / C[i] for i in range(s, last + 1)) * C[last]
        row[Y] = {"from": str(I6.LP.__mro__ and P.B.C.shape[0] and s), "days": days, "inv": inv, "m": r[1], "liq": int(r[0]), "lvl": r[2], "dca": dca / inv - 1, "full": s == first}
    OUT[sym] = row
    print(sym, " | ".join(f"{Y} г.: маржа {v['m'] * 100:+.0f}% (${v['inv'] * (1 + v['m']):,.0f}, ликв {v['liq']}, запас {v['lvl']:.2f}) / DCA {v['dca'] * 100:+.0f}% (${v['inv'] * (1 + v['dca']):,.0f}) из ${v['inv']:,.0f}{' вся ист.' if v['full'] else ''}" for Y, v in row.items()), flush=True)
json.dump(OUT, open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/earn_coins_m.json", "w"))
