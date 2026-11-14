"""Агент 3, круг 20: итог маржи — C4 + устойчивая схема R16 + шорт BTC 10% против W25 (та же схема и схема агента 2) на P1, P2, P3;
стресс минимумов −20/−30% и максимумов +20/+30%; сохраняет found/agent3-best-margin.json. Запуск: python3 app/agent3_loop20.py"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent3_margin import W25, C4, plan_of, sized, su_sized, sim2, CC, LO as LO1, HI as HI1, fmt2, starts, idx, short_mask, c, BOT, HERE
from agent2_margin import port2
from agent3_loop15 import P, universe, plan, STARTS
from agent3_loop16 import run

R16 = (1, 2, 1.25, 1.5, 1, 1, 1, 1.25); A2 = (1, 2, 1.25, 2, 1, 1, 1, 1.25)
if __name__ == "__main__":
    W = short_mask(); years = np.array([idx[s].year for s in starts]); res = {}
    for nm, S0 in (("C4", C4), ("W25", W25)):
        S = su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1"); A, G, _ = plan_of(S)
        for sk, lev in (("R16", R16), ("агент 2", A2)):
            for sh in (0.0, 0.10):
                o = port2(A, G, lev, W=W if sh else None, sh=sh, sep=True, xs=True); x = np.array(o.pop("_x"))
                o["worst_start"] = float(x.min()); o["by_year"] = {int(y): float(np.median(x[years == y])) for y in sorted(set(years))}
                res[f"P1 {nm} {sk} шорт {int(sh * 100)}%"] = o; print(f"P1 {nm} {sk} шорт {int(sh * 100)}%: {fmt2(o)}", flush=True)
        A, G, _ = plan_of(su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1"))
        o = port2(A, G, (1,) * 8, sep=True); res[f"P1 {nm} размеры схемы без плеча"] = o; print(f"P1 {nm} размеры схемы без плеча: {fmt2(o)}")
        o = port2(*plan_of(S0)[:2], (1,) * 8, sep=True); res[f"P1 {nm} без плеча"] = o; print(f"P1 {nm} без плеча (размеры стратегии): {fmt2(o)}")
        o = port2(*plan_of(S0)[:2], (1,) * 8, W=W, sh=0.10, sep=True); res[f"P1 {nm} без плеча + шорт 10%"] = o; print(f"P1 {nm} без плеча + шорт 10%: {fmt2(o)}")
    for pn, coins in P.items():
        C, LO, HI, closes = universe(coins)
        for nm, S0 in (("C4", C4), ("W25", W25)):
            A, G, _ = plan(su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1"), coins, closes, C)
            for sk, lev in (("R16", R16), ("агент 2", A2)):
                o = run(C, LO, HI, A, G, list(lev) + [1] * 8, STARTS); res[f"{pn.split()[0]} {nm} {sk}"] = o; print(f"{pn.split()[0]} {nm} {sk}: {fmt2(o)}", flush=True)
    best = {"strategy": "found/agent3-best.json (C4 = W25 + «бета монеты к BTC за 180 дней > 1,2 и монета ниже своей средней 200 → каждая продажа ×1,5»)",
            "model": "agent2_margin.sim2: портфель монет по $2/день, кросс-маржа, ликвидация при активы/долг ≤ 1,1 по минимуму дня, заём 11% годовых; "
                     "отрицательный остаток стейблов — тоже долг; выручка шорта лежит отдельно; 105 стартов с 1-го числа месяца с 2018 г.",
            "sizes": {"дно (капитуляция страх < 10, волна ликвидаций OI −28%)": "25% резерва",
                      "паника в стейблах (и подтверждённая выносом OI, и без подтверждения)": "доли ×2: при сильном страхе 50%, при страхе 100%, без страха 100% резерва",
                      "разворот BTC (+20% за 30 дней)": "50% резерва", "отложенная покупка после выноса": "50% резерва",
                      "продажи": "как в стратегии C4: страх 16% (24% у слабой высокобетовой монеты), сильный страх 30% (45%), перегретый фандинг 5% (7,5%), "
                                 "тихая вершина 40% (60%), широкая тихая вершина 25% (37,5%)"},
            "leverage": {"обычный взнос": 1, "дно": 2, "паника (любая)": 1.25, "разворот": 1.5, "отложенная": 1},
            "leverage_note": "R16 — схема, безопасная в стрессе −20/−30% сразу на трёх портфелях (P1 исходные 9 монет, P2 крупные альты, P3 мемы). "
                             "Схема агента 2 (разворот ×2) на P1 даёт больше (+819%/+856% с шортом), но на портфеле мемов P3 — 11 ликвидаций при −30%. "
                             "Шаг назад для большего запаса — дно ×1,5 (P1 +740%, мин. активы/долг 1,84). Плечо паники ×1,5 небезопасно (круги 6, 15, 18).",
            "short": {"coin": "BTC", "size": "10% капитала счёта при открытии (20% тоже без ликвидаций, но доход шорта держится на цикле 2024–26)",
                      "entry": [[c("fng", ">", 75)]], "exit": BOT + [[c("btcr30", ">", 20)]], "borrow_rate_year": 0.15},
            "portfolios": {k: [t for _, t in v] for k, v in P.items()} | {"P1 исходные 9 монет": ["BTC", "ETH", "SOL", "HYPE", "PUMP", "DOGE", "PEPE", "ENA", "ZEC"]},
            "rules_with_sizes": su_sized(sized(C4, 0.25, 2.0, 0.5, 0.5), "K1"),
            "group_leverage": {"0": 1, "1": 2, "2": 1.25, "3": 1.5, "4": 1, "6": 1, "7": 1.25},
            "results": res}
    json.dump(best, open(os.path.join(HERE, "found", "agent3-best-margin.json"), "w"), ensure_ascii=False, indent=1)
    print("\nсохранено: app/found/agent3-best-margin.json")
