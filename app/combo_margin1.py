"""Объединение, шаг 3 (портфель 9 монет): варианты по монетам × схемы маржи. Сначала воспроизведение цифр агентов (W25 +804/+841%, F +905%,
A4 на W25 +1171%), затем F / F + C6 / F + C1.25 (+ C6) / F + C1.5 + C6 под схемой агента 2, A4 (×1,4 и ×1,5, порог 60 дней) и шортом BTC 10/20%.
Гипотеза: выигрыши складываются — F + C поднимает медиану с плечом (продажи гасят долг раньше), A4 добавляет своё (паника), шорт — +3 п.п. на 1%,
и ни одна связка не даёт ликвидаций в стрессе. Запуск: python3 app/combo_margin1.py <cands.json> <out.json>"""
import sys, json, time
from combo_margin import Port, P9, scheme, full, fmt

CANDS = json.load(open(sys.argv[1])); out = sys.argv[2]
P = Port(P9); R = {}
for nm, S0 in CANDS.items():
    for tag, kw, sh in (("без плеча", dict(lev=False), 0.0), ("плечо агента 2", {}, 0.0), ("плечо агента 2 + шорт 10%", {}, 0.10),
                        ("A4 ×1,4", dict(D=60, lp=1.4), 0.0), ("A4 ×1,5", dict(D=60, lp=1.5), 0.0), ("A4 ×1,5 + шорт 10%", dict(D=60, lp=1.5), 0.10),
                        ("A4 ×1,5 + шорт 20%", dict(D=60, lp=1.5), 0.20), ("A4 ×1,4 + шорт 20%", dict(D=60, lp=1.4), 0.20)):
        t = time.time(); S, L = scheme(S0, **kw); o = full(P, S, L, sh); R[f"{nm} | {tag}"] = o
        print(f"{nm:16s} | {tag:26s}: {fmt(o)} [{time.time() - t:.0f} с]", flush=True)
        json.dump(R, open(out, "w"), ensure_ascii=False)
