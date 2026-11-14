"""Агент 4D, круг 8: размер шорта BTC по силе перегрева (лесенка: добавляем к шорту, когда перегрев усиливается внутри эпизода).
Вход жадность > 75, выход сигнал дна или разворот BTC (как W25). Запуск: python3 app/agent4d_loop8.py"""
import sys, os, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, BOT, c, both, fb, cycles
import numpy as np
for nm, coins in (("портфель 9", P9), ("набор B", PB)):
    B = Book(coins); A, G, _ = B.plan(W25S); K = len(coins)
    W = B.hold(B.mask([[c("fng", ">", 75)]]), B.mask(BOT + [[c("btcr30", ">", 20)]])); W[:, 1:] = 0
    on = W[:, 0] > 0
    FNG = B.series("fng")[:, 0]; SMA = B.series("sma200")[:, 0]; F30 = B.series("fund30")[:, 0]; R90 = B.series("btcr90")[:, 0]
    a0, b0 = cycles(B, A, G); base = both(B, A, G)
    print(f"== {nm}: без шорта {fb(base)}", flush=True)
    def run(tag, size):
        SHW = np.zeros(B.C.shape); SHW[:, 0] = np.where(on, size, 0.0)
        o = both(B, A, G, SHW=SHW); a, b = cycles(B, A, G, SHW=SHW); ex = SHW[:, 0][on].mean()
        da, db = 100 * (np.log1p(a / 100) - np.log1p(a0 / 100)), 100 * (np.log1p(b / 100) - np.log1p(b0 / 100))
        print(f"  {tag:40s} ср. размер {ex:.0%}: {o['med']:+.0f}% ({o['med'] - base['med']:+.0f}), 10% {o['p10']:+.0f}%, запас {o['lvl']:.2f} {'OK' if o['safe'] else 'ЛИКВ ' + str(o['liq'])}"
              f" | циклы {da:+.1f}% / {db:+.1f}% | на 10% размера: {(o['med'] - base['med']) / ex * 0.1:+.0f} п.п.", flush=True)
    for s in (0.10, 0.15, 0.20, 0.30, 0.40):
        run(f"постоянно {s:.0%}", np.full(len(on), s))
    MET = {"жадность > 85": FNG > 85, "жадность > 90": FNG > 90, "BTC/SMA200 > 1,5": SMA > 1.5, "BTC/SMA200 > 1,8": SMA > 1.8,
           "фандинг 30 дн. > 2%": F30 > 2, "BTC +50% за 90 дн.": R90 > 50}
    for (mn, M), (b0_, add) in itertools.product(MET.items(), ((0.05, 0.10), (0.10, 0.10), (0.10, 0.20))):
        run(f"{b0_:.0%} + {add:.0%} при «{mn}»", b0_ + add * np.nan_to_num(M).astype(float))
