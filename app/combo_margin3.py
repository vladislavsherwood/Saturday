"""Объединение, шаг 5 (портфель): уточнение края. Шаг 4 показал, что A4 ×1,5 (агент 4A проверял только подмножества портфеля 9) на наборе B
агента 4D даёт 24 ликвидации при минимумах −30% (запас 1,35–1,39), а ×1,4 безопасна везде. Здесь: (а) то же для W25 и F — это свойство схемы,
а не правил C; (б) сетка плеча паники ×1,3/×1,35/×1,4/×1,45 × порог 30/45/60 дней × шорт 15…30% на трёх наборах, обе ставки, оба сдвига.
Гипотеза: край плеча паники — ×1,4 на всех наборах; лучшая безопасная — ×1,4 с порогом 30–45 дней и шортом 20–25%; осторожная — ×1,3–1,4 с шортом 15%
и запасом ≥ 1,6 на всех наборах. Запуск: python3 app/combo_margin3.py <cands.json> <out.json>"""
import sys, json, time
from combo_margin import Port, SETS, scheme, full, fmt

CANDS = json.load(open(sys.argv[1])); out = sys.argv[2]
R = {}
PS = {k: Port(v) for k, v in SETS.items()}


def rec(tag, S0, kw, sh, rate=0.0003):
    S, L = scheme(S0, **kw); row = {nm: full(P, S, L, sh, rate) for nm, P in PS.items()}
    R[tag] = row; ok = all(o["safe"] for o in row.values())
    lv = min(o["lvl"] for o in row.values())
    print(f"{'OK ' if ok else '✘  '}{tag} | мин. запас {lv:.2f}\n" + "\n".join(f"     {nm:3s} {fmt(o)}" for nm, o in row.items()), flush=True)
    json.dump(R, open(out, "w"), ensure_ascii=False)


t = time.time()
for nm in ("W25", "F"):
    rec(f"{nm}: A4 D=60 ×1,5", CANDS[nm], dict(D=60, lp=1.5), 0.0)
    rec(f"{nm}: A4 D=60 ×1,4", CANDS[nm], dict(D=60, lp=1.4), 0.0)
S0 = CANDS["F + C1.25 + C6"]
for lp in (1.3, 1.35, 1.4, 1.45):
    for D in (30, 45, 60):
        for sh in (0.15, 0.2, 0.25, 0.3):
            rec(f"F + C1.25 + C6: A4 D={D} ×{lp} + шорт {sh:.0%}", S0, dict(D=D, lp=lp), sh)
for lp, D, sh in ((1.4, 30, 0.2), (1.4, 30, 0.25), (1.4, 45, 0.2), (1.4, 45, 0.25), (1.4, 60, 0.15), (1.4, 60, 0.2), (1.3, 60, 0.15), (1.35, 60, 0.15)):
    rec(f"ставка 15%: F + C1.25 + C6: A4 D={D} ×{lp} + шорт {sh:.0%}", S0, dict(D=D, lp=lp), sh, rate=0.15 / 365)
print(f"[{time.time() - t:.0f} с]")
