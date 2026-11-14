"""Агент 4D, круг 4 (доп.): погашение долга монеты из её резерва (без продажи монет) на продажах стратегии и на любом дне."""
import sys, os, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, both, fb
import numpy as np
for nm, coins in (("портфель 9", P9), ("набор B", PB)):
    B = Book(coins); A, G, _ = B.plan(W25S); print(f"== {nm}", flush=True)
    for sn, S in (("на продажах стратегии", (G == 4) & (A < 0)), ("каждый день", np.ones(A.shape, bool))):
        for f, lb in itertools.product((0.25, 1.0), (2, 2.5)):
            o = both(B, A, G, (1, lb, 1.25, 2, 1, 1, 1, 1.25), REP=-(S * f)); print(f"  из резерва {sn:22s} {f:.0%}, дно ×{lb}: {fb(o)} | проценты {o['int']:.1f}%", flush=True)
