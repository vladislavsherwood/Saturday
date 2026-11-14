"""Агент 4D, круг 6 (доп.): шорты по циклам — старты 2018–20 с итогом на конец 2021, старты 2022–26 с итогом сейчас (худший из сдвигов)."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, BOT, c, cls, cycles
import numpy as np
for nm, coins in (("портфель 9", P9), ("набор B", PB)):
    B = Book(coins); A, G, _ = B.plan(W25S); sym = [s for s, _ in coins]
    W = B.hold(B.mask([[c("fng", ">", 75)]]), B.mask(BOT + [[c("btcr30", ">", 20)]])); live = ~np.isnan(B.C)
    def basket(sel, tot):
        w = np.zeros(B.C.shape); m = live & sel[None, :]; n = np.maximum(m.sum(1, keepdims=True), 1)
        w[m] = np.broadcast_to(tot / n, w.shape)[m]; return W * w
    a0, b0 = cycles(B, A, G); print(f"== {nm}: без шорта: цикл 2018–21 {a0:+.0f}%, 2022–26 {b0:+.0f}%")
    for tag, sel, tot in (("BTC 10%", np.array([s == "BTC-USD" for s in sym]), 0.10), ("BTC 20%", np.array([s == "BTC-USD" for s in sym]), 0.20),
                          ("мемы 10%", np.array([cls(s) == "meme" for s in sym]), 0.10), ("все 10%", np.ones(len(sym), bool), 0.10)):
        a, b = cycles(B, A, G, SHW=basket(sel, tot)); print(f"  {tag:10s} 2018–21 {a:+.0f}% ({a - a0:+.0f} п.п.), 2022–26 {b:+.0f}% ({b - b0:+.0f} п.п.)", flush=True)
