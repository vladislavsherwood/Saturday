"""Объединение, шаг 7 (портфель, дополнение после агента 3): схема должна быть безопасной сразу на пяти портфелях — P9 (наши 9 монет),
B и M агента 4D, P2 (крупные альты) и P3 (мемы и дикие альты) агента 3 (+ BTC первой колонкой для шорта). Варианты по монетам:
F + C6 + C1.25, F + C6 + C4, F + C6 + max(C4 ×1,5, C ×1,25), для сравнения W25. Схемы: агента 2 (разворот ×2) и R16 агента 3 (разворот ×1,5);
защита A4 (порог 60 дней) с плечом паники ×1,25 (без подъёма), ×1,3, ×1,4; шорт BTC 10/15/20%.
Безопасно = 0 ликвидаций на 105 стартах, при минимумах −20/−30% и максимумах +20/+30%, в срок и на день позже, на всех пяти портфелях.
Гипотеза: схема агента 2 с A4 ×1,4 и шортом 20% (безопасна на P9/B/M) ломается на P3, как у агента 3; R16 + A4 держит все пять,
и подъём плеча паники с защитой A4 остаётся безопасным хотя бы до ×1,3. Запуск: python3 app/combo_margin4.py <cands4.json> <out.json>"""
import sys, json, time
from combo_margin import Port, SETS, scheme, full, fmt

CANDS = json.load(open(sys.argv[1])); out = sys.argv[2]
PS = {k: Port(v) for k, v in SETS.items()}
R = {}


def rec(tag, S0, kw, sh, sets=None, rate=0.0003):
    S, L = scheme(S0, **kw); row = {nm: full(P, S, L, sh, rate) for nm, P in PS.items() if sets is None or nm in sets}
    R[tag] = row; ok = all(o["safe"] for o in row.values()); lv = min(o["lvl"] for o in row.values())
    print(f"{'OK ' if ok else '✘  '}{tag} | мин. запас {lv:.2f}\n" + "\n".join(f"     {nm:7s} {fmt(o)}" for nm, o in row.items()), flush=True)
    json.dump(R, open(out, "w"), ensure_ascii=False)
    return ok


t = time.time()
for nm in ("W25", "F + C6 + C1.25", "F + C6 + C4", "F + C6 + max(C4 ×1,5, C ×1,25)"):
    S0 = CANDS[nm]
    rec(f"{nm} | без плеча", S0, dict(lev=False), 0.0)
    for sk, lr in (("агент 2", 2), ("R16", 1.5)):
        for lp, D in ((1.25, None), (1.25, 60), (1.3, 60), (1.4, 60)):
            for sh in ((0.0, 0.1, 0.2) if nm != "W25" else (0.1,)):
                a4 = "без A4" if D is None else f"A4 ×{lp}"
                rec(f"{nm} | {sk} | {a4} | шорт {sh:.0%}", S0, dict(D=D, lp=lp, lr=lr), sh)
print(f"[{time.time() - t:.0f} с]")
