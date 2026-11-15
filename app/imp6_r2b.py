"""imp6, круг 2б: безопасное плечо паники при исполнении −1/0/+1 день для основы и для размазывания 50/50 (паника+дно+продажи)."""
import time
import numpy as np
from imp6_common import LP, SETS, BEST, run5, scheme

t = time.time()
PS = {k: LP(v) for k, v in SETS.items()}
S0 = {"base": BEST["base"], "rules": BEST["rules"]}
SPLIT = [1 if g in (1, 2, 5, 7, 4) else 0 for g in range(8)]
import sys
for lp in [float(x) for x in sys.argv[1:]] or (1.4, 1.3, 1.25, 1.2):
    S, L = scheme(S0, D=60, lp=lp, lr=1.5)
    for tag, WT, SPL, shw in (("основа", (1.0,), [0] * 8, 0.2), ("50/50", (0.5, 0.5), SPLIT, 0.2)):
        out = []
        for nm, P in PS.items():
            ms, bad, lv = [], [], 9
            for lag in (-1, 0, 1):
                A, G = P.mats(S, all_lag=lag)
                o = run5(P, A, G, L, shw, sh_lag=lag, WT=WT, SPL=SPL)
                ms.append(o["med"]); lv = min(lv, o["lvl"])
                if o["liq"] or o.get("l20") or o.get("l30"): bad.append((lag, o["liq"], o.get("l20"), o.get("l30")))
            out.append(f"{nm} {ms[0]:+.0f}/{ms[1]:+.0f}/{ms[2]:+.0f} ср {np.mean(ms):+.0f} {'ЛИКВ ' + str(bad) if bad else 'ok'} {lv:.2f}")
        print(f"паника ×{lp} {tag:7s} | " + " | ".join(out), f"[{time.time() - t:.0f} с]", flush=True)
