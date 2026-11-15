"""imp5, круг 4: мягкая ребалансировка с полосой поверх S1 — обмен только у монет, отклонившихся от равной доли в band раз.
Запуск: python3 app/imp5_r4.py"""
import json
from imp5_port import *
VAR = [("основа", {}, None), ("S1", *S1), ("S1 + RB91 ρ0.25", {**S1[0], "RB": 91, "rho": 0.25}, S1[1])]
import sys
if len(sys.argv) > 1:
    VAR = [("основа", {}, None)] + [(f"S1 + RB{RB} ρ{rho}", {**S1[0], "RB": RB, "rho": rho}, S1[1]) for RB in (30, 91, 182) for rho in (0.1, 0.25)]
for RB in (() if len(sys.argv) > 1 else (91, 182, 365)):
    for band in (2.0, 3.0):
        for rho in (0.5, 1.0):
            VAR.append((f"S1 + RB{RB} полоса ×{band:g} ρ{rho}", {**S1[0], "RB": RB, "rho": rho, "band": band}, S1[1]))
base = None; out = {}
for nm, opt, f in VAR:
    res = evalall(opt, f)
    if base is None: base = res
    sc = score(res, base); s1 = out.get("S1")
    k = lambda c, p: f"{res[(c, p)]['m0']:+.0f}"
    print(f"== {nm:28s} Σlog {sc[0]:+.3f} | Δp10 {sc[1]:+.1f} | Δworst {sc[2]:+.1f} | {'ok' if sc[3] else 'LIQ'} | P9 {k('без плеча','P9')}/{k('лучшая','P9')}"
          f" B {k('без плеча','B')}/{k('лучшая','B')} M {k('без плеча','M')}/{k('лучшая','M')} P2 {k('без плеча','P2+BTC')}/{k('лучшая','P2+BTC')}"
          f" P3 {k('без плеча','P3+BTC')}/{k('лучшая','P3+BTC')} K {k('без плеча','K')}/{k('лучшая','K')} p10K {res[('без плеча','K')]['p10']:+.0f}"
          f" p10P9 {res[('без плеча','P9')]['p10']:+.0f}", flush=True)
    out[nm] = {"|".join(kk): o for kk, o in res.items()}
json.dump(out, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp5_r4" + ("b" if len(sys.argv) > 1 else "") + ".json", "w"), ensure_ascii=False)
