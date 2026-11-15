"""imp5, круг 3: ребалансировка долей монет (раз в месяц / квартал) и потолок доли одной монеты — поверх основы и поверх S1 (круг 2).
Запуск: python3 app/imp5_r3.py"""
import json
from imp5_port import *
VAR = [("основа", {}, None), ("S1", *S1)]
for nm0, (o0, f0) in (("основа", ({}, None)), ("S1", S1)):
    for RB in (30, 91):
        for rho in (0.5, 1.0):
            VAR.append((f"{nm0} + ребаланс {RB} дн ρ{rho}", {**o0, "RB": RB, "rho": rho}, f0))
    for cap in (0.25, 0.35, 0.5):
        VAR.append((f"{nm0} + потолок {cap}", {**o0, "cap": cap}, f0))
base = None; out = {}
for nm, opt, f in VAR:
    res = evalall(opt, f)
    if base is None: base = res
    sc = score(res, base)
    k = lambda c, p: f"{res[(c, p)]['m0']:+.0f}"
    print(f"== {nm:28s} Σlog {sc[0]:+.3f} | Δp10 {sc[1]:+.1f} | Δworst {sc[2]:+.1f} | {'ok' if sc[3] else 'LIQ'} | P9 {k('без плеча','P9')}/{k('лучшая','P9')}"
          f" B {k('без плеча','B')}/{k('лучшая','B')} M {k('без плеча','M')}/{k('лучшая','M')} P2 {k('без плеча','P2+BTC')}/{k('лучшая','P2+BTC')}"
          f" P3 {k('без плеча','P3+BTC')}/{k('лучшая','P3+BTC')} K {k('без плеча','K')}/{k('лучшая','K')} p10K {res[('без плеча','K')]['p10']:+.0f}", flush=True)
    out[nm] = {"|".join(kk): o for kk, o in res.items()}
json.dump(out, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp5_r3.json", "w"), ensure_ascii=False)
