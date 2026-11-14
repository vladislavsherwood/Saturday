"""Объединение, итог по портфелю: F + C1.25 + C6 (found/combo-best.json) со схемой плеча агента 2 + защита A4 (агент 4A) + шорт BTC (агент 4D).
Лучшая безопасная: A4 (паника без плеча, пока с максимума BTC < 60 дней, иначе ×1,4) + шорт BTC 20%; осторожная: A4 ×1,3 + шорт 15%.
Все цифры: три набора монет (портфель 9, набор B, набор M), исполнение в срок и на день позже, стресс −20/−30% (и +20/+30% для шорта),
ставка 11% и 15%, по годам старта, худшие 10% стартов, запас. Для сравнения — W25 и F с теми же схемами.
Сохраняет found/combo-best-margin.json. Запуск: python3 app/combo_best_margin.py"""
import os, json, time
from combo_margin import Port, SETS, scheme, full, fmt, BOT, c, HERE

BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S_best = {"base": BEST["base"], "rules": BEST["rules"]}
W25 = json.load(open(os.path.join(HERE, "found", "agent2-best.json")))
F = json.load(open(os.path.join(HERE, "found", "agent4b-best.json")))
PS = {k: Port(v) for k, v in SETS.items()}
CFG = [("без плеча", dict(lev=False), 0.0), ("без плеча + шорт BTC 20%", dict(lev=False), 0.2),
       ("плечо агента 2", {}, 0.0), ("плечо агента 2 + шорт BTC 10%", {}, 0.1), ("плечо агента 2 + шорт BTC 20%", {}, 0.2),
       ("A4 ×1,4 (60 дн)", dict(D=60, lp=1.4), 0.0), ("ЛУЧШАЯ: A4 ×1,4 (60 дн) + шорт BTC 20%", dict(D=60, lp=1.4), 0.2),
       ("ОСТОРОЖНАЯ: A4 ×1,3 (60 дн) + шорт BTC 15%", dict(D=60, lp=1.3), 0.15),
       ("A4 ×1,4 (30 дн) + шорт BTC 20%", dict(D=30, lp=1.4), 0.2), ("A4 ×1,4 (60 дн) + шорт BTC 25%", dict(D=60, lp=1.4), 0.25),
       ("отвергнута: A4 ×1,5 (60 дн)", dict(D=60, lp=1.5), 0.0), ("отвергнута: A4 ×1,5 (60 дн) + шорт BTC 20%", dict(D=60, lp=1.5), 0.2),
       ("отвергнута: A4 ×1,45 (60 дн) + шорт BTC 20%", dict(D=60, lp=1.45), 0.2), ("отвергнута: A4 ×1,4 (60 дн) + шорт BTC 30%", dict(D=60, lp=1.4), 0.3)]
RES = {}
t = time.time()
for vn, S0 in (("F + C1.25 + C6", S_best), ("F", F), ("W25", W25)):
    for tag, kw, sh in CFG:
        if vn != "F + C1.25 + C6" and tag.startswith("отвергнута: A4 ×1,4"):
            continue
        S, L = scheme(S0, **kw); row = {}
        for nm, P in PS.items():
            row[nm] = full(P, S, L, sh)
            if vn == "F + C1.25 + C6" and ("ЛУЧШАЯ" in tag or "ОСТОРОЖНАЯ" in tag or tag == "плечо агента 2"):
                row[nm + " ставка 15%"] = full(P, S, L, sh, rate=0.15 / 365)
        RES[f"{vn} | {tag}"] = row
        ok = all(o["safe"] for o in row.values())
        print(f"{'OK ' if ok else '✘  '}{vn} | {tag}\n" + "\n".join(f"     {nm:12s} {fmt(o)}" for nm, o in row.items()), flush=True)
S_safe, L_safe = scheme(S_best, D=60, lp=1.4); S_c, L_c = scheme(S_best, D=60, lp=1.3)
out = {
    "strategy": "found/combo-best.json (F + C1.25 + C6 поверх W25)",
    "model": "agent4d_margin.sim4 (= agent2_margin.sim2 с выручкой шорта отдельно): монеты по $2/день, кросс-маржа, ликвидация при активы/долг ≤ 1,1 "
             "по минимуму дня (шорт — по максимуму дня), заём стейблов 11% годовых (проверка и 15%), заём BTC 15%; 105 стартов (1-е число месяца 2018–2026); "
             "исполнение в срок и на день позже; стресс: минимумы дня −20/−30% и максимумы +20/+30% для шорта",
    "sets": {k: [s for s, _ in v] for k, v in SETS.items()},
    "best_safe": {
        "name": "плечо агента 2 + A4 ×1,4 (паника без плеча, пока с максимума BTC < 60 дней) + шорт BTC 20%",
        "sizes": {"дно (капитуляция страх < 10, волна ликвидаций OI −28%)": "25% резерва, плечо ×2",
                  "паника в стейблах (подтверждённая выносом OI и без подтверждения)": "доли W25 ×2 (при сильном страхе 50%, при страхе 100%, без страха 100% резерва; сильная паника usdt > 1,2 — до 75…100%)",
                  "паника, если с максимума BTC < 60 дней": "без плеча (×1)", "паника в остальные дни": "плечо ×1,4",
                  "разворот BTC (+20% за 30 дней)": "50% резерва, плечо ×2", "отложенная покупка после выноса": "50% резерва, без плеча",
                  "возврат после тихой вершины": "10% резерва, без плеча", "продажи": "как в combo-best.json, продают монету и гасят долг по ней в той же доле"},
        "rules_with_sizes": S_safe, "group_leverage": {str(g): v for g, v in enumerate(L_safe)},
        "group_names": {"0": "взнос / возврат", "1": "дно", "2": "паника подтверждённая", "3": "разворот BTC", "4": "продажи", "5": "паника при btcdays < 60 (без плеча)",
                        "6": "отложенная", "7": "паника без подтверждения"},
        "short": {"coin": "BTC", "size": 0.20, "entry": [[c("fng", ">", 75)]], "exit": BOT + [[c("btcr30", ">", 20)]], "borrow_rate_year": 0.15,
                  "note": "20% капитала счёта при открытии; держать до сигнала дна или разворота BTC"}},
    "cautious": {"name": "плечо агента 2 + A4 ×1,3 (60 дн) + шорт BTC 15% — два шага до края плеча паники (×1,45)",
                 "rules_with_sizes": S_c, "group_leverage": {str(g): v for g, v in enumerate(L_c)}, "short_size": 0.15},
    "new_indicators": {"btcdays": "дней с последнего исторического максимума закрытия BTC (0 в день максимума); только прошлое",
                       "rel180": BEST["indicators"]["rel180"], "ago_qt": BEST["indicators"]["ago_qt"], "up90": BEST["indicators"]["up90"], "hi90": BEST["indicators"]["hi90"]},
    "edge": "плечо паники ×1,45 и выше (при любом пороге 30–60 дней и любом шорте) — 12–24 ликвидации на наборе B при минимумах −30% (старты 2018–19, обвал марта 2020); "
            "агент 4A проверял ×1,5 только на подмножествах портфеля 9 — на наборе B ×1,5 небезопасна и для W25 и F. Шорт BTC 30% — ликвидации при ±30%.",
    "results": RES}
json.dump(out, open(os.path.join(HERE, "found", "combo-best-margin.json"), "w"), ensure_ascii=False, indent=1)
print(f"сохранено: app/found/combo-best-margin.json [{time.time() - t:.0f} с]")
