"""9 монет по $2 в день; каждая покупка делается с плечом: на $2 своих покупаем на $6 (×3) или на $4 (×2), продажи стратегии — как есть.
Спотовая кросс-маржа (все монеты и деньги — общий залог), ликвидация как на Binance: активы / долг ≤ 1,1 по минимуму дня; заём ~11% годовых.
Старт с первого числа каждого месяца с 2018 года; монета подключается, когда появляется на рынке. Два режима: по сигналам основной стратегии и просто каждый день.
Запуск: python3 app/lev_unit.py"""
import sys, os
import numpy as np, pandas as pd
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cross_lev import C, LO, P, starts, idx, T

RATE, ML, FEE, UNIT = 0.0003, 1.1, 0.001, 2.0


@njit(cache=True)
def sim(C, LO, P, s0, L, out):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K)
    inv = 0.0; nl = 0; side = 0.0
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
                    r[k] -= v; u[k] += L * v * (1 - FEE) / p; debt[k] += (L - 1) * v
        assets = side; D = 0.0
        for k in range(K):
            assets += r[k]
            if not np.isnan(C[t, k]):
                assets += u[k] * LO[t, k]
            D += debt[k]
        if D > 0 and assets / D <= ML:
            out[nl] = t; nl += 1
            left = assets - D
            for k in range(K):
                r[k] = 0.0; u[k] = 0.0; debt[k] = 0.0
            side = max(0.0, left)
    fin = side
    for k in range(K):
        fin += r[k] - debt[k] + (u[k] * C[n - 1, k] if not np.isnan(C[n - 1, k]) else 0.0)
    return nl, fin, inv


ONES = np.where(np.isnan(P), np.nan, 1.0)
for mode, PL in (("по сигналам стратегии «Тихая вершина + ликвидации»", P), ("просто каждый день (DCA)", ONES)):
    print(f"=== {mode} ===")
    for L, txt in ((1.0, "на $2 (без плеча)"), (2.0, "на $4 (×2)"), (3.0, "на $6 (×3)")):
        res, months = [], {}
        for s in starts:
            out = np.zeros(200, np.int64)
            nl, fin, inv = sim(C, LO, PL, int(s), L, out)
            res.append((idx[s].strftime("%Y-%m"), nl, (fin / inv - 1) * 100, inv))
            for t in out[:nl]:
                m = idx[t].strftime("%Y-%m"); months[m] = months.get(m, 0) + 1
        n = np.array([x[1] for x in res]); f = np.array([x[2] for x in res])
        print(f"  {txt}: ликвидировало {int((n > 0).sum())} из {len(n)} стартов ({(n > 0).mean() * 100:.0f}%), раз за историю в среднем {n.mean():.1f}, максимум {n.max()} | итог медиана {np.median(f):+.0f}%, худший старт {f.min():+.0f}%")
        if months:
            print("     когда (месяц: сколько стартов ликвидировано): " + ", ".join(f"{k} ({v})" for k, v in sorted(months.items())))
        by = {}
        for st, nl, fr, _ in res:
            by.setdefault(st[:4], []).append((nl, fr))
        print("     по году старта (ликвидировано стартов / итог медиана): " + " | ".join(f"{y}: {sum(a > 0 for a, _ in v)}/{len(v)}, {np.median([b for _, b in v]):+.0f}%" for y, v in sorted(by.items())))
    print()
