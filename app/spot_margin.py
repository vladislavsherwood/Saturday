"""Спотовая кросс-маржа ×3: на долю s каждой покупки берётся плечо (покупаем на 3·s·v, долг 2·s·v), остальные (1−s)·v лежат на счёте залогом.
Залог — все монеты и все деньги счёта (резерв стратегии тоже). Проценты по займу 0,03% в день (~11% годовых).
Ликвидация, как на Binance: уровень маржи = все активы / долг ≤ 1,1 (проверка по минимуму дня). Всё продаётся, долг гасится, остаток остаётся на счёте.
Основная стратегия по каждой монете, $10 в день делится по долям монет. Старт с первого числа каждого месяца с 2018 года.
Запуск: python3 app/spot_margin.py"""
import sys, os
import numpy as np
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cross_lev import C, LO, P, starts, idx, T

RATE, ML, FEE = 0.0003, 1.1, 0.001


@njit(cache=True)
def sim(C, LO, P, s0, w, s, L, stress, hyb=0.0, rate=RATE):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K)
    side = 0.0; inv = 0.0; liq = 0; worst = 1e9
    for t in range(s0, n):
        tot = 0.0
        for k in range(K):
            if not np.isnan(C[t, k]):
                tot += w[k]
        for k in range(K):
            p = C[t, k]
            if np.isnan(p) or tot <= 0:
                continue
            uk = 10.0 * w[k] / tot
            inv += uk
            before = r[k]
            r[k] += uk
            debt[k] *= 1 + rate
            a = 1.0
            if t > s0 and not np.isnan(P[t - 1, k]):
                a = P[t - 1, k]
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - FEE) - debt[k])
                u[k] *= 1 - f; debt[k] *= 1 - f
            else:
                v = min(r[k], uk + (a - 1) * before)
                if v > 0:
                    r[k] -= v
                    m = s * v
                    side += (v - m) * (1 - hyb)                     # не пущенная под плечо часть: лежит залогом (hyb=0) или покупается спотом (hyb=1)
                    u[k] += (L * m + (v - m) * hyb) * (1 - FEE) / p
                    debt[k] += (L - 1) * m
        assets = side; D = 0.0
        for k in range(K):
            assets += r[k]
            if not np.isnan(C[t, k]):
                assets += u[k] * LO[t, k] * stress
            D += debt[k]
        if D > 0:
            lvl = assets / D
            if lvl < worst:
                worst = lvl
            if lvl <= ML:
                liq += 1
                left = 0.0
                for k in range(K):
                    if not np.isnan(C[t, k]):
                        left += u[k] * LO[t, k] * stress * (1 - FEE) - debt[k]
                    left += r[k]
                    r[k] = 0.0; u[k] = 0.0; debt[k] = 0.0
                side = max(0.0, left + side)
    fin = side
    for k in range(K):
        if not np.isnan(C[n - 1, k]):
            fin += r[k] + u[k] * C[n - 1, k] - debt[k]
        else:
            fin += r[k]
    return liq, fin / inv - 1, worst


def run(w, s, L=3.0, stress=1.0, hyb=0.0, rate=RATE):
    w = np.asarray(w, float)
    R = [sim(C, LO, P, int(x), w, s, L, stress, hyb, rate) for x in starts]
    return R


def summary(R):
    n = np.array([x[0] for x in R]); f = np.array([x[1] for x in R]) * 100
    return (n > 0).mean() * 100, n.mean(), n.max(), np.median(f), np.percentile(f, 10), min(x[2] for x in R)


if __name__ == "__main__":
    A = {"ваше (BTC 25, ETH 15, SOL 15, HYPE 10, ZEC 10, ENA 7, PEPE 7, DOGE 6, PUMP 5)": [25, 15, 15, 10, 5, 6, 7, 7, 10],
         "спокойное (BTC 40, ETH 15, SOL 10, остальные по 5)": [40, 15, 10, 5, 5, 5, 5, 5, 5], "поровну": [1] * 9,
         "BTC 50, ETH 25, SOL 25": [50, 25, 25, 0, 0, 0, 0, 0, 0], "BTC 70, ETH 30": [70, 30, 0, 0, 0, 0, 0, 0, 0], "только BTC": [1, 0, 0, 0, 0, 0, 0, 0, 0]}
    print(f"дат старта: {len(starts)}\n")
    for name, w in A.items():
        print(name)
        b = summary(run(w, 0.0))
        print(f"  без плеча: итог медиана {b[3]:+.0f}%, худшие 10% стартов {b[4]:+.0f}%")
        for s in (1.0, 0.75, 0.5, 0.4, 0.3, 0.25, 0.2):
            x = summary(run(w, s)); y = summary(run(w, s, stress=0.8))
            print(f"  ×3 на {s * 100:3.0f}% каждой покупки (позиция = {3 * s:.2f}× вложенных в покупку денег): ликвидация у {x[0]:3.0f}% стартов, в среднем {x[1]:.1f}, макс. {x[2]}"
                  f" | итог медиана {x[3]:+.0f}%, худшие 10% {x[4]:+.0f}% | мин. уровень маржи {x[5]:.2f} | при минимумах ещё −20%: ликвидация у {y[0]:.0f}%")
        print()
