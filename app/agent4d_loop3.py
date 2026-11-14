"""Агент 4D, круг 3: плечо по близости к дну. Плечо (минус 1) на покупках дна/паники/разворота умножается на m_lo, если монета
(или BTC) неглубоко от максимума за 365 дней, и на m_hi, если глубоко (просадка > X%). Запуск: python3 app/agent4d_loop3.py"""
import sys, os, json, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, W25L, both, fb
import numpy as np
for nm, coins in (("портфель 9", P9), ("набор B", PB)):
    B = Book(coins); A, G, _ = B.plan(W25S)
    DDc = B.series("dd365"); DDb = np.repeat(B.series("btcath")[:, :1], len(coins), 1); FNG = B.series("fng")
    base = both(B, A, G); print(f"== {nm}: схема W25 {fb(base)}", flush=True)
    res = []
    for (mn, D), X, mlo, mhi in itertools.product((("монета от макс. 365 дн.", DDc), ("BTC от максимума", DDb)), (40, 55, 70, 85), (0, 0.5, 1), (1, 1.5, 2, 2.5)):
        if mlo == 1 and mhi == 1:
            continue
        LM = np.where(D > X, mhi, mlo); LM[np.isnan(D)] = 1
        o = both(B, A, G, LEVM=LM); res.append(((mn, X, mlo, mhi), o))
    ok = sorted([x for x in res if x[1]["safe"]], key=lambda x: -x[1]["med"])
    print(f"  безопасных {len(ok)} из {len(res)}; лучшие (мера, порог X, множитель плеча неглубоко, глубоко):")
    for k, o in ok[:12]:
        print(f"    {k}: {fb(o)}", flush=True)
    bad = sorted([x for x in res if not x[1]["safe"]], key=lambda x: -x[1]["med"])[:4]
    print("  лучшие небезопасные:")
    for k, o in bad:
        print(f"    {k}: {fb(o)}", flush=True)
