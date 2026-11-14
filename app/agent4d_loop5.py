"""Агент 4D, круг 5: шорт ETH или корзины против лонга (хедж) вместо шорта BTC. Вход жадность > 75, выход сигнал дна или разворот BTC.
Запуск: python3 app/agent4d_loop5.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, both, fb, BOT, c, cls
import numpy as np
for nm, coins in (("портфель 9", P9), ("набор B", PB)):
    B = Book(coins); A, G, _ = B.plan(W25S); K = len(coins)
    W = B.hold(B.mask([[c("fng", ">", 75)]]), B.mask(BOT + [[c("btcr30", ">", 20)]]))
    live = ~np.isnan(B.C)
    def basket(sel, tot):
        """Доля tot делится поровну между выбранными монетами, которые торгуются в этот день (размер фиксируется на входе)."""
        w = np.zeros(B.C.shape); m = live & sel[None, :]; n = np.maximum(m.sum(1, keepdims=True), 1)
        w[m] = np.broadcast_to(tot / n, w.shape)[m]
        return W * w
    sym = [s for s, _ in coins]
    one = lambda s: np.array([x == s for x in sym])                     # noqa: E731
    big = np.array([cls(s) == "big" for s in sym]); meme = np.array([cls(s) == "meme" for s in sym]); alt = np.array([s != "BTC-USD" for s in sym])
    base = both(B, A, G); print(f"== {nm}: без шорта {fb(base)}", flush=True)
    V = [("BTC 10%", basket(one("BTC-USD"), 0.10)), ("BTC 20%", basket(one("BTC-USD"), 0.20))]
    if "ETH-USD" in sym:
        V += [("ETH 10%", basket(one("ETH-USD"), 0.10)), ("ETH 20%", basket(one("ETH-USD"), 0.20)), ("BTC 5% + ETH 5%", basket(one("BTC-USD") | one("ETH-USD"), 0.10))]
    V += [("корзина всех монет 10%", basket(np.ones(K, bool), 0.10)), ("корзина всех 20%", basket(np.ones(K, bool), 0.20)),
          ("корзина альтов 10%", basket(alt, 0.10)), ("корзина мемов 10%", basket(meme, 0.10)), ("крупные 10%", basket(big, 0.10))]
    for tag, SHW in V:
        o = both(B, A, G, SHW=SHW); o0 = B.port(A, G, SHW=SHW, stress=False)
        print(f"  {tag:24s} {fb(o)} | 2018–21 {o0['early']:+.0f}%, 2022–26 {o0['late']:+.0f}%", flush=True)
    o0 = B.port(A, G, stress=False); print(f"  {'без шорта':24s} 2018–21 {o0['early']:+.0f}%, 2022–26 {o0['late']:+.0f}%")
