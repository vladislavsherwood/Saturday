"""Обычный взнос без плеча, плечо только на сильные сигналы (докупки из резерва). 9 монет по $2, спотовая кросс-маржа, 105 дат старта с 2018.
Запуск: python3 app/lev_strong.py"""
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lev_config import sim, C, LO, P, G, starts


def ev(lev, cap=0.0):
    lev = np.array(lev, float)
    R = [sim(C, LO, P, G, int(s), lev, False, cap, 1.0) for s in starts]
    R2 = [sim(C, LO, P, G, int(s), lev, False, cap, 0.8) for s in starts]
    f = np.array([x[1] for x in R]) * 100
    return (sum(x[0] > 0 for x in R) / len(R) * 100, sum(x[0] > 0 for x in R2) / len(R) * 100, np.median(f), np.percentile(f, 10), f.min(), min(x[2] for x in R))


b = ev([1, 1, 1, 1])
print(f"без плеча: итог медиана {b[2]:+.0f}%, худшие 10% {b[3]:+.0f}%, худший {b[4]:+.0f}%\n")
print(f"{'схема':62} | {'ликвидировано стартов':>21} | {'при минимумах −20%':>18} | {'итог':>6} | {'к без плеча':>11} | {'худшие 10%':>10} | {'худший':>6} | мин. маржа")
for title, mk in (("дно (капитуляция, волна ликвидаций)", lambda L: [1, L, 1, 1]), ("разворот биткоина", lambda L: [1, 1, 1, L]),
                  ("дно + разворот", lambda L: [1, L, 1, L]), ("дно + разворот + паника в стейблах (все докупки из резерва)", lambda L: [1, L, L, L])):
    for L in (1.5, 2.0, 3.0):
        for cap in (0.0, 0.5):
            r = ev(mk(L), cap)
            print(f"{(title + f' ×{L:g}' + (', потолок долга 50%' if cap else ''))[:62]:62} | {r[0]:20.0f}% | {r[1]:17.0f}% | {r[2]:+5.0f}% | {r[2] - b[2]:+10.0f} п.п. | {r[3]:+9.0f}% | {r[4]:+5.0f}% | {r[5]:.2f}")
    print()
