"""Объединение, шаг 4 (портфель): для выбранного варианта по монетам (F + C1.25 + C6) — сетка схем маржи на трёх наборах монет
(портфель 9, набор B агента 4D, набор M — мемы): защита A4 с порогом 30…150 дней и плечом паники ×1,4/×1,5/×1,6, шорт BTC 0/10/15/20/25%,
исполнение в срок и на день позже, стресс минимумов −20/−30% и максимумов +20/+30%, ставка займа 11% и 15%. Плюс соседи по плечу дна/разворота.
Гипотеза: связка «A4 ×1,5 (60 дн) + шорт 20%» безопасна на всех трёх наборах при обоих сдвигах и обеих ставках; осторожная — ×1,4 + шорт 15%.
Безопасно = 0 ликвидаций на 105 стартах, в стрессе ±20/±30%, в срок и на день позже, на всех трёх наборах.
Запуск: python3 app/combo_margin2.py <cands.json> <имя кандидата> <out.json>"""
import sys, json, time
from combo_margin import Port, SETS, scheme, full, fmt

CANDS = json.load(open(sys.argv[1])); S0 = CANDS[sys.argv[2]]; out = sys.argv[3]
R = {}
PS = {k: Port(v) for k, v in SETS.items()}


def rec(tag, kw, sh, rate=0.0003):
    S, L = scheme(S0, **kw); row = {}
    for nm, P in PS.items():
        row[nm] = full(P, S, L, sh, rate)
    R[tag] = row; ok = all(o["safe"] for o in row.values())
    print(f"{'OK ' if ok else '✘  '}{tag}\n" + "\n".join(f"     {nm:3s} {fmt(o)}" for nm, o in row.items()), flush=True)
    json.dump(R, open(out, "w"), ensure_ascii=False)


t = time.time()
rec("без плеча", dict(lev=False), 0.0)
rec("без плеча + шорт 20%", dict(lev=False), 0.2)
for sh in (0.0, 0.1, 0.2):
    rec(f"плечо агента 2 + шорт {sh:.0%}", {}, sh)
for lp in (1.4, 1.5, 1.6):
    for D in (30, 45, 60, 90, 120, 150):
        for sh in ((0.0, 0.1, 0.15, 0.2, 0.25) if D == 60 and lp in (1.4, 1.5) else (0.2,)):
            rec(f"A4 D={D} ×{lp} + шорт {sh:.0%}", dict(D=D, lp=lp), sh)
for sh in (0.0, 0.2):
    for tag, kw in (("ставка 15%: A4 D=60 ×1,5", dict(D=60, lp=1.5)), ("ставка 15%: A4 D=60 ×1,4", dict(D=60, lp=1.4)), ("ставка 15%: плечо агента 2", {})):
        rec(f"{tag} + шорт {sh:.0%}", kw, sh, rate=0.15 / 365)
for tag, kw in (("дно ×1,5", dict(lb=1.5)), ("дно ×2,5", dict(lb=2.5)), ("разворот ×1,5", dict(lr=1.5)), ("разворот ×2,5", dict(lr=2.5))):
    rec(f"сосед A4 D=60 ×1,5 + шорт 20%, {tag}", dict(D=60, lp=1.5, **kw), 0.2)
rec("A4 D=60 ×1,5 + шорт 30%", dict(D=60, lp=1.5), 0.3)
print(f"[{time.time() - t:.0f} с]")
