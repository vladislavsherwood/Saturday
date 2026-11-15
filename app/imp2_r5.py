"""imp2, круг 5 (портфель): доход на резерв в стейблах (0 / 4,5%) на пяти портфелях для combo-best и combo2-best — без плеча,
осторожная (R16 + A4 ×1,25 + шорт 10%) и лучшая схема маржи (R16 + A4 ×1,4 + шорт BTC 20%); в срок и на день позже, стресс −20/−30% (+20/+30% шорт).
Доход начисляется только на положительный общий остаток стейблов; заём — 11% годовых, как в основе. Правила и размеры не меняются.
Сохраняет found/imp2-best-margin.json. Запуск: python3 app/imp2_r5.py"""
import os, sys, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import combo2_margin  # noqa: F401  индикаторы сегментов (isbig/meme/isalt, vol180, b_bbwp, b_w20) для правил combo2
from imp2_pool import runp, Port, SETS, scheme, HERE

CB = json.load(open(os.path.join(HERE, "found", "combo-best.json"))); C2 = json.load(open(os.path.join(HERE, "found", "combo2-best.json")))
BASES = {"combo-best": {"base": CB["base"], "rules": CB["rules"]}, "combo2-best": {"base": C2["base"], "rules": C2["rules"]}}
CFG = [("без плеча", dict(lev=False), 0.0), ("осторожная: R16 + A4 ×1,25 + шорт BTC 10%", dict(D=60, lp=1.25, lr=1.5), 0.1),
       ("лучшая: R16 + A4 ×1,4 + шорт BTC 20%", dict(D=60, lp=1.4, lr=1.5), 0.2)]
PS = {k: Port(v) for k, v in SETS.items()}
RES = {}; t0 = time.time()
for bn, S0 in BASES.items():
    for tag, kw, sh in CFG:
        S, L = scheme(S0, **kw)
        for y in (0.0, 0.045):
            row = {}
            for nm, P in PS.items():
                o0 = runp(P, S, L, sh, 0, yld=y); o1 = runp(P, S, L, sh, 1, yld=y)
                row[nm] = {"m0": o0["med"], "m1": o1["med"], "p10": o0["p10"], "worst": float(o0["x"].min()), "lvl": min(o0["lvl"], o1["lvl"]),
                           "liq": [o0["liq"], o0.get("l20"), o0.get("l30"), o1["liq"], o1.get("l20"), o1.get("l30")]}
            key = f"{bn} | {tag} | доход на резерв {y * 100:.1f}%"; RES[key] = row
            ok = all(sum(x or 0 for x in v["liq"]) == 0 for v in row.values())
            print(("OK " if ok else "ЛИКВ ") + key + f"  ({time.time() - t0:.0f} с)")
            for nm, v in row.items():
                print(f"     {nm:8s} {v['m0']:+.0f} / {v['m1']:+.0f} | худшие 10% {v['p10']:+.0f} | худший старт {v['worst']:+.0f} | запас {min(v['lvl'], 99):.2f} | ликв {v['liq']}", flush=True)
out = {"strategy": "правила без изменений (combo-best или combo2-best) + резерв в стейблах с доходом 4,5% годовых",
       "model": "imp2_pool.simp = agent4d_margin.sim4 (pool = 0) + доход на положительный общий остаток стейблов (yld/365 в день); заём 11% годовых; 105 стартов",
       "results": RES}
json.dump(out, open(os.path.join(HERE, "found", "imp2-best-margin.json"), "w"), ensure_ascii=False, indent=1)
print("сохранено: app/found/imp2-best-margin.json")
