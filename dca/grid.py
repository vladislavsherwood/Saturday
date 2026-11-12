"""Полный перебор нескольких миллионов DCA-стратегий.

Стратегия = индикатор + 3 порога (4 зоны) + действие в каждой зоне от -3 (продать x3) до +3 (купить x3).
Каждая стратегия считается отдельно на первой и на второй половине истории каждого тикера.
Отбор делается по первой половине, проверка — по второй, которую отбор не видел.

Запуск: python3 dca/grid.py
"""
import itertools
import os
import time

import numpy as np
import pandas as pd
from numba import njit, prange

import backtest as bt

UNIT = bt.UNIT
TOL = bt.TOL
BUCKET = 21          # дней в одном периоде при расчёте доходности
MIN_YEARS = 3.0      # тикеры с более короткой историей в отборе не участвуют

RATIO = [0.7, 0.8, 0.9, 0.95, 1.0, 1.05, 1.1, 1.2, 1.4]
OSC = [20, 30, 40, 50, 60, 70, 80]
DD = [0.05, 0.10, 0.15, 0.20, 0.30, 0.40, 0.50]
Z = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2]
RET = [-0.2, -0.1, -0.05, -0.02, 0, 0.02, 0.05, 0.1, 0.2]


def indicator_set(close, volume):
    """Все индикаторы тикера: имя -> (ряд, список порогов)."""
    out = {}
    mp = lambda n: min(n, bt.WARMUP)
    for n in (20, 50, 100, 200, 300):
        out[f"цена/SMA{n}"] = (close / close.rolling(n, min_periods=mp(n)).mean(), RATIO)
    for n in (7, 14, 21, 30):
        out[f"RSI{n}"] = (bt.rsi(close, n), OSC)
    for n in (30, 90, 180, 365):
        out[f"просадка{n}"] = (1 - close / close.rolling(n, min_periods=1).max(), DD)
    for n in (20, 50, 100):
        out[f"Боллинджер{n}"] = ((close - close.rolling(n, min_periods=mp(n)).mean())
                                 / close.rolling(n, min_periods=mp(n)).std(), Z)
    for n in (5, 10, 20, 60):
        out[f"рост{n}д"] = (close / close.shift(n) - 1, RET)
    ret = close.pct_change()
    mf = close * volume
    for n in (7, 14, 30):
        pos = mf.where(ret > 0, 0).rolling(n).sum()
        neg = mf.where(ret < 0, 0).rolling(n).sum()
        out[f"MFI{n}"] = (100 - 100 / (1 + pos / neg.replace(0, np.nan)), OSC)
    for n in (50, 100, 200, 300):
        vwap = mf.rolling(n, min_periods=mp(n)).sum() / volume.rolling(n, min_periods=mp(n)).sum()
        out[f"цена/VWAP{n}"] = (close / vwap, RATIO)
    return out


def all_actions():
    """Все наборы действий по 4 зонам, где есть хотя бы одна покупка."""
    acts = [a for a in itertools.product(range(-3, 4), repeat=4) if max(a) > 0]
    return np.array(acts, dtype=np.int8)


@njit(cache=True)
def _irr(cf, nb, dt):
    """Годовая доходность по периодам равной длины dt (бисекция)."""
    lo, hi = -6.0, 6.0
    flo = 0.0
    d = np.exp(-lo * dt)
    w = 1.0
    for b in range(nb):
        flo += cf[b] * w
        w *= d
    for _ in range(34):
        m = 0.5 * (lo + hi)
        d = np.exp(-m * dt)
        w = 1.0
        f = 0.0
        for b in range(nb):
            f += cf[b] * w
            w *= d
        if (flo > 0) == (f > 0):
            lo = m
            flo = f
        else:
            hi = m
    return np.expm1(0.5 * (lo + hi)) * 100.0


