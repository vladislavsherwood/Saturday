"""Проверка: помогают ли часовой и 4-часовой графики дневному DCA (только крипта).

Решение принимается раз в день на закрытии дня (00:00 UTC), сделка по этой же цене.
Тест А: лестницы по одному индикатору на 1h / 4h / 1d — отбор на первой половине, экзамен на второй.
Тест Б: к дневной лестнице по SMA200 добавляется поправка от индикатора 1h или 4h.

Запуск: python3 dca/grid_mtf.py
"""
import itertools
import json
import os
import time
import urllib.request

import numpy as np
import pandas as pd

import backtest as bt
import grid

SYMBOLS = ["BTC", "ETH", "SOL", "DOGE", "ZEC", "PEPE", "SHIB", "BONK"]
TOL = bt.TOL
BASE_TH = (0.8, 0.95, 1.2)          # лучшая дневная лестница из grid.py
BASE_ACT = (1, 3, 1, 0)


def hourly(sym):
    path = os.path.join(bt.CACHE, f"{sym}_1h.csv")
    if os.path.exists(path):
        return pd.read_csv(path, index_col=0, parse_dates=True)["close"]
    rows, start = [], 0
    while True:
        url = (f"https://data-api.binance.vision/api/v3/klines?symbol={sym}USDT&interval=1h"
               f"&startTime={start}&limit=1000")
        for attempt in range(6):
            try:
                with urllib.request.urlopen(url, timeout=30) as r:
                    d = json.load(r)
                break
            except OSError:
                if attempt == 5:
                    raise
                time.sleep(2 * (attempt + 1))
        if not d:
            break
        rows += [(k[0], float(k[4])) for k in d]
        start = d[-1][0] + 1
        if len(d) < 1000:
            break
        time.sleep(0.05)
    s = pd.Series({pd.to_datetime(t, unit="ms"): c for t, c in rows}, name="close").sort_index()
    s.to_frame().to_csv(path)
    return s


def tf_indicators(close):
    """Индикаторы на одном таймфрейме: имя -> (ряд, пороги)."""
    out = {}
    for n in (7, 14, 30):
        out[f"RSI{n}"] = (bt.rsi(close, n), grid.OSC)
    for n in (50, 200):
        out[f"цена/SMA{n}"] = (close / close.rolling(n, min_periods=50).mean(), grid.RATIO)
    for n in (20, 50):
        out[f"Боллинджер{n}"] = ((close - close.rolling(n).mean()) / close.rolling(n).std(), grid.Z)
    for n in (6, 24):
        out[f"рост{n}"] = (close / close.shift(n) - 1, grid.RET)
    return out


def load(sym):
    h = hourly(sym)
    day_end = h[h.index.hour == 23]
    daily = day_end.copy()
    daily.index = daily.index.normalize()
    frames = {"1h": h, "4h": h[h.index.hour % 4 == 3], "1d": day_end}
    inds = {}
    for tf, c in frames.items():
        for nm, (s, lv) in tf_indicators(c).items():
            v = s.reindex(day_end.index)
            v.index = daily.index
            inds[f"{tf} {nm}"] = (v, lv)
    return daily.iloc[bt.WARMUP:], inds


def halves(daily):
    mid = len(daily) // 2
    for sl in (slice(0, mid), slice(mid, len(daily))):
        seg = daily.iloc[sl]
        price = seg.values
        years = (seg.index[-1] - seg.index[0]).days / 365.25
        yield seg.index, price, years


def stats(E):
    E = np.where(np.isnan(E), -999, E)
    return (E < -TOL).sum(axis=0), (E > TOL).sum(axis=0), np.median(E, axis=0)


