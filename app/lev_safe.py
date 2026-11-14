"""Какое плечо безопасно: 9 монет по $2, покупка = $2 × плечо (кросс-маржа на споте, ликвидация при активы/долг ≤ 1,1, заём ~11% годовых).
Варианты: плечо на все покупки стратегии / только на ежедневный взнос (докупки из резерва без плеча) / простой DCA.
Ищем наибольшее плечо без единой ликвидации с любой даты старта (с 2018 года, по месяцам) и с запасом: минимумы ещё на 20% ниже.
Запуск: python3 app/lev_safe.py"""
import sys, os
import numpy as np
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cross_lev import C, LO, P, starts

RATE, ML, FEE, UNIT = 0.0003, 1.1, 0.001, 2.0


@njit(cache=True)
def sim(C, LO, P, s0, L, resL, stress):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9
    for t in range(s0, n):
        for k in range(K):
            p = C[t, k]
            if np.isnan(p):
                continue
            inv += UNIT; before = r[k]; r[k] += UNIT; debt[k] *= 1 + RATE
            a = 1.0
            if t > s0 and not np.isnan(P[t - 1, k]):
                a = P[t - 1, k]
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - f; debt[k] *= 1 - f
            else:
                v = min(r[k], UNIT + (a - 1) * before)
                if v > 0:
                    base = min(v, UNIT); extra = v - base                     # взнос дня и докупка из резерва
                    r[k] -= v
                    u[k] += (L * base + resL * extra) * (1 - FEE) / p
                    debt[k] += (L - 1) * base + (resL - 1) * extra
        assets = side; D = 0.0
        for k in range(K):
            assets += r[k]
            if not np.isnan(C[t, k]):
                assets += u[k] * LO[t, k] * stress
            D += debt[k]
        if D > 0:
            lv = assets / D
            if lv < worst:
                worst = lv
            if lv <= ML:
                nl += 1; left = assets - D
                for k in range(K):
                    r[k] = 0.0; u[k] = 0.0; debt[k] = 0.0
                side = max(0.0, left)
    fin = side
    for k in range(K):
        fin += r[k] - debt[k] + (u[k] * C[n - 1, k] if not np.isnan(C[n - 1, k]) else 0.0)
    return nl, fin / inv - 1, worst


ONES = np.where(np.isnan(P), np.nan, 1.0)
GRID = np.round(np.arange(1.0, 3.01, 0.05), 2)
for name, PL, onres in (("плечо на все покупки стратегии", P, True), ("плечо только на ежедневный взнос, резерв без плеча", P, False), ("простой DCA", ONES, True)):
    print(f"=== {name} ===")
    safe = safe20 = 1.0
    for L in GRID:
        R = [sim(C, LO, PL, int(s), L, L if onres else 1.0, 1.0) for s in starts]
        R2 = [sim(C, LO, PL, int(s), L, L if onres else 1.0, 0.8) for s in starts]
        n = sum(x[0] > 0 for x in R); n2 = sum(x[0] > 0 for x in R2)
        if n == 0 and safe == L - 0.05 or (L == 1.0):
            safe = L if n == 0 else safe
        if n2 == 0 and safe20 == round(L - 0.05, 2) or (L == 1.0):
            safe20 = L if n2 == 0 else safe20
        if L in (1.0, 1.1, 1.2, 1.25, 1.3, 1.4, 1.5, 1.6, 1.75, 2.0, 2.5, 3.0) or n == 0 and n2 > 0:
            print(f"  ×{L:<4} (на $2 покупаем ${2 * L:.2f}): ликвидировало {n:3d}/105 стартов | запас −20%: {n2:3d}/105 | итог медиана {np.median([x[1] for x in R]) * 100:+.0f}%,"
                  f" худший старт {min(x[1] for x in R) * 100:+.0f}% | мин. уровень маржи {min(x[2] for x in R):.2f}")
    print(f"  → без единой ликвидации: до ×{safe}; с запасом на ещё −20%: до ×{safe20}\n")
