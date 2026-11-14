"""Агент 4C, круг 7 (портфель 9 монет): помогает ли правило «монета слабее BTC → продажи крупнее» портфелю без плеча, с плечом
(схема агента 2: дно 25% ×2, паника любая 50/100/100% ×1,25, разворот 50% ×2, отложенная 50% ×1) и с шортом BTC 10%; без ликвидаций в стрессе.
Гипотеза (заранее): на 9 монетах (BTC, ETH, SOL, HYPE, PUMP, DOGE, PEPE, ENA, ZEC) правило не хуже W25 по медиане и худшим 10% стартов,
0 ликвидаций при −20/−30% (и +20/+30% для шорта). Модель — agent2_margin.sim2 (port2).
Запуск: python3 app/agent4c_loop7.py <кандидаты.json> (кандидаты пишет node: W25 и варианты с условием rel90/rel180)"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import agent_margin
from agent_margin import _btc
from agent2_margin import grouped, sized, plan_of, port2, fmt2, short_mask, stress_ok
from agent2_loop2 import su_sized


def rel(w):
    def f(close, kind, I):
        btc = close if kind == "btc" else _btc.reindex(close.index, method="ffill")
        return ((close / close.shift(w)) / (btc / btc.shift(w)) - 1) * 100
    return f


for w in (90, 180):
    agent_margin.EXTRA[f"rel{w}"] = rel(w)

if __name__ == "__main__":
    CANDS = json.load(open(sys.argv[1]))
    W = short_mask()
    LEV = (1, 2, 1.25, 2, 1, 1, 1, 1.25)
    res = {}
    for nm, S0 in CANDS.items():
        for tag, S, lev, sh in (("без плеча", grouped(S0), (1,) * 8, 0.0), ("без плеча + шорт BTC 10%", grouped(S0), (1,) * 8, 0.10),
                                ("плечо (схема агента 2)", su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1"), LEV, 0.0),
                                ("плечо + шорт BTC 10%", su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1"), LEV, 0.10)):
            A, G, _ = plan_of(S)
            o = port2(A, G, lev, W=W if sh else None, sh=sh, sep=True)
            res[f"{nm} | {tag}"] = {q: o.get(q) for q in ("med", "p10", "liq", "lvl", "l20", "l30")}
            print(f"{nm} | {tag}: {fmt2(o)}", flush=True)
    json.dump(res, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
