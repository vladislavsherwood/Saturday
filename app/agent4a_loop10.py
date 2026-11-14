"""Агент 4A, круг 10 (портфель): финальная проверка и сохранение схемы маржи found/agent4a-best-margin.json.
Схема: W25 (found/agent2-best.json) с размерами агента 2 (дно 25% ×2, паника 50/100/100%, разворот 50% ×2, отложенная 50% без плеча), но
паника (любая) покупается БЕЗ плеча, пока с максимума BTC прошло < 60 дней (молодой медвежий рынок — дно ещё впереди), а в остальные дни
с плечом ×1,5 (вместо ×1,25). Проверки: по годам старта, худший старт, соседние схемы, стресс −20/−30% (и +20/+30% для шорта), шорт BTC 10/20%.
Запуск: python3 app/agent4a_loop10.py"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4a_loop7 import W25, LEV, base_scheme, split, plan_of, port2, fmt2, c, HERE
from agent2_margin import starts, idx, short_mask, BOT

years = np.array([idx[s].year for s in starts])
if __name__ == "__main__":
    W = short_mask(); res = {}
    def rep(tag, S, lev, sh=0.0):
        A, G, _ = plan_of(S); o = port2(A, G, tuple(lev), W=W if sh else None, sh=sh, sep=True, xs=True)
        x = np.array(o.pop("_x")); o["by_year"] = {int(y): float(np.median(x[years == y])) for y in sorted(set(years))}; o["worst_start"] = float(x.min())
        res[tag] = o; print(f"{tag}: {fmt2(o)} | худший старт {o['worst_start']:+.0f}%", flush=True); return o
    B = base_scheme(W25)
    def guard(D=60, lp=1.5):
        L = list(LEV); L[2] = lp; L[7] = lp; L[5] = 1.0
        return split(B, c("btcdays", "<", D), 5, 1.0), L
    G, L = guard()
    rep("W25, схема агента 2 (паника ×1,25)", B, LEV)
    rep("W25, схема агента 2 + шорт BTC 10%", B, LEV, 0.10)
    rep("A4: < 60 дн паника без плеча, иначе ×1,5", G, L)
    rep("A4 + шорт BTC 10%", G, L, 0.10)
    rep("A4 + шорт BTC 20%", G, L, 0.20)
    Gc, Lc = guard(60, 1.4); rep("A4 осторожный: < 60 дн без плеча, иначе ×1,4", Gc, Lc)
    print("\nпо годам старта (медиана):")
    for k, o in res.items(): print(f"  {k}: " + " ".join(f"{y}:{v:+.0f}%" for y, v in o["by_year"].items()))
    print("\nсоседи A4 (по одному шагу):")
    nb = []
    for tag, (D, lp, lb, lr) in {"порог 45 дн": (45, 1.5, 2, 2), "порог 90 дн": (90, 1.5, 2, 2), "паника ×1,4": (60, 1.4, 2, 2), "паника ×1,6": (60, 1.6, 2, 2),
                                  "дно ×1,5": (60, 1.5, 1.5, 2), "дно ×2,5": (60, 1.5, 2.5, 2), "разворот ×1,5": (60, 1.5, 2, 1.5), "разворот ×2,5": (60, 1.5, 2, 2.5)}.items():
        S, L2 = guard(D, lp); L2[1] = lb; L2[3] = lr
        A, Gr, _ = plan_of(S); o = port2(A, Gr, tuple(L2), sep=True); nb.append({"tag": tag, **{q: o.get(q) for q in ("med", "p10", "liq", "l20", "l30", "lvl")}})
        print(f"  {tag:14s}: {fmt2(o)}", flush=True)
    S_out = G
    best = {"strategy": "found/agent2-best.json (W25) — правила покупок/продаж по монетам без изменений; agent4a-best.json — то же",
            "model": "agent2_margin.sim2: 9 монет по $2/день, кросс-маржа, ликвидация при активы/долг ≤ 1,1 по минимуму дня, заём 11% годовых, 105 стартов",
            "idea": "Плечо на панике опасно только в молодом медвежьем рынке (дно ещё впереди: май 2021, ноябрь 2025). Пока с максимума BTC прошло < 60 дней, "
                    "панику покупать без плеча; в остальные дни плечо паники ×1,5 вместо ×1,25. Без плеча правило ничего не меняет.",
            "new_indicator": {"btcdays": "дней с последнего исторического максимума цены закрытия BTC (0 в день максимума); считается только по прошлому"},
            "sizes": {"дно (капитуляция страх < 10, волна ликвидаций OI −28%)": "25% резерва",
                      "паника в стейблах (и подтверждённая выносом OI, и без подтверждения)": "доли ×2: при сильном страхе 50%, при страхе 100%, без страха 100% резерва",
                      "разворот BTC (+20% за 30 дней)": "50% резерва", "отложенная покупка после выноса": "50% резерва",
                      "продажи": "как в W25: страх 16%, сильный страх 30%, перегретый фандинг 5%, тихая вершина 40%, широкая тихая вершина 25%"},
            "leverage": {"обычный взнос": 1, "дно": 2, "паника, если с максимума BTC ≥ 60 дней": 1.5, "паника, если с максимума BTC < 60 дней": 1,
                         "разворот": 2, "отложенная": 1},
            "cautious": "паника ×1,4 вместо ×1,5 — запас мин. активы/долг 1,67 как у W25",
            "short": {"coin": "BTC", "size": "10% капитала счёта (как у агента 2)", "entry": [[c("fng", ">", 75)]], "exit": BOT + [[c("btcr30", ">", 20)]], "borrow_rate_year": 0.15},
            "rules_with_sizes": S_out, "group_leverage": {str(g): v for g, v in enumerate(L)},
            "results": res, "neighbors": nb}
    json.dump(best, open(os.path.join(HERE, "found", "agent4a-best-margin.json"), "w"), ensure_ascii=False, indent=1)
    print("\nсохранено: app/found/agent4a-best-margin.json")
