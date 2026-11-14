"""Объединение 2, итог по портфелю: выбранный вариант (found/combo2-best.json: combo-best + A1 + AS + CM2 + список|B65) со схемами маржи
combo-best-margin.json без изменений (R16 + A4 + шорт BTC). Пять портфелей (P9, B, M, P2+BTC, P3+BTC), в срок и на день позже, стресс −20/−30%
(+20/+30% для шорта), ставки 11% и 15%; для сравнения — основа combo-best с теми же схемами; край A4 ×1,45.
Флаги монет (isbig/meme/isalt по единым спискам) и vol180 — из combo2_margin.py. Сохраняет found/combo2-best-margin.json.
Запуск: python3 app/combo2_best_margin.py"""
import os, json, time
import numpy as np
import combo2_margin as CM  # noqa: F401  индикаторы и флаги
from combo_margin import Port, SETS, scheme, full, fmt, BOT, c, HERE, YEARS  # noqa: F401

BEST = json.load(open(os.path.join(HERE, "found", "combo2-best.json")))
OLD = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S_new = {"base": BEST["base"], "rules": BEST["rules"]}
S_old = {"base": OLD["base"], "rules": OLD["rules"]}
PS = {k: Port(v) for k, v in SETS.items()}
R = dict(lr=1.5)
CFG = [("без плеча", dict(lev=False), 0.0), ("без плеча + шорт BTC 20%", dict(lev=False), 0.2),
       ("ОСТОРОЖНАЯ: R16 + A4 ×1,25 (60 дн) + шорт BTC 10%", dict(D=60, lp=1.25, **R), 0.1),
       ("СРЕДНЯЯ: R16 + A4 ×1,3 (60 дн) + шорт BTC 15%", dict(D=60, lp=1.3, **R), 0.15),
       ("ЛУЧШАЯ: R16 + A4 ×1,4 (60 дн) + шорт BTC 20%", dict(D=60, lp=1.4, **R), 0.2),
       ("отвергнута (край): R16 + A4 ×1,45 + шорт BTC 20%", dict(D=60, lp=1.45, **R), 0.2)]
RES = {}; t = time.time()
for vn, S0 in (("combo2 (A1 + AS + CM2 + список|B65)", S_new), ("основа combo-best", S_old)):
    for tag, kw, sh in CFG:
        S, L = scheme(S0, **kw); row = {}
        for nm, P in PS.items():
            row[nm] = full(P, S, L, sh)
            if kw.get("lev", True) is not False:
                row[nm + " ставка 15%"] = full(P, S, L, sh, rate=0.15 / 365)
        RES[f"{vn} | {tag}"] = row
        ok = all(o["safe"] for o in row.values())
        print(f"{'OK ' if ok else '✘  '}{vn} | {tag} [{time.time() - t:.0f} с]\n" + "\n".join(f"     {nm:20s} {fmt(o)}" for nm, o in row.items()), flush=True)
OM = json.load(open(os.path.join(HERE, "found", "combo-best-margin.json")))
S_b, L_b = scheme(S_new, D=60, lp=1.4, **R); S_m, L_m = scheme(S_new, D=60, lp=1.3, **R); S_c, L_c = scheme(S_new, D=60, lp=1.25, **R)
lev = lambda L: {str(g): v for g, v in enumerate(L)}  # noqa: E731
key = "combo2 (A1 + AS + CM2 + список|B65) | "
safe_all = {tag: all(o["safe"] for o in RES[key + tag].values()) for tag, _, _ in CFG}
out = {
    "strategy": "found/combo2-best.json (combo-best + A1 + AS + CM2 + список|B65)",
    "safety_rule": OM["safety_rule"] + "; 0 ликвидаций обязательно",
    "model": OM["model"],
    "sets": {k: [s for s, _ in v] for k, v in SETS.items()},
    "segments_in_sets": {k: {s: CM.seg(CM.name(s)) for s, _ in v} for k, v in SETS.items()},
    "best_safe": {**{k: v for k, v in OM["best_safe"].items() if k not in ("rules_with_sizes", "group_leverage")},
                  "rules_with_sizes": S_b, "group_leverage": lev(L_b)},
    "middle": {"name": OM["middle"]["name"], "rules_with_sizes": S_m, "group_leverage": lev(L_m), "short_size": 0.15},
    "cautious": {"name": OM["cautious"]["name"], "rules_with_sizes": S_c, "group_leverage": lev(L_c), "short_size": 0.10},
    "note": "Схема плеча не менялась: новые правила только меняют доли продаж (группа 4), продажа гасит долг по монете в той же доле. "
            "AS (альтсезон) — тоже продажа (группа 4). Новые индикаторы портфеля: isbig, meme, isalt (списки), corr180, vol180.",
    "safe_all_five": safe_all,
    "edge": "R16 + A4 ×1,45 + шорт 20% — ликвидации на наборе B и P2 при −30% (как у основы); ×1,4 — 0 ликвидаций",
    "results": RES,
}
json.dump(out, open(os.path.join(HERE, "found", "combo2-best-margin.json"), "w"), ensure_ascii=False, indent=1, default=float)
print("сохранено: app/found/combo2-best-margin.json", safe_all)
