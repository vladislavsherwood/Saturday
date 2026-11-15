"""imp5, круг 2: распределение общего котла между монетами по сигналу: слабость/сила к BTC (rel180), глубина просадки (dd365), бета (beta180).
Котёл: pool 1 и spill 0,25, распределение по взносам (wm1) × вес сигнала. Запуск: python3 app/imp5_r2.py"""
import json, sys
import numpy as np
from imp5_port import *


def wt(name, g):
    def f(Pt):
        X = Pt.B.series(name)
        if name == "rel180":
            W = np.exp(-g * np.clip(X, -90, 300) / 100)          # g > 0: больше слабым к BTC
        elif name == "dd365":
            W = (np.clip(X, 1, 99) / 50) ** g                       # g > 0: больше глубоко упавшим
        else:
            W = np.clip(X, 0.2, 5) ** g                             # g > 0: больше высокой бете
        W[~np.isfinite(W)] = 1.0
        return W
    return f


VAR = [("основа", {}, None)]
if len(sys.argv) > 1 and sys.argv[1] == "plateau":
    for sp in (0.25, 0.5, 1.0):
        for g in (-0.5, -1, -2):
            VAR.append((f"spill{sp} rel180 g{g}", dict(spill=sp, wmode=1), wt("rel180", g)))
    VAR.append(("spill.25 rel180 g-1 wm0", dict(spill=0.25), wt("rel180", -1)))
for base_nm, bo in () if len(sys.argv) > 1 else (("pool1", dict(pool=1.0, wmode=1)), ("spill.25", dict(spill=0.25, wmode=1))):
    VAR.append((base_nm, bo, None))
    for name, gs in (("dd365", (1, 2)), ("rel180", (1, -1)), ("beta180", (1, -1))):
        for g in gs:
            VAR.append((f"{base_nm} {name} g{g}", bo, wt(name, g)))
base = None; out = {}
for nm, opt, f in VAR:
    res = evalall(opt, f)
    if base is None: base = res
    sc = score(res, base)
    k = lambda c, p: f"{res[(c, p)]['m0']:+.0f}"
    print(f"== {nm:22s} Σlog {sc[0]:+.3f} | Δp10 {sc[1]:+.1f} | Δworst {sc[2]:+.1f} | {'ok' if sc[3] else 'LIQ'} | P9 {k('без плеча','P9')}/{k('лучшая','P9')}"
          f" B {k('без плеча','B')}/{k('лучшая','B')} M {k('без плеча','M')}/{k('лучшая','M')} P2 {k('без плеча','P2+BTC')}/{k('лучшая','P2+BTC')}"
          f" P3 {k('без плеча','P3+BTC')}/{k('лучшая','P3+BTC')} K {k('без плеча','K')}/{k('лучшая','K')} p10K {res[('без плеча','K')]['p10']:+.0f}", flush=True)
    out[nm] = {"|".join(kk): o for kk, o in res.items()}
json.dump(out, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp5_r2.json", "w"), ensure_ascii=False)
