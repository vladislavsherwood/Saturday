"""Агент 4D, круг 7: вход и выход шорта BTC — тихая вершина / перегретый фандинг вместо жадности; выход на первом страхе.
Запуск: python3 app/agent4d_loop7.py"""
import sys, os, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, BOT, c, both, fb, cycles
import numpy as np
EN = {"жадность > 75": [[c("fng", ">", 75)]], "тихая вершина (BTC<10%, альты +1,5)": [[c("qt", ">", 0.5)]],
      "широкая тихая (BTC<15%, альты +1)": [[c("btcath", "<", 15), c("oth90", ">", 1)]],
      "жадность > 75 или тихая": [[c("fng", ">", 75)], [c("qt", ">", 0.5)]],
      "фандинг 30 дн. > 2%": [[c("fund30", ">", 2)]], "жадность > 70 и BTC < 10% от макс.": [[c("fng", ">", 70), c("btcath", "<", 10)]]}
FEAR = [[c("fng", "<", 52), c("usdtd", "<", 7.6)]]
EX = {"дно или разворот (как W25)": BOT + [[c("btcr30", ">", 20)]], "первый страх или дно": BOT + FEAR,
      "страх < 40 или дно": BOT + [[c("fng", "<", 40)]], "первый страх, дно или разворот": BOT + FEAR + [[c("btcr30", ">", 20)]]}
for nm, coins in (("портфель 9", P9), ("набор B", PB)):
    B = Book(coins); A, G, _ = B.plan(W25S)
    a0, b0 = cycles(B, A, G); base = both(B, A, G)
    print(f"== {nm}: без шорта {fb(base)} | циклы {a0:+.0f}% / {b0:+.0f}%", flush=True)
    for (en, E), (ex, X) in itertools.product(EN.items(), EX.items()):
        W = B.hold(B.mask(E), B.mask(X)); W[:, 1:] = 0
        days = int((W[:, 0] > 0).sum())
        for sz in (0.10, 0.20):
            o = both(B, A, G, SHW=W * sz); a, b = cycles(B, A, G, SHW=W * sz)
            print(f"  {en:36s} | {ex:30s} {sz:.0%} (дней {days}): {o['med']:+.0f}% ({o['med'] - base['med']:+.0f}), 10% {o['p10']:+.0f}%,"
                  f" {'OK' if o['safe'] else 'ЛИКВ'} | циклы {100 * (np.log1p(a / 100) - np.log1p(a0 / 100)):+.1f}% / {100 * (np.log1p(b / 100) - np.log1p(b0 / 100)):+.1f}%", flush=True)
