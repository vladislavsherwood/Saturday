"""Агент 4D, круг 1: стенд. Сверка с agent2 (W25 + схема круга 2: +804%, + шорт BTC 10%: +841%), сдвиг исполнения на день,
ставка займа 6/11/15%, второй набор монет. Запуск: python3 app/agent4d_loop1.py"""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, W25L, BOT, c, fmt, safe
import numpy as np
t0 = time.time()
for nm, coins in (("портфель 9", P9), ("набор B", PB)):
    B = Book(coins); A, G, _ = B.plan(W25S)
    W = B.hold(B.mask([[c("fng", ">", 75)]]), B.mask(BOT + [[c("btcr30", ">", 20)]])); W[:, 1:] = 0
    A0, G0, _ = B.plan({"base": 1, "rules": [r for r in W25S["rules"]]})
    print(f"== {nm}: " + ", ".join(s for s, _ in coins), flush=True)
    for tag, kw in (("без плеча", dict(lev=(1,) * 8)), ("схема W25", {}), ("схема W25 + шорт BTC 10%", dict(SHW=W * 0.10)),
                    ("схема W25 + шорт 10%, исполнение +1 день", dict(SHW=W * 0.10, lag=1)),
                    ("схема W25, ставка 6%", dict(rate=0.06 / 365)), ("схема W25, ставка 15%", dict(rate=0.15 / 365)),
                    ("схема W25 + шорт 10%, ставка 15%, +1 день", dict(SHW=W * 0.10, rate=0.15 / 365, lag=1))):
        o = B.port(A, G, **kw); print(f"  {tag:42s} {fmt(o)}", flush=True)
print(f"{time.time() - t0:.0f} c")
