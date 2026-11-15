"""imp10, круг 1: веса взноса на фиксированных наборах (P9 + B, M, P2, P3) — равные против капитализации, обратной волатильности,
силы к BTC, силы стратегии в прошлом, BTC ×3. Без плеча и лучшая маржа (R16 + A4 ×1,4 + шорт BTC 20%). Запуск: python3 app/imp10_r1.py"""
import sys, json, time
import numpy as np
from imp10_port import Uni, SETS, S_BEST, nolev, best_margin, DCA, HERE
import imp10_w as WW

only = sys.argv[1].split(",") if len(sys.argv) > 1 else None
RES = {}
t0 = time.time()
for nm, coins in SETS.items():
    U = Uni(coins)
    Sn, Ln = nolev(S_BEST); Sm, Lm = best_margin(S_BEST); Sd, Ld = nolev(DCA)
    An, Gn = U.plan2(Sn); Am, Gm = U.plan2(Sm); Ad, Gd = U.plan2(Sd)
    WS = {"EQ": WW.eq(U), "IVOL": WW.ivol(U), "IVOL^0.5": WW.ivol(U, pw=0.5), "CAP": WW.capw(U), "CAP^0.5": WW.capw(U, 0.5),
          "CAP^0.5 cap2": WW.capw(U, 0.5, cap=2.0), "BTCx3": WW.btcw(U, 3.0), "MOM365": WW.momw(U), "EDGE": WW.edgew(U, An), "EDGE^0.5": WW.edgew(U, An, 0.5)}
    for wn, W in WS.items():
        if only and wn not in only and wn != "EQ":
            continue
        d = U.portw(Ad, Gd, Ld, WT=W); n = U.portw(An, Gn, Ln, WT=W); m = U.portw(Am, Gm, Lm, WT=W, sh=0.2)
        row = {k: {q: o[q] for q in ("med", "p10", "early", "late")} for k, o in (("dca", d), ("nolev", n), ("margin", m))}
        row["lnmean_nolev"] = float(np.mean(np.log1p(n["x"] / 100))); row["lnmean_margin"] = float(np.mean(np.log1p(m["x"] / 100)))
        RES[f"{nm}|{wn}"] = row
        print(f"{nm:7s} {wn:13s} DCA {d['med']:+6.0f}/{d['p10']:+5.0f} | без плеча {n['med']:+6.0f}/{n['p10']:+5.0f} (18–21 {n['early']:+7.0f}, 22–26 {n['late']:+5.0f}) "
              f"| маржа {m['med']:+6.0f}/{m['p10']:+5.0f} (22–26 {m['late']:+5.0f}) ln {row['lnmean_margin']:.3f}", flush=True)
json.dump(RES, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp10_r1.json", "w"), indent=1)
print(f"[{time.time() - t0:.0f} с]")
