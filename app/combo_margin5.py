"""Объединение, шаг 8 (портфель): край схемы R16 + A4 на пяти портфелях — плечо паники ×1,4/×1,45/×1,5, порог 30/60/90 дней, шорт BTC 20/25/30%,
ставка 15%; соседи R16 по плечу дна (×1,5/×2,5) и разворота (×1,25/×2). Варианты по монетам: F + C6 + C1.25 и F + C6 + max(C4 ×1,5, C ×1,25).
Гипотеза: край плеча паники с R16 тот же, что со схемой агента 2 (×1,45 ломает набор B: разворот ×1,5 не освобождает запас для паники),
шорт 25% ещё безопасен, 30% — нет. Запуск: python3 app/combo_margin5.py <cands4.json> <out.json>"""
import sys, json, time
from combo_margin import Port, SETS, scheme, full, fmt

CANDS = json.load(open(sys.argv[1])); out = sys.argv[2]
PS = {k: Port(v) for k, v in SETS.items()}
R = {}


def rec(tag, S0, kw, sh, rate=0.0003):
    S, L = scheme(S0, **kw); row = {nm: full(P, S, L, sh, rate) for nm, P in PS.items()}
    R[tag] = row; ok = all(o["safe"] for o in row.values()); lv = min(o["lvl"] for o in row.values())
    bad = {nm: o["liq"] for nm, o in row.items() if not o["safe"]}
    print(f"{'OK ' if ok else '✘  '}{tag} | мин. запас {lv:.2f} | " + " ".join(f"{nm} {o['m0']:+.0f}" for nm, o in row.items()) + (f" | ликв. {bad}" if bad else ""), flush=True)
    json.dump(R, open(out, "w"), ensure_ascii=False)


t = time.time()
for nm in ("F + C6 + C1.25", "F + C6 + max(C4 ×1,5, C ×1,25)"):
    S0 = CANDS[nm]
    for lp in (1.4, 1.45, 1.5):
        for D in (30, 60, 90):
            rec(f"{nm} | R16 | A4 D={D} ×{lp} | шорт 20%", S0, dict(D=D, lp=lp, lr=1.5), 0.2)
    for sh in (0.15, 0.25, 0.3):
        rec(f"{nm} | R16 | A4 D=60 ×1.4 | шорт {sh:.0%}", S0, dict(D=60, lp=1.4, lr=1.5), sh)
    for tag, kw in (("дно ×1,5", dict(lb=1.5)), ("дно ×2,5", dict(lb=2.5)), ("разворот ×1,25", dict(lr=1.25)), ("разворот ×2 (= агент 2)", dict(lr=2))):
        rec(f"{nm} | R16 сосед {tag} | A4 D=60 ×1.4 | шорт 20%", S0, dict(D=60, lp=1.4, **({"lr": 1.5} | kw)), 0.2)
    for lp, sh in ((1.4, 0.2), (1.3, 0.15), (1.25, 0.1)):
        rec(f"{nm} | ставка 15% | R16 | A4 D=60 ×{lp} | шорт {sh:.0%}", S0, dict(D=60, lp=lp, lr=1.5), sh, rate=0.15 / 365)
print(f"[{time.time() - t:.0f} с]")
