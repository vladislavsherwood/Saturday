"""Круг 6 (портфель): шорты внутри кросс-маржи 9 монет. Шорт биткоина (или каждой монеты) на доли счёта по сигналам вершины,
проценты по займу 10–20% годовых, ликвидация по максимуму дня; стресс — максимумы на 20/30% выше и минимумы ниже одновременно.
Основа — B без плеча и B с лучшей схемой плеча. Запуск: python3 app/agent_loop6.py"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent_margin import plan_of, portfolio, fmt, mask, short_state
from agent_loop0 import lev_sizes, B

c = lambda i, o, v: {"ind": i, "op": o, "v": v}                         # noqa: E731
ENTRY = {"тихая вершина": [[c("qt", ">", 0.5)]], "перегретый фандинг": [[c("fund30", ">", 2)]], "тихая вершина и фандинг > 1%": [[c("qt", ">", 0.5), c("fund30", ">", 1)]],
         "жадность > 75": [[c("fng", ">", 75)]]}
BOT = [[c("usdt", ">", 1.07), c("othd", "<", 25)], [c("fng", "<", 10)], [c("oidd30", "<", -28)]]
EXIT = {"дно или разворот BTC": (BOT + [[c("btcr30", ">", 20)]], 0), "страх или дно": ([[c("fng", "<", 52), c("usdtd", "<", 7.6)]] + BOT, 0),
        "срок 30 дн / дно": (BOT, 30), "срок 90 дн / дно": (BOT, 90)}
if __name__ == "__main__":
    A0, G0, _ = plan_of(B); A1, G1, _ = plan_of(lev_sizes(B)); LEV = (1, 2, 1.25, 2, 1)
    b0 = portfolio(A0, G0); b1 = portfolio(A1, G1, LEV)
    print("B без плеча:", fmt(b0)); print("B с плечом:", fmt(b1))
    rows = []
    for en, ecs in ENTRY.items():
        E = mask(ecs)
        for ex, (xcs, maxd) in EXIT.items():
            W = short_state(E, mask(xcs), maxd)
            for coin, cn in ((0, "BTC"), (-1, "каждой монеты")):
                for size in (0.02, 0.05, 0.1):
                    for base, (A, G, lev, ref) in (("без плеча", (A0, G0, (1,) * 5, b0)), ("с плечом", (A1, G1, LEV, b1))):
                        o = portfolio(A, G, lev, SHORT=W, sh_size=size, sh_rate=0.15 / 365, sh_coin=coin)
                        o.update(tag=f"{base}: шорт {cn} {size * 100:.0f}% счёта, вход «{en}», выход «{ex}»", d=o["med"] - ref["med"], base=base)
                        rows.append(o)
    for base in ("без плеча", "с плечом"):
        r = [o for o in rows if o["base"] == base]
        print(f"\n=== {base}: лучшие без ликвидаций и в стрессе ===")
        for o in sorted([o for o in r if o["liq"] == 0 and o["l20"] == 0 and o["l30"] == 0], key=lambda o: -o["med"])[:10]:
            print(f"  {o['d']:+5.0f} п.п. | {fmt(o)} | {o['tag']}")
        print(f"  всего схем {len(r)}, без ликвидаций и в стрессе {sum(o['liq'] == 0 and o['l20'] == 0 and o['l30'] == 0 for o in r)}, из них лучше основы по медиане {sum(o['liq'] == 0 and o['l20'] == 0 and o['l30'] == 0 and o['d'] > 0 for o in r)}")
        print("  лучшие 10% стартов / ранние / поздние у лучших безопасных — см. строку выше")
    json.dump(rows, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/loop6p.json", "w"))
