"""Кросс-маржа: один счёт на все монеты, залог — весь резерв и все позиции. Доля q каждой покупки идёт фьючерсом с плечом L
(маржа q·v, позиция L·q·v), остальное — спот. Основная стратегия по каждой монете, взнос $10 в день делится по долям монет
(пока монеты нет на рынке, её доля делится между остальными). Фандинг с размера фьючерсной позиции каждый день.
Ликвидация, если по минимумам дня капитал счёта ≤ 1% фьючерсных позиций: счёт обнуляется, взносы идут дальше.
Ищем наибольшую q без единой ликвидации при старте с первого числа любого месяца с 2018 года; запас — то же при минимумах ещё на 20% ниже.
Запуск: python3 app/cross_lev.py"""
import sys, os, json
import numpy as np, pandas as pd
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine

COINS = [("BTC-USD", "btc", "BTC"), ("ETH-USD", "alt", "ETH"), ("SOL-USD", "alt", "SOL"), ("HYPE32196-USD", "alt", "HYPE"), ("PUMP36507-USD", "alt", "PUMP"),
         ("DOGE-USD", "alt", "DOGE"), ("PEPE24478-USD", "alt", "PEPE"), ("ENA-USD", "alt", "ENA"), ("ZEC-USD", "alt", "ZEC")]
T = [t for _, _, t in COINS]
LQ = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "liq_extra.json")))
FUND = pd.Series(LQ["bfund"], index=pd.to_datetime(LQ["t"], unit="D"), dtype=float)

idx = pd.date_range("2018-01-01", "2026-11-13")
K = len(COINS)
C = np.full((len(idx), K), np.nan); LO = C.copy(); P = C.copy()
for k, (sym, kind, t) in enumerate(COINS):
    h = engine.series(sym, kind); st = {x["code"]: x for x in h["strategies"]}
    d = pd.to_datetime(np.array(h["t"]), unit="D")
    c = pd.Series(h["c"], index=d); l = pd.Series(h["l"], index=d); p = pd.Series(st["main"]["plan"], index=d)
    C[:, k] = c.reindex(idx).values; l = l.reindex(idx).values; LO[:, k] = np.where(np.isfinite(l) & (l > 0), np.minimum(l, C[:, k]), C[:, k]); P[:, k] = p.reindex(idx).values
F = FUND.reindex(idx).fillna(0.03).values / 100
starts = np.array([i for i, x in enumerate(idx) if x.day == 1 and i < len(idx) - 60])


@njit(cache=True)
def sim(C, LO, P, F, s0, w, q, L, stress, mm, fee):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); pu = np.zeros(K); debt = np.zeros(K)
    inv = 0.0; liq = 0; minratio = 1e9
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
            debt[k] += F[t] * pu[k] * p
            a = 1.0
            if t > s0 and not np.isnan(P[t - 1, k]):
                a = P[t - 1, k]
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - fee) - debt[k])
                u[k] *= 1 - f; pu[k] *= 1 - f; debt[k] *= 1 - f
            else:
                v = min(r[k], uk + (a - 1) * before)
                if v > 0:
                    r[k] -= v
                    u[k] += v * (1 - q) * (1 - fee) / p + L * v * q * (1 - fee) / p
                    pu[k] += L * v * q * (1 - fee) / p
                    debt[k] += (L - 1) * v * q
        eq = 0.0; mt = 0.0
        for k in range(K):
            if np.isnan(C[t, k]):
                eq += r[k]
                continue
            lo = LO[t, k] * stress
            eq += r[k] + u[k] * lo - debt[k]
            mt += mm * pu[k] * lo
        if mt > 0:
            ratio = eq / mt
            if ratio < minratio:
                minratio = ratio
            if eq <= mt:
                liq += 1
                for k in range(K):
                    r[k] = 0.0; u[k] = 0.0; pu[k] = 0.0; debt[k] = 0.0
    fin = 0.0
    for k in range(K):
        p = C[n - 1, k]
        if not np.isnan(p):
            fin += r[k] + u[k] * p - debt[k]
    return liq, fin / inv - 1, minratio


def run(w, q, L=3.0, stress=1.0):
    w = np.asarray(w, float)
    R = [sim(C, LO, P, F, int(s), w, q, L, stress, 0.01, 0.001) for s in starts]
    return sum(x[0] > 0 for x in R), float(np.median([x[1] for x in R])) * 100, min(x[2] for x in R), R


def maxq(w, L=3.0, stress=1.0):
    best = 0.0
    for q in np.arange(0.05, 1.0001, 0.05):
        if run(w, q, L, stress)[0] == 0:
            best = q
        else:
            break
    return best


if __name__ == "__main__":
    A = {"ваша (BTC 25, ETH 15, SOL 15, HYPE 10, ZEC 10, ENA 7, PEPE 7, DOGE 6, PUMP 5)": [25, 15, 15, 10, 5, 6, 7, 7, 10],
         "поровну": [1] * 9, "BTC 50, ETH 25, SOL 25": [50, 25, 25, 0, 0, 0, 0, 0, 0], "только BTC": [1, 0, 0, 0, 0, 0, 0, 0, 0],
         "BTC 70, ETH 30": [70, 30, 0, 0, 0, 0, 0, 0, 0], "BTC 50 + остальные поровну": [50] + [50 / 8] * 8, "спокойная (BTC 40, ETH 15, SOL 10, остальные по 5)": [40, 15, 10, 5, 5, 5, 5, 5, 5]}
    print(f"дат старта: {len(starts)} ({idx[starts[0]].date()} … {idx[starts[-1]].date()})\n")
    for L in (3.0, 2.0):
        print(f"=== плечо ×{L:.0f} ===")
        for name, w in A.items():
            q = maxq(w, L); qs = maxq(w, L, 0.8)
            base = run(w, 0.0)[1]; lev = run(w, q, L)
            print(f"  {name}\n    без ликвидаций: до {q * 100:.0f}% покупок с плечом (с запасом на ещё −20%: до {qs * 100:.0f}%) | итог медиана: без плеча {base:+.0f}%, с плечом {lev[1]:+.0f}% | ближе всего к ликвидации: капитал = {lev[2]:.0f}× поддержки")
    # поиск распределения с наибольшей безопасной долей под плечом ×3 (случайные распределения)
    rng = np.random.default_rng(1)
    best = []
    for j in range(400):
        w = rng.dirichlet(np.ones(9) * 0.7)
        q = maxq(w, 3.0)
        if q > 0:
            res = run(w, q, 3.0)
            best.append((q, res[1], w))
    best.sort(key=lambda x: (-x[0], -x[1]))
    print("\n=== лучшие из 400 случайных распределений (×3): безопасная доля покупок с плечом, итог медиана ===")
    for q, m, w in best[:8]:
        print(f"  {q * 100:.0f}% под плечом, итог {m:+.0f}% | " + ", ".join(f"{T[k]} {w[k] * 100:.0f}" for k in np.argsort(-w) if w[k] > 0.02))
