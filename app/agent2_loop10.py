"""Агент 2, круг 10 (портфель): финальная проверка W25 с плечом и шортом BTC против основы — соседние схемы (плато), годы старта,
стресс минимумов −20/−30% и максимумов +20/+30%; сохраняет found/agent2-best-margin.json.
Запуск: python3 app/agent2_loop10.py <кандидаты.json>"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent2_margin import grouped, sized, plan_of, port2, fmt2, short_mask, stress_ok, safe, c, BOT, starts, idx, HERE
from agent2_loop2 import su_sized

if __name__ == "__main__":
    CANDS = json.load(open(sys.argv[1])); NB, NW = list(CANDS)[:2]
    W = short_mask()                                     # шорт BTC: вход жадность > 75, выход сигнал дна или разворот BTC
    LEV = (1, 2, 1.25, 2, 1, 1, 1, 1.25)                 # группы: 0 взнос, 1 дно, 2 паника подтв., 3 разворот, 4 продажа, 5 —, 6 отложенная, 7 паника неподтв.
    K3LEV = (1, 2, 1.25, 2, 1, 1, 1, 1)
    years = np.array([idx[s].year for s in starts]); res = {}
    def rep(tag, S, lev, sh=0.0):
        A, G, _ = plan_of(S); o = port2(A, G, lev, W=W if sh else None, sh=sh, sep=True, xs=True)
        o["by_year"] = {int(y): float(np.median(np.array(o["_x"])[years == y])) for y in sorted(set(years))}; o["worst_start"] = float(min(o["_x"])); del o["_x"]
        res[tag] = o
        print(f"{tag}:\n    {fmt2(o)} | худший старт {o['worst_start']:+.0f}%", flush=True)
        return o
    for nm in (NB, NW):
        S0 = CANDS[nm]
        rep(f"{nm} | без плеча", grouped(S0), (1,) * 8)
        rep(f"{nm} | без плеча + шорт BTC 10%", grouped(S0), (1,) * 8, 0.10)
        rep(f"{nm} | схема K3 (неподтв. паника 10% без плеча)", su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), 0.1), K3LEV)
        rep(f"{nm} | схема круга 2", su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1"), LEV)
        rep(f"{nm} | схема круга 2 + шорт BTC 10%", su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1"), LEV, 0.10)
        rep(f"{nm} | схема круга 2 + шорт BTC 20%", su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1"), LEV, 0.20)
    print("\nпо годам старта (медиана): " + " ".join(str(y) for y in sorted(set(years))))
    for k, o in res.items():
        print(f"  {k}: " + " ".join(f"{v:+.0f}%" for v in o["by_year"].values()))
    # плато: соседние схемы для W25 (шаг по одному параметру), со стрессом
    S0 = CANDS[NW]; print("\nсоседние схемы W25 (размеры: дно, паника ×, неподтв., разворот, отложенная; плечо: дно, паника, разворот, неподтв.):")
    base_cfg = dict(sb=0.25, sp=2.0, su="K1", sr=0.5, sd=0.5, lb=2, lp=1.25, lr=2, lu=1.25)
    steps = [("sb", 0.5), ("sp", 1.5), ("su", 0.1), ("sr", 0.75), ("sr", 1.0), ("sd", 0.25), ("sd", 1.0), ("lb", 1.5), ("lb", 2.5), ("lp", 1.0), ("lp", 1.5),
             ("lr", 1.5), ("lr", 2.5), ("lu", 1.0)]
    nb = []
    for k, v in [(None, None)] + steps:
        cfg = dict(base_cfg); tag = "схема круга 2"
        if k:
            cfg[k] = v; tag = f"{k} = {v}"
        A, G, _ = plan_of(su_sized(sized(S0, cfg["sb"], cfg["sp"], cfg["sr"], cfg["sd"]), cfg["su"]))
        lev = (1, cfg["lb"], cfg["lp"], cfg["lr"], 1, 1, 1, cfg["lu"])
        for sh in (0.0, 0.10):
            o = port2(A, G, lev, W=W if sh else None, sh=sh, sep=True)
            nb.append({"tag": tag, "sh": sh, **{q: o[q] for q in ("med", "p10", "liq", "lvl")}, "l20": o.get("l20"), "l30": o.get("l30")})
            print(f"  {tag:18s} {'+ шорт 10%' if sh else '          '}: {fmt2(o)}", flush=True)
    A, G, _ = plan_of(su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1"))
    best = {"strategy": "found/agent2-best.json (W25 = основа K3 + отложенная + широкая тихая вершина 25%)",
            "model": "agent2_margin.sim2: 9 монет по $2/день, кросс-маржа, ликвидация при активы/долг ≤ 1,1 по минимуму дня, заём 11% годовых; "
                     "отрицательный остаток стейблов — тоже долг; выручка шорта лежит отдельно",
            "sizes": {"дно (капитуляция страх < 10, волна ликвидаций OI −28%)": "25% резерва",
                      "паника в стейблах (и подтверждённая выносом OI, и без подтверждения)": "доли ×2: при сильном страхе 50%, при страхе 100%, без страха 100% резерва",
                      "разворот BTC (+20% за 30 дней)": "50% резерва", "отложенная покупка после выноса": "50% резерва",
                      "продажи": "как в стратегии: страх 16%, сильный страх 30%, перегретый фандинг 5%, тихая вершина 40%, широкая тихая вершина 25%"},
            "leverage": {"обычный взнос": 1, "дно": 2, "паника (любая)": 1.25, "разворот": 2, "отложенная": 1},
            "short": {"coin": "BTC", "size": "10% капитала счёта при открытии (осторожно; 15–20% безопасно по ликвидациям, но доход шорта держится на цикле 2024–26)",
                      "entry": [[c("fng", ">", 75)]], "exit": BOT + [[c("btcr30", ">", 20)]], "borrow_rate_year": 0.15},
            "rules_with_sizes": su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1"),
            "group_leverage": {"0": 1, "1": 2, "2": 1.25, "3": 2, "4": 1, "6": 1, "7": 1.25},
            "results": res, "neighbors_W25": nb}
    json.dump(best, open(os.path.join(HERE, "found", "agent2-best-margin.json"), "w"), ensure_ascii=False, indent=1)
    print("\nсохранено: app/found/agent2-best-margin.json")
