"""Агент 4D, круг 10: финальная проверка. W25 + схема плеча круга 2 агента 2 + шорт BTC 10% (W25) против шорта 15/20/25/30% и 0%:
три набора монет, оба сдвига исполнения, стресс ±20/±30%, ставка 15%, худшие 10% стартов, по годам старта, худший старт.
Сохраняет found/agent4d-best.json (правила W25 без изменений) и found/agent4d-best-margin.json. Запуск: python3 app/agent4d_loop10.py"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, W25L, BOT, c, both, fb, cycles, IDX, STARTS, HERE
from agent2_margin import grouped
import numpy as np
PM = [("BTC-USD", "btc"), ("DOGE-USD", "alt"), ("SHIB-USD", "alt"), ("PEPE24478-USD", "alt"), ("WIF-USD", "alt"), ("BONK-USD", "alt"), ("FLOKI-USD", "alt"),
      ("FARTCOIN-USD", "alt"), ("ETH-USD", "alt")]
W25 = json.load(open(os.path.join(HERE, "found", "agent2-best.json")))
years = np.array([IDX[s].year for s in STARTS]); RES = {}
for nm, coins in (("портфель 9", P9), ("набор B", PB), ("набор M (мемы)", PM)):
    B = Book(coins); A, G, _ = B.plan(W25S); A0, G0, _ = B.plan(grouped(W25))
    W = B.hold(B.mask([[c("fng", ">", 75)]]), B.mask(BOT + [[c("btcr30", ">", 20)]])); W[:, 1:] = 0
    print(f"== {nm}", flush=True); R = RES[nm] = {}
    for tag, AA, GG, lev, sh in (("без плеча", A0, G0, (1,) * 8, 0), ("без плеча + шорт BTC 20%", A0, G0, (1,) * 8, 0.2), ("схема W25 без шорта", A, G, W25L, 0),
                                 ("схема W25 + шорт 10% (W25)", A, G, W25L, 0.1), ("схема W25 + шорт 15%", A, G, W25L, 0.15),
                                 ("схема W25 + шорт 20%", A, G, W25L, 0.2), ("схема W25 + шорт 25%", A, G, W25L, 0.25), ("схема W25 + шорт 30%", A, G, W25L, 0.3)):
        SHW = W * sh if sh else None
        o0 = B.port(AA, GG, lev, SHW=SHW, xs=True); o = both(B, AA, GG, lev, SHW=SHW); o15 = both(B, AA, GG, lev, SHW=SHW, rate=0.15 / 365)
        a, b = cycles(B, AA, GG, lev, SHW=SHW); x = np.array(o0["_x"])
        by = {int(y): float(np.median(x[years == y])) for y in sorted(set(years))}
        R[tag] = {"в срок": {k: o0[k] for k in ("med", "p10", "lvl", "liq", "l20", "l30")}, "худший из сдвигов": {k: o[k] for k in ("med", "p10", "m0", "m1", "lvl", "safe")},
                  "ставка 15%": {k: o15[k] for k in ("med", "p10", "safe")}, "циклы": [a, b], "по годам старта": by, "худший старт": float(x.min())}
        print(f"  {tag:28s} в срок {o0['med']:+.0f}% / 10% {o0['p10']:+.0f}% | {fb(o)} | ставка 15%: {o15['med']:+.0f}% {'OK' if o15['safe'] else 'ЛИКВ'}"
              f" | циклы {a:+.0f}% / {b:+.0f}% | худший старт {x.min():+.0f}%", flush=True)
        print("     по годам старта: " + " ".join(f"{y}:{v:+.0f}%" for y, v in by.items()), flush=True)
json.dump(W25, open(os.path.join(HERE, "found", "agent4d-best.json"), "w"), ensure_ascii=False, indent=1)
best = {"strategy": "found/agent4d-best.json = W25 (found/agent2-best.json) без изменений правил",
        "model": "agent4d_margin.sim4 (= agent2_margin.sim2 с выручкой шорта отдельно): 9 монет по $2/день, кросс-маржа, ликвидация при активы/долг ≤ 1,1 "
                 "по минимуму дня (шорт — по максимуму), заём стейблов 11% годовых, заём BTC 15%; проверка на исполнении в срок и на день позже",
        "leverage": {"обычный взнос": 1, "дно": 2, "паника (любая)": 1.25, "разворот": 2, "отложенная": 1},
        "sizes": "как в found/agent2-best-margin.json: дно 25%, паника 50/100/100%, разворот 50%, отложенная 50% резерва",
        "rules_with_sizes": W25S, "group_leverage": {"0": 1, "1": 2, "2": 1.25, "3": 2, "4": 1, "6": 1, "7": 1.25},
        "short": {"coin": "BTC", "size": "20% капитала счёта при открытии (W25: 10%); граница безопасности — 40% (1 ликвидация при ±30%)",
                  "entry": [[c("fng", ">", 75)]], "exit": BOT + [[c("btcr30", ">", 20)]], "borrow_rate_year": 0.15,
                  "note": "весь бычий период 2019 – середина 2021 шорт в минусе (до −3,5…−4,5% итога при 20%), с конца 2021 в плюсе на всех горизонтах"},
        "rejected": ["плечо по классам монет (BTC/ETH больше, мемы меньше)", "плечо по глубине просадки", "погашение долга на сигналах вершины/отскока",
                     "шорт ETH/корзины альтов (хуже BTC)", "шорт корзины мемов (ставка на 2024–26, DOGE 04.2021 −35% счёта, 15% — ликвидации)",
                     "шорт по тихой вершине / выход на первом страхе", "размер шорта по силе перегрева (лесенки)"],
        "results": RES}
json.dump(best, open(os.path.join(HERE, "found", "agent4d-best-margin.json"), "w"), ensure_ascii=False, indent=1)
print("сохранено: app/found/agent4d-best.json, app/found/agent4d-best-margin.json")
