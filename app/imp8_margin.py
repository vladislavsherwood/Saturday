"""imp8: портфель с маржой для упрощённых вариантов (S2 — 23 правила, тождественна основе по монетам; S2o — S2 + oth90 > 0,9;
S3a — S2 без узкой тихой вершины) против основы combo-best на пяти портфелях: без плеча, осторожная и лучшая схемы combo-best-margin
(R16 + A4 ×1,25 + шорт 10%; R16 + A4 ×1,4 + шорт 20%), в срок и на день позже, стресс −20/−30% (+20/+30% для шорта).
Запуск: python3 app/imp8_margin.py <variants.json> <out.json>"""
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_margin import Port, SETS, scheme, full, fmt, HERE

BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
V = {"основа combo-best": {"base": BEST["base"], "rules": BEST["rules"]}}
V.update(json.load(open(sys.argv[1])))
PS = {k: Port(v) for k, v in SETS.items()}
R = dict(lr=1.5)
CFG = [("без плеча", dict(lev=False), 0.0), ("ОСТОРОЖНАЯ: R16 + A4 ×1,25 + шорт 10%", dict(D=60, lp=1.25, **R), 0.1),
       ("ЛУЧШАЯ: R16 + A4 ×1,4 + шорт 20%", dict(D=60, lp=1.4, **R), 0.2)]
RES = {}; t = time.time()
for vn, S0 in V.items():
    for tag, kw, sh in CFG:
        S, L = scheme(S0, **kw); row = {nm: full(P, S, L, sh) for nm, P in PS.items()}
        RES[f"{vn} | {tag}"] = row
        ok = all(o["safe"] for o in row.values())
        print(f"{'OK ' if ok else '✘  '}{vn} | {tag} [{time.time() - t:.0f} с]\n" + "\n".join(f"     {nm:8s} {fmt(o)}" for nm, o in row.items()), flush=True)
json.dump(RES, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