def main():
    data = {s: load(s) for s in SYMBOLS}
    for s, (d, _) in data.items():
        print(f"{s}: {len(d)} дней с {d.index[0].date()}")
    names = list(data[SYMBOLS[0]][1].keys())
    acts = grid.all_actions()
    a5 = np.concatenate([acts, np.ones((len(acts), 1), dtype=np.int8)], axis=1)
    dca = np.ones(5, dtype=np.int8)

    # ---------- Тест А ----------
    combos = [(nm, th) for nm in names for th in itertools.combinations(data[SYMBOLS[0]][1][nm][1], 3)]
    n = len(combos) * len(acts)
    E = np.empty((len(SYMBOLS), 2, n), dtype=np.float32)
    base = {}
    for ti, s in enumerate(SYMBOLS):
        daily, inds = data[s]
        for h, (idx, price, years) in enumerate(halves(daily)):
            cf = np.empty((len(price) - 1) // grid.BUCKET + 2)
            b_irr, b_profit, _, _ = grid._sim(price, np.zeros(len(price), dtype=np.int8), dca, years, cf)
            base[(s, h)] = (b_irr, b_profit)
            for ci, (nm, th) in enumerate(combos):
                x = inds[nm][0].loc[idx].values
                zone = np.searchsorted(np.array(th, dtype=float), x, side="right").astype(np.int8)
                zone[np.isnan(x)] = 4
                E[ti, h, ci * len(acts):(ci + 1) * len(acts)] = grid.run_block(
                    price, zone, a5, years, b_irr, b_profit, TOL)
    w1, b1, m1 = stats(E[:, 0, :])
    w2, b2, m2 = stats(E[:, 1, :])
    tf_of = np.repeat([c[0].split()[0] for c in combos], len(acts))
    print(f"\nТест А: {n:,} стратегий на {len(SYMBOLS)} монетах")
    print("таймфрейм | стратегий | нигде не хуже DCA в обеих половинах | топ-1000 первой половины: п.п. на 1-й -> на 2-й")
    for tf in ("1h", "4h", "1d"):
        m = tf_of == tf
        ok = m & (w1 == 0) & (w2 == 0) & (m1 > TOL) & (m2 > TOL)
        cand = np.where(m & (w1 == 0))[0]
        top = cand[np.argsort(-m1[cand])][:1000]
        print(f"{tf:>9} | {m.sum():>9,} | {ok.sum():>6,} ({ok.sum() / m.sum() * 100:.2f}%) | "
              f"{np.median(m1[top]):.1f} -> {np.median(m2[top]):.1f}; без проигрышей на 2-й: {(w2[top] == 0).sum()}")

    # ---------- Тест Б ----------
    bonuses = np.array(list(itertools.product((-1, 0, 1, 2), repeat=3)), dtype=np.int8)   # поправка по 3 зонам
    bonuses = bonuses[(bonuses != 0).any(axis=1)]
    # действия для 12 комбинированных зон (дневная зона * 3 + зона младшего графика) + зона "нет данных"
    tbl = np.empty((len(bonuses), 13), dtype=np.int8)
    for j, bn in enumerate(bonuses):
        for dz in range(4):
            for iz in range(3):
                tbl[j, dz * 3 + iz] = min(3, max(0, BASE_ACT[dz] + bn[iz]))
        tbl[j, 12] = 1
    base_tbl = np.array([[BASE_ACT[dz] for dz in range(4) for _ in range(3)] + [1]], dtype=np.int8)
    pairs = [(nm, th) for nm in names if not nm.startswith("1d")
             for th in itertools.combinations(data[SYMBOLS[0]][1][nm][1], 2)]
    nb = len(pairs) * len(bonuses)
    D = np.empty((len(SYMBOLS), 2, nb), dtype=np.float32)      # преимущество над базовой дневной лестницей
    B = np.empty((len(SYMBOLS), 2), dtype=np.float32)          # базовая лестница против DCA
    for ti, s in enumerate(SYMBOLS):
        daily, inds = data[s]
        for h, (idx, price, years) in enumerate(halves(daily)):
            b_irr, b_profit = base[(s, h)]
            xd = inds["1d цена/SMA200"][0].loc[idx].values
            dz = np.searchsorted(np.array(BASE_TH), xd, side="right")
            nan_d = np.isnan(xd)
            z0 = (dz * 3).astype(np.int8)
            z0[nan_d] = 12
            B[ti, h] = grid.run_block(price, z0, base_tbl, years, b_irr, b_profit, TOL)[0]
            for pi, (nm, th) in enumerate(pairs):
                x = inds[nm][0].loc[idx].values
                iz = np.searchsorted(np.array(th, dtype=float), x, side="right")
                iz[np.isnan(x)] = 1
                zone = (dz * 3 + iz).astype(np.int8)
                zone[nan_d] = 12
                r = grid.run_block(price, zone, tbl, years, b_irr, b_profit, TOL)
                D[ti, h, pi * len(bonuses):(pi + 1) * len(bonuses)] = r - B[ti, h]
    print(f"\nТест Б: дневная лестница SMA200 + поправка от 1h/4h, {nb:,} вариантов")
    print("дневная лестница против DCA, п.п. (1-я / 2-я половина):",
          ", ".join(f"{s} {B[i, 0]:.1f}/{B[i, 1]:.1f}" for i, s in enumerate(SYMBOLS)))
    w1, b1, m1 = stats(D[:, 0, :])
    w2, b2, m2 = stats(D[:, 1, :])
    ok = (w1 == 0) & (w2 == 0) & (m1 > TOL) & (m2 > TOL)
    cand = np.where(w1 == 0)[0]
    top = cand[np.argsort(-m1[cand])][:1000]
    print(f"улучшают дневную лестницу на всех монетах в обеих половинах: {ok.sum():,} ({ok.mean() * 100:.2f}%)")
    print(f"топ-1000 по 1-й половине: +{np.median(m1[top]):.1f} п.п. к лестнице на 1-й -> {np.median(m2[top]):+.1f} на 2-й; "
          f"без проигрышей на 2-й: {(w2[top] == 0).sum()}")
    rel = (m1 > TOL) & (m2 > TOL)
    top = np.argsort(-m1)[:1000]
    print(f"мягче: медиана по монетам лучше лестницы в обеих половинах: {rel.sum():,} ({rel.mean() * 100:.2f}%)")
    print(f"топ-1000 по медиане 1-й половины: {np.median(m1[top]):+.1f} п.п. -> {np.median(m2[top]):+.1f} на 2-й; "
          f"в среднем проигрывают лестнице на {np.mean(w2[top]):.1f} монетах из {len(SYMBOLS)}")
    best = np.where(rel)[0]
    best = best[np.argsort(-np.minimum(m1, m2)[best])][:8]
    for i in best:
        nm, th = pairs[i // len(bonuses)]
        bn = bonuses[i % len(bonuses)]
        print(f"  {nm}: <{th[0]} {bn[0]:+d}, {th[0]}–{th[1]} {bn[1]:+d}, >{th[1]} {bn[2]:+d} | {m1[i]:+.1f} / {m2[i]:+.1f} п.п.; хуже лестницы на {w1[i]}/{w2[i]} монетах")


if __name__ == "__main__":
    main()
