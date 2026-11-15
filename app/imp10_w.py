"""imp10: матрицы весов взноса WT[t, k] по данным ТОЛЬКО до дня t (simw берёт WT[t-1]); нормировка: сумма по существующим монетам = их число."""
import numpy as np, pandas as pd
from numba import njit
from imp10_port import IDX, mcap


def norm(W, C):
    """Нормировать по существующим монетам: сумма = число монет; NaN → 1."""
    W = np.where(np.isfinite(W), W, np.nan)
    ex = np.isfinite(C)
    W = np.where(ex, W, np.nan)
    m = np.nanmean(np.where(ex, W, np.nan), axis=1, keepdims=True)
    W = np.where(ex & ~np.isfinite(W), m, W)          # нет данных для веса — средний вес
    s = np.nansum(np.where(ex, W, 0), axis=1, keepdims=True); n = ex.sum(axis=1, keepdims=True)
    out = np.where(ex, W * n / np.where(s > 0, s, 1), 0.0)
    return np.nan_to_num(out, nan=1.0)


def eq(U):
    return np.ones(U.C.shape)


def ivol(U, win=90, pw=1.0):
    lr = np.log(pd.DataFrame(U.C, index=IDX)).diff()
    v = lr.rolling(win, min_periods=win // 2).std().values
    return norm(1 / v ** pw, U.C)


def capw(U, pw=1.0, cap=None):
    """Вес ∝ капитализация^pw (средняя за 30 дней, CMC); cap — потолок веса (в долях среднего)."""
    M = np.full(U.C.shape, np.nan)
    for k in range(len(U.coins)):
        d = mcap(U.cid(k))
        if d is not None:
            m = d["m"].where(d["m"] > 0).rolling(30, min_periods=5).mean()
            M[:, k] = m.reindex(IDX).values
    W = norm(M ** pw, U.C)
    if cap:
        for _ in range(5):
            W = norm(np.minimum(W, cap), U.C)
    return W


def btcw(U, b=3.0):
    W = np.ones(U.C.shape); W[:, 0] = b
    return norm(W, U.C)


def rel(U, win=365):
    """Сила к BTC за win дней, в процентах (колонка 0 — BTC)."""
    C = pd.DataFrame(U.C, index=IDX)
    r = C / C.shift(win)
    return ((r.div(r[0], axis=0)) - 1).values * 100


def momw(U, win=365, hi=1.5, lo=0.67):
    R = rel(U, win)
    W = np.where(R > 0, hi, np.where(R < 0, lo, 1.0)); W[:, 0] = 1.0
    return norm(W, U.C)


@njit(cache=True)
def _edge(C, A):
    """Отношение стоимости (стратегия без плеча) / (DCA) на одной монете с её первого дня — по дням (только прошлое)."""
    n = C.shape[0]; out = np.full(n, np.nan); r = 0.0; u = 0.0; du = 0.0; inv = 0.0; on = False
    for t in range(n):
        p = C[t]
        if np.isnan(p):
            continue
        before = r; r += 1.0; inv += 1.0; du += 0.999 / p
        a = A[t - 1] if on else 1.0; on = True
        if a < 0:
            r += -a * u * p * 0.999; u *= 1 + a
        else:
            v = min(r, 1.0 + (a - 1) * before)
            if v > 0:
                r -= v; u += v * 0.999 / p
        out[t] = (r + u * p) / (du * p)
    return out


def edgew(U, A, pw=1.0, lo=0.5, hi=2.0, mind=365):
    """Вес ∝ (сила стратегии на монете в прошлом)^pw; меньше mind дней истории — средний вес."""
    E = np.full(U.C.shape, np.nan)
    for k in range(len(U.coins)):
        e = _edge(U.C[:, k], A[:, k])
        age = np.cumsum(np.isfinite(U.C[:, k]))
        E[:, k] = np.where(age >= mind, np.clip(e, lo, hi), np.nan)
    return norm(E ** pw, U.C)
