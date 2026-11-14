"""Агент 4D, круг 4: погашение долга продажей монеты на сигналах вершины/отскока и (если освободится запас) больше плеча.
REP — доля долга монеты, которую гасим продажей её же монет в день сигнала. Запуск: python3 app/agent4d_loop4.py"""
import sys, os, json, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, W25L, both, fb, c
import numpy as np, pandas as pd
for nm, coins in (("портфель 9", P9), ("набор B", PB)):
    B = Book(coins); A, G, _ = B.plan(W25S)
    up90 = np.full(B.C.shape, np.nan)
    for k in range(len(coins)):
        cl = pd.Series(B.C[:, k]); up90[:, k] = (cl / cl.rolling(90, min_periods=1).min() - 1).values * 100
    SIG = {"любая продажа стратегии": (G == 4) & (A < 0),
           "жадность > 75": B.mask([[c("fng", ">", 75)]]),
           "монета +100% от мин. 90 дн.": up90 > 100,
           "монета +50% от мин. 90 дн.": up90 > 50,
           "разворот BTC (+20% за 30 дн.)": B.mask([[c("btcr30", ">", 20)]])}
    base = both(B, A, G); print(f"== {nm}: схема W25 {fb(base)} | проценты {base['int']:.1f}%", flush=True)
    res = []
    for (sn, S), f in itertools.product(SIG.items(), (0.25, 1.0)):
        for lb, lr, lp in itertools.product((2, 2.5, 3), (2, 2.5), (1.25, 1.5)):
            L = (1, lb, lp, lr, 1, 1, 1, lp)
            o = both(B, A, G, L, REP=S * f); res.append(((sn, f, lb, lr, lp), o))
            if (lb, lr, lp) == (2, 2, 1.25):
                print(f"  {sn:30s} гасим {f:.0%}: {fb(o)} | проценты {o['int']:.1f}%", flush=True)
    ok = sorted([x for x in res if x[1]["safe"]], key=lambda x: -x[1]["med"])
    print(f"  безопасных {len(ok)} из {len(res)}; лучшие (сигнал, доля, плечо дно, разворот, паника):")
    for k, o in ok[:10]:
        print(f"    {k}: {fb(o)}", flush=True)
