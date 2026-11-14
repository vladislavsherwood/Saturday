"""Агент 3: помощники для портфеля с маржой поверх agent2_margin.py (модель sim2 агента 2 без изменений).
Добавляет индикаторы монеты (бета/корреляция к BTC за 90/180 дней, pair — монета/BTC к своей средней 200) в agent_margin.EXTRA,
кандидаты агента 3 (C4 и далее) и плечо по группам с отдельной группой для «высокобетовых» дней монеты (группа + 8).
Использование: from agent3_margin import W25, C4, LEV, plan_of, port2, fmt2, short_mask, beta_split"""
import sys, os, json
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data
import agent_margin as AM
from agent2_margin import grouped, sized, plan_of, port2, fmt2, short_mask, stress_ok, safe, c, BOT, CC, LO, HI, starts, idx, HERE, sim2, NOSH
from agent2_loop2 import su_sized
from cross_lev import COINS

W25 = json.load(open(os.path.join(HERE, "found", "agent2-best.json")))
LEV = (1, 2, 1.25, 2, 1, 1, 1, 1.25)          # группы: 0 взнос, 1 дно, 2 паника подтв., 3 разворот, 4 продажа, 5 —, 6 отложенная, 7 паника неподтв.
_btc = data.history("BTC-USD")[0]; _btc = _btc[~_btc.index.duplicated()]


def _beta(close, kind, I, w, what="beta"):
    b = _btc.reindex(close.index, method="ffill")
    x = np.log(b / b.shift(1)); y = np.log(close / close.shift(1))
    cov = x.rolling(w, min_periods=int(w * 0.8)).cov(y); vx = x.rolling(w, min_periods=int(w * 0.8)).var()
    if what == "beta":
        return cov / vx
    vy = y.rolling(w, min_periods=int(w * 0.8)).var()
    return cov / np.sqrt(vx * vy)


for _w in (90, 180):
    AM.EXTRA[f"beta{_w}"] = (lambda w: lambda close, kind, I: _beta(close, kind, I, w))(_w)
    AM.EXTRA[f"corr{_w}"] = (lambda w: lambda close, kind, I: _beta(close, kind, I, w, "corr"))(_w)


def _pair(close, kind, I):
    r = close / _btc.reindex(close.index, method="ffill")
    return r / r.rolling(200, min_periods=200).mean()


AM.EXTRA["pair"] = _pair


def scale_sells(S, conds, k):
    """Копия каждого правила продажи с дополнительными условиями и долей ×k ставится перед ним (как agent3_sim.scaleC)."""
    S = grouped(S); R = []
    for r in S["rules"]:
        if r["act"] < 0:
            R.append({**r, "act": max(-1.0, r["act"] * k), "conds": r["conds"] + conds})
        R.append(r)
    return {**S, "rules": R}


C4 = scale_sells(W25, [c("beta180", ">", 1.2), c("sma200", "<", 1)], 1.5)


def lev_scheme(S):
    """Размеры схемы плеча агента 2 (дно 25%, паника доли ×2, неподтверждённая как подтверждённая, разворот 50%, отложенная 50%)."""
    return su_sized(sized(S, 0.25, 2.0, 0.5, 0.5), "K1")


def ind_matrix(name):
    """Матрица дней × монет значения индикатора (как в plan_of)."""
    M = np.full(CC.shape, np.nan)
    for k, (sym, kind, t) in enumerate(COINS):
        close = data.history(sym)[0]; close = close[~close.index.duplicated()]
        I = AM.indicators(close, kind)
        M[:, k] = pd.Series(I[name], index=close.index).reindex(idx).values
    return M


def beta_split(G, flag, groups=(1, 2, 3, 6, 7)):
    """Дни, где flag (матрица дней × монет, по вчерашнему дню — как GRP), переводятся в группу + 8 (своё плечо)."""
    G = G.copy(); m = flag & np.isin(G, groups); G[m] += 8
    return G


def port3(A, G, lev16, W=None, sh=0.0, stress=True):
    """port2 с плечом по 16 группам (0..7 обычные, 8..15 — те же группы в «высокобетовые» дни)."""
    lev16 = tuple(lev16) + (1.0,) * (16 - len(lev16))
    levv = np.array(lev16, float); SH = NOSH if W is None or not sh else W.astype(float)
    R = [sim2(CC, LO, HI, A, G, SH, int(s), levv, 1.0, sh, 0.15 / 365, 0, True, True) for s in starts]
    x = np.array([q[1] for q in R]) * 100
    o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)),
         "early": float(np.median(x[:48])), "late": float(np.median(x[48:])), "shpnl": float(np.median([q[3] for q in R]) * 100), "neg": float(np.median([q[4] for q in R]) * 100), "_x": x}
    if stress and o["liq"] == 0:
        for st, key in ((0.8, "l20"), (0.7, "l30")):
            o[key] = int(sum(sim2(CC, LO, HI, A, G, SH, int(s), levv, st, sh, 0.15 / 365, 0, True, True)[0] > 0 for s in starts))
    return o
