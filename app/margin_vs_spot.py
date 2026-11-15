"""combo4 с маржой (основная схема: дно 25% ×2, паника доли ×2 с плечом ×1,5, разворот 100% ×1,5, сделки 50/50; без шорта BTC — он портфельный)
против без плеча — по каждой монете отдельно (своя маржа), старт 1 / 2 / 3 года назад и вся история; плюс старты каждые 90 дней.
Запуск: python3 app/margin_vs_spot.py USELESS36828-USD XMR-USD ZEC-USD"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo3_msim import sim6  # noqa: E402

PX.POL.update(on=True, k=0.0, m=2.0, A=0)
HERE = os.path.dirname(os.path.abspath(__file__))
C4 = json.load(open(os.path.join(HERE, "found", "combo4-best.json")))
ST = {"base": 1, "rules": C4["rules"]}
for sym in sys.argv[1:]:
    P = I6.LP([(sym, "alt")]); C = P.B.C[:, 0]; ok = np.where(np.isfinite(C))[0]; first, last = int(ok[0]), int(ok[-1])
    for M in (P.B.C, P.B.LO, P.B.HI):
        for i in range(first + 1, last + 1):
            if not np.isfinite(M[i, 0]): M[i, 0] = P.B.C[i - 1, 0]
    sl = slice(0, last + 1); res = {}
    for nm, mm, WT in (("маржа", {"lp": 1.5}, (0.5, 0.5)), ("без плеча", {"lev": False}, (1.0,))):
        S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", **mm); A, G = P.mats(S, all_lag=0)
        k = I6.cfg(P, WT=WT, SPL=C3M.SPLIT if len(WT) > 1 else [0] * 8)
        f = lambda s: sim6(P.B.C[sl], P.B.LO[sl], P.B.HI[sl], A[sl], G[sl], np.zeros(P.B.C[sl].shape), np.ones(P.B.C[sl].shape), int(s), P.B.levmat(L), 1.0,  # noqa: E731
                           0.15 / 365, 0.11 / 365, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0)
        res[nm] = {Y: f(max(first, last - 365 * Y)) for Y in (1, 2, 3)}
        res[nm]["all"] = f(first)
        res[nm]["roll"] = [f(s) for s in range(first, last - 90, 90)]
    print(f"\n== {sym}: история {last - first + 1} дн")
    for Y in (1, 2, 3, "all"):
        m, s = res["маржа"][Y], res["без плеча"][Y]
        print(f"   {Y if Y == 'all' else str(Y) + ' г.'}: маржа {m[1] * 100:+.0f}% (ликв {int(m[0])}, запас {m[2]:.2f}) | без плеча {s[1] * 100:+.0f}% | разница {(1 + m[1]) / (1 + s[1]) * 100 - 100:+.0f}% к итогу")
    rm = np.array([x[1] for x in res["маржа"]["roll"]]); rs = np.array([x[1] for x in res["без плеча"]["roll"]])
    print(f"   старты каждые 90 дн ({len(rm)}): медиана маржа {np.median(rm) * 100:+.0f}% / без плеча {np.median(rs) * 100:+.0f}%; маржа лучше в {np.mean(rm > rs) * 100:.0f}%; ликвидаций {sum(int(x[0] > 0) for x in res['маржа']['roll'])}")
