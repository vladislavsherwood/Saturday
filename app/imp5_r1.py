"""imp5, круг 1: общий резерв на все монеты (pool) и перенос выручки продаж в общий резерв (spill). Правила по монетам — combo-best.
Запуск: python3 app/imp5_r1.py"""
import json, sys
from imp5_port import *
VAR = [("основа", {}), ("spill 0.25 wm1", dict(spill=0.25, wmode=1)), ("pool 0.25 wm1", dict(pool=0.25, wmode=1))]
base = None; out = {}
for nm, opt in VAR:
    res = evalall(opt)
    if base is None: base = res
    sc = score(res, base)
    print(f"== {nm}: Σlog {sc[0]:+.3f} | min Δp10 {sc[1]:+.1f} | min Δworst {sc[2]:+.1f} | {'ok' if sc[3] else 'LIQ'}", flush=True)
    for k, o in res.items(): print(f"   {k[0]:10s} {k[1]:7s} {fm(o)}")
    out[nm] = {"|".join(k): o for k, o in res.items()}
json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp5_r1.json", "w"), ensure_ascii=False)