@njit(cache=True)
def _sim(price, zone, act, years, cf):
    """Одна стратегия на одном отрезке. Возвращает (доходность, прибыль, вложено, продаж)."""
    n = len(price)
    nb = (n - 1) // BUCKET + 2
    for b in range(nb):
        cf[b] = 0.0
    units = 0.0
    invested = 0.0
    received = 0.0
    nsell = 0
    for i in range(n):
        a = act[zone[i]]
        p = price[i]
        if a > 0:
            amt = a * UNIT
            units += amt / p
            invested += amt
            cf[i // BUCKET] -= amt
        elif a < 0:
            amt = min(-a * UNIT, units * p)
            if amt > 0:
                units -= amt / p
                received += amt
                cf[i // BUCKET] += amt
                nsell += 1
    final = units * price[n - 1]
    cf[nb - 1] += final
    if invested <= 0:
        return np.nan, 0.0, 0.0, 0
    dt = years / (nb - 1)
    return _irr(cf, nb, dt), final + received - invested, invested, nsell


@njit(parallel=True, cache=True)
def run_block(price, zone, acts, years, base_irr, base_profit, tol):
    """Все наборы действий для одной пары (индикатор, пороги) на одном отрезке.
    Возвращает преимущество над DCA в п.п.; -999, если стратегия с продажами заработала
    заметно меньше долларов, чем DCA; NaN, если не было ни одной покупки."""
    k = acts.shape[0]
    out = np.empty(k, dtype=np.float32)
    nb = (len(price) - 1) // BUCKET + 2
    floor = base_profit - 0.10 * abs(base_profit)
    for j in prange(k):
        cf = np.empty(nb)
        irr, profit, invested, nsell = _sim(price, zone, acts[j], years, cf)
        if np.isnan(irr):
            out[j] = np.nan
        elif nsell > 0 and profit < floor:
            out[j] = -999.0
        else:
            out[j] = irr - base_irr
    return out


def main():
    t0 = time.time()
    acts = all_actions()
    dca = np.array([1, 1, 1, 1], dtype=np.int8)
    # данные
    tick = []
    for name, (sym, group) in bt.TICKERS.items():
        data = bt.yahoo(sym)
        data = data[data.index >= bt.START]
        close, volume = data["close"], data["volume"]
        inds = indicator_set(close, volume)
        idx = close.index[bt.WARMUP:]
        yrs = (idx[-1] - idx[0]).days / 365.25
        tick.append({"name": name, "group": group, "close": close, "inds": inds, "idx": idx, "years": yrs})
    # список (индикатор, пороги)
    names = list(tick[0]["inds"].keys())
    combos = []
    for nm in names:
        levels = tick[0]["inds"][nm][1]
        for th in itertools.combinations(levels, 3):
            combos.append((nm, th))
    n_strat = len(combos) * len(acts)
    print(f"индикаторов: {len(names)}, пар индикатор+пороги: {len(combos)}, наборов действий: {len(acts)}")
    print(f"стратегий: {n_strat:,}, тикеров: {len(tick)}")

    edges = np.empty((len(tick), 2, n_strat), dtype=np.float32)   # тикер, половина, стратегия
    for ti, t in enumerate(tick):
        idx = t["idx"]
        mid = len(idx) // 2
        for h, sl in enumerate((slice(0, mid), slice(mid, len(idx)))):
            seg = idx[sl]
            price = t["close"].loc[seg].values
            years = (seg[-1] - seg[0]).days / 365.25
            cf = np.empty((len(price) - 1) // BUCKET + 2)
            b_irr, b_profit, _, _ = _sim(price, np.zeros(len(price), dtype=np.int8), dca, years, cf)
            for ci, (nm, th) in enumerate(combos):
                x = t["inds"][nm][0].shift(1).loc[seg].values      # сигнал по вчерашнему закрытию
                zone = np.searchsorted(np.array(th, dtype=float), x, side="right").astype(np.int8)
                zone[np.isnan(x)] = 4                               # нет данных -> покупка x1
                a5 = np.concatenate([acts, np.ones((len(acts), 1), dtype=np.int8)], axis=1)
                edges[ti, h, ci * len(acts):(ci + 1) * len(acts)] = run_block(
                    price, zone, a5, years, b_irr, b_profit, TOL)
        print(f"{t['name']}: готово, {time.time() - t0:.0f} с", flush=True)

    os.makedirs(bt.OUT, exist_ok=True)
    np.save(os.path.join(bt.CACHE, "grid_edges.npy"), edges)
    meta = {"combos": combos, "acts": acts, "tickers": [(t["name"], t["group"], t["years"]) for t in tick]}
    pd.to_pickle(meta, os.path.join(bt.CACHE, "grid_meta.pkl"))
    print(f"всего: {time.time() - t0:.0f} с")


if __name__ == "__main__":
    main()
