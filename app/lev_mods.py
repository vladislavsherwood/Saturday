"""Безопасное плечо, если обычный взнос меняется по признакам (дни без сработавших правил: взнос × множитель).
Схема как в lev_safe.py: 9 монет по $2, все покупки с плечом L, кросс-маржа на споте, ликвидация при активы/долг ≤ 1,1, заём ~11% годовых.
Запуск: python3 app/lev_mods.py"""
import sys, os
import numpy as np, pandas as pd
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data
from cross_lev import C, LO, P, starts, idx, COINS

RATE, ML, FEE, UNIT = 0.0003, 1.1, 0.001, 2.0
fng = data.fear_greed().reindex(idx, method="ffill").values
dom = data.dominances()
usdt = (dom["usdt"] / dom["usdt"].rolling(200, min_periods=200).mean()).reindex(idx, method="ffill").values
btc = data.history("BTC-USD")[0]
btcath = ((1 - btc / btc.cummax()) * 100).reindex(idx, method="ffill").values
mvrv = data.mvrv_history().reindex(idx, method="ffill").values
btc200 = (btc / btc.rolling(200).mean()).reindex(idx, method="ffill").values
sma = np.full_like(C, np.nan)
for k in range(C.shape[1]):
    s = pd.Series(C[:, k]); sma[:, k] = (s / s.rolling(200, min_periods=200).mean()).values
col = lambda v: np.repeat(v[:, None], C.shape[1], axis=1)                   # noqa: E731


def mods(rules):
    """rules: [(маска дней×монет, множитель)] — первое сработавшее."""
    M = np.ones_like(C); done = np.zeros_like(C, dtype=bool)
    for mask, m in rules:
        mk = np.nan_to_num(mask, nan=0).astype(bool) & ~done
        M[mk] = m; done |= mk
    return M


V = {
    "взнос всегда ×1": [],
    "жадность > 70 → ×0,5": [(col(fng > 70), 0.5)],
    "USDT.D ниже средней на 5%+ → ×0,5": [(col(usdt < 0.95), 0.5)],
    "биткоин в 15% от максимума → ×0,5": [(col(btcath < 15), 0.5)],
    "монета выше средней 200 на 50%+ → ×0,5": [(sma > 1.5, 0.5)],
    "страх < 30 → ×1,5; USDT.D ниже средней на 5%+ → ×0,5": [(col(fng < 30), 1.5), (col(usdt < 0.95), 0.5)],
    "MVRV < 1,2 → ×1,5; USDT.D ниже средней на 5%+ → ×0,5": [(col(mvrv < 1.2), 1.5), (col(usdt < 0.95), 0.5)],
    "перегрев (жадность > 70, или USDT.D ниже средней на 5%+, или биткоин в 15% от максимума) → ×0,5": [(col((fng > 70) | (usdt < 0.95) | (btcath < 15)), 0.5)],
    "перегрев → ×0,25": [(col((fng > 70) | (usdt < 0.95) | (btcath < 15)), 0.25)],
    "перегрев → ×0,5; страх < 30 → ×1,5": [(col(fng < 30), 1.5), (col((fng > 70) | (usdt < 0.95) | (btcath < 15)), 0.5)],
    "перегрев → 0 (пропуск, всё в резерв)": [(col((fng > 70) | (usdt < 0.95) | (btcath < 15)), 0.0)],
}


@njit(cache=True)
def sim(C, LO, P, M, s0, L, stress):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9
    for t in range(s0, n):
        for k in range(K):
            p = C[t, k]
            if np.isnan(p):
                continue
            inv += UNIT; before = r[k]; r[k] += UNIT; debt[k] *= 1 + RATE
            a = 1.0; m = 1.0
            if t > s0 and not np.isnan(P[t - 1, k]):
                a = P[t - 1, k]; m = M[t - 1, k]
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - f; debt[k] *= 1 - f
            else:
                v = min(r[k], UNIT * m if a == 1.0 else UNIT + (a - 1) * before)
                if v > 0:
                    r[k] -= v; u[k] += L * v * (1 - FEE) / p; debt[k] += (L - 1) * v
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


GRID = np.round(np.arange(1.0, 2.51, 0.05), 2)
print(f"{'вариант':95} | {'без ликв. до':>12} | {'с запасом −20% до':>17} | итог ×1 → при безопасном с запасом")
for name, rules in V.items():
    M = mods(rules)
    safe = safe20 = 1.0; ok = ok2 = True
    for L in GRID:
        R = [sim(C, LO, P, M, int(s), L, 1.0) for s in starts]
        R2 = [sim(C, LO, P, M, int(s), L, 0.8) for s in starts]
        if ok and all(x[0] == 0 for x in R): safe = L
        else: ok = False
        if ok2 and all(x[0] == 0 for x in R2): safe20 = L
        else: ok2 = False
        if not ok and not ok2: break
    b = np.median([sim(C, LO, P, M, int(s), 1.0, 1.0)[1] for s in starts]) * 100
    g = [sim(C, LO, P, M, int(s), safe20, 1.0) for s in starts]
    print(f"{name[:95]:95} | ×{safe:<11} | ×{safe20:<16} | {b:+.0f}% → {np.median([x[1] for x in g]) * 100:+.0f}% (мин. уровень маржи {min(x[2] for x in g):.2f})")
