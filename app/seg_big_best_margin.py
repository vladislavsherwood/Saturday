"""Круг 10: итог маржи для B65 и «список|B65» (found/seg_big-best.json) на пяти портфелях: схемы основы combo-best-margin (без плеча,
осторожная R16 + A4 ×1,25 + шорт 10%, лучшая R16 + A4 ×1,4 + шорт 20%), ставка 11% и 15%, в срок / на день позже, стресс.
Сохраняет found/seg_big-best-margin.json. Запуск: python3 app/seg_big_best_margin.py"""
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import seg_big_margin as SM  # noqa: E402  (vol180, isbig в индикаторах портфеля)
from combo_margin import Port, SETS, scheme, full, fmt, HERE  # noqa: E402

BEST = json.load(open(os.path.join(HERE, "found", "seg_big-best.json")))
CB = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
V = {"основа combo-best": {"base": CB["base"], "rules": CB["rules"]}, "B65": {"base": BEST["base"], "rules": BEST["rules"]},
     "список|B65": {"base": BEST["base"], "rules": BEST["variant_list_or_behaviour"]["rules"]}}
R = dict(lr=1.5)
CFG = [("без плеча", dict(lev=False), 0.0, False), ("ОСТОРОЖНАЯ: R16 + A4 ×1,25 (60 дн) + шорт BTC 10%", dict(D=60, lp=1.25, **R), 0.1, True),
       ("ЛУЧШАЯ: R16 + A4 ×1,4 (60 дн) + шорт BTC 20%", dict(D=60, lp=1.4, **R), 0.2, True)]
PS = {k: Port(v) for k, v in SETS.items()}
RES = {}; t = time.time()
for vn, S0 in V.items():
    for tag, kw, sh, r15 in CFG:
        S, L = scheme(S0, **kw); row = {}
        for nm, P in PS.items():
            row[nm] = full(P, S, L, sh)
            if r15:
                row[nm + " ставка 15%"] = full(P, S, L, sh, rate=0.15 / 365)
        RES[f"{vn} | {tag}"] = row
        ok = all(o["safe"] for o in row.values())
        print(f"{'OK ' if ok else '✘  '}{vn} | {tag} [{time.time() - t:.0f} с]\n" + "\n".join(f"     {nm:18s} {fmt(o)}" for nm, o in row.items()), flush=True)
S_b, L_b = scheme(V["B65"], D=60, lp=1.4, **R); S_c, L_c = scheme(V["B65"], D=60, lp=1.25, **R)
out = {"strategy": "found/seg_big-best.json (B65 поверх combo-best)",
       "scheme": "без изменений против found/combo-best-margin.json: R16 + A4 (паника без плеча, пока с максимума BTC < 60 дней) + шорт BTC; B65 меняет только продажи",
       "best_safe": {"name": "B65 + R16 + A4 ×1,4 (60 дн) + шорт BTC 20%", "rules_with_sizes": S_b, "group_leverage": {str(g): v for g, v in enumerate(L_b)}, "short_size": 0.2},
       "cautious": {"name": "B65 + R16 + A4 ×1,25 (60 дн) + шорт BTC 10%", "rules_with_sizes": S_c, "group_leverage": {str(g): v for g, v in enumerate(L_c)}, "short_size": 0.1},
       "safety": "0 ликвидаций = 105 стартов, в срок и на день позже, минимумы дня −20/−30% и максимумы +20/+30% (шорт), пять портфелей P9, B, M, P2+BTC, P3+BTC, ставки 11% и 15%",
       "sets": {k: [s for s, _ in v] for k, v in SETS.items()}, "results": RES}
json.dump(out, open(os.path.join(HERE, "found", "seg_big-best-margin.json"), "w"), ensure_ascii=False, indent=1)
print("сохранено: app/found/seg_big-best-margin.json")
