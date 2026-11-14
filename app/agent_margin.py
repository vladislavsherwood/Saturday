"""Портфель из 9 монет со спотовой кросс-маржой для ЛЮБОГО набора правил (JSON как в found/*.json).
Индикаторы считаются так же, как в engine._reserve_plans (проверка: для основной стратегии номера правил совпадают с engine).
Плечо задаётся по группам правил (поле "grp" у правила: 1 дно, 2 паника, 3 разворот; без поля — по совпадению с правилами B).
Шорты: доля счёта, открывается по сигналу вершины, закрывается по сигналу выхода; кросс-маржа вместе с лонгами,
проценты по займу монеты, ликвидация по максимуму дня (стресс: максимумы на 20/30% выше, минимумы на 20/30% ниже).
Использование: from agent_margin import plan_of, portfolio"""
import sys, os, json
import numpy as np, pandas as pd
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine, data
from cross_lev import C, LO, starts, idx, COINS

K = len(COINS)
RATE, ML, FEE, UNIT = 0.0003, 1.1, 0.001, 2.0
HI = np.full_like(C, np.nan)
for k, (sym, kind, t) in enumerate(COINS):
    h = engine.series(sym, kind)
    d = pd.to_datetime(np.array(h["t"]), unit="D")
    hh = pd.Series(h["h"], index=d)
    hh = hh[~hh.index.duplicated()].reindex(idx).values
    HI[:, k] = np.where(np.isfinite(hh) & (hh > 0), np.maximum(hh, C[:, k]), C[:, k])

_full = data.dominances()
_fng = data.fear_greed()
_btc = data.history("BTC-USD")[0]
_lq = engine._liq()


def indicators(close, kind):
    """Те же ряды, что в engine._reserve_plans, с именами как в стенде lab.js."""
    ix = close.index
    d = _full.reindex(ix, method="ffill")
    usdt_r = (_full["usdt"] / _full["usdt"].rolling(200, min_periods=200).mean()).reindex(ix, method="ffill")
    fng = _fng.reindex(ix, method="ffill")
    btc = close if kind == "btc" else _btc.reindex(ix, method="ffill")
    btcath = (1 - _btc / _btc.cummax()).reindex(ix, method="ffill") * 100
    oth90 = d["oth"] - d["oth"].shift(90)
    oidd = ((_lq["oic"] / _lq["oic"].rolling(30, min_periods=1).max() - 1) * 100).reindex(ix, method="ffill", limit=3)
    fund30 = _lq["fund"].rolling(30, min_periods=30).sum().reindex(ix, method="ffill", limit=3)
    I = {"fng": fng, "usdt": usdt_r, "othd": d["oth"], "usdtd": d["usdt"], "btcr30": (btc / btc.shift(30) - 1) * 100, "btcath": btcath, "oth90": oth90,
         "qt": ((btcath < 10) & (oth90 > 1.5)).astype(float), "oidd30": oidd, "fund30": fund30,
         "sma200": close / close.rolling(200, min_periods=200).mean(), "dd365": (1 - close / close.rolling(365, min_periods=1).max()) * 100,
         "btcr90": (btc / btc.shift(90) - 1) * 100}
    run = lambda m: m.astype(int).groupby((~m).cumsum()).cumsum().astype(float)            # noqa: E731
    I["panicd"] = run(((usdt_r > 1.07) & (d["oth"] < 25)).fillna(False))
    I["feard"] = run(((fng < 52) & (d["usdt"] < 7.6)).fillna(False))
    I["qtrun"] = run(I["qt"] > 0.5)
    I["hotd"] = run((fund30 > 2).fillna(False))
    return I


def rule_index(close, kind, rules):
    I = indicators(close, kind)
    conds = []
    for r in rules:
        m = pd.Series(True, index=close.index)
        for c in r["conds"]:
            s = I[c["ind"]]
            m &= (s < c["v"]) if c["op"] == "<" else (s > c["v"])
        conds.append(m.fillna(False).values)
    return np.select(conds, list(range(len(rules))), default=-1)


def plan_of(S):
    """Матрицы по дням и монетам: доля действия ACT (1 — взнос) и номер группы плеча GRP (0 — без плеча, 4 — продажа)."""
    B = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "main-crypto.json")))
    bgrp = [1, 1, 2, 2, 0, 3, 2, 4, 4, 3, 4, 4]
    acts = np.array([r["act"] for r in S["rules"]] + [S.get("base", 1)])
    grp = []
    for r in S["rules"]:
        if "grp" in r:
            grp.append(r["grp"])
        elif r["act"] < 0:
            grp.append(4)
        else:
            same = [i for i, q in enumerate(B["rules"]) if q["conds"] == r["conds"]]
            grp.append(bgrp[same[0]] if same else 0)
    grp = np.array(grp + [0])
    ACT = np.ones_like(C); GRP = np.zeros(C.shape, dtype=np.int64); RI = np.full(C.shape, -2, dtype=np.int64)
    for k, (sym, kind, t) in enumerate(COINS):
        close = data.history(sym)[0]
        close = close[~close.index.duplicated()]
        ri = pd.Series(rule_index(close, kind, S["rules"]), index=close.index).reindex(idx).fillna(-1).astype(int).values
        RI[:, k] = ri
        ACT[:, k] = acts[ri]; GRP[:, k] = grp[ri]
    RI[np.isnan(C)] = -2
    return ACT, GRP, RI


@njit(cache=True)
def sim(C, LO, HI, ACT, GRP, SHORT, s0, lev, stress, sh_size, sh_rate, sh_coin):
    """Портфель: взнос UNIT на монету в день, резерв по монете, общий счёт (кросс-маржа).
    SHORT[t,k]: 1 — открыть/держать шорт по монете k, 0 — закрыть. sh_size — доля капитала счёта на шорт по сигналу (позиция в монетах фиксируется при открытии).
    sh_coin = -1: шорт по той монете, где сигнал; иначе только по монете sh_coin."""
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K); su = np.zeros(K)       # su — занятые и проданные монеты (шорт)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9; shpnl = 0.0; shdays = 0
    for t in range(s0, n):
        for k in range(K):
            p = C[t, k]
            if np.isnan(p):
                continue
            inv += UNIT; before = r[k]; r[k] += UNIT; debt[k] *= 1 + RATE
            if su[k] > 0:
                r[k] -= su[k] * p * sh_rate; shpnl -= su[k] * p * sh_rate; shdays += 1
            a = ACT[t - 1, k] if t > s0 else 1.0
            g = GRP[t - 1, k] if t > s0 else 0
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - f; debt[k] *= 1 - f
            else:
                v = min(r[k], UNIT + (a - 1) * before)
                if v > 0:
                    b = (lev[g] - 1) * v
                    r[k] -= v; u[k] += (v + b) * (1 - FEE) / p; debt[k] += b
            # шорты
            if sh_size > 0 and t > s0 and (sh_coin < 0 or sh_coin == k):
                want = SHORT[t - 1, k] > 0
                if want and su[k] == 0:
                    eq = side
                    for j in range(K):
                        eq += r[j] - debt[j]
                        if not np.isnan(C[t, j]):
                            eq += u[j] * C[t, j] - su[j] * C[t, j]
                    q = sh_size * max(eq, 0.0) / p
                    su[k] = q; r[k] += q * p * (1 - FEE); shpnl -= q * p * FEE
                elif not want and su[k] > 0:
                    r[k] -= su[k] * p * (1 + FEE); shpnl -= su[k] * p * FEE
                    su[k] = 0.0
        assets = side; D = 0.0
        for k in range(K):
            assets += r[k]
            if not np.isnan(C[t, k]):
                assets += u[k] * LO[t, k] * stress
                D += su[k] * HI[t, k] * (2.0 - stress)
            D += debt[k]
        if D > 0:
            lv = assets / D
            if lv < worst:
                worst = lv
            if lv <= ML:
                nl += 1; left = assets - D
                for k in range(K):
                    r[k] = 0.0; u[k] = 0.0; debt[k] = 0.0; su[k] = 0.0
                side = max(0.0, left)
    fin = side
    for k in range(K):
        if not np.isnan(C[n - 1, k]):
            fin += r[k] - debt[k] + (u[k] - su[k]) * C[n - 1, k]
        else:
            fin += r[k] - debt[k]
    return nl, fin / inv - 1, worst, shpnl / inv, shdays


NOSHORT = np.zeros(C.shape)


def portfolio(ACT, GRP, lev=(1, 1, 1, 1, 1), SHORT=None, sh_size=0.0, sh_rate=0.10 / 365, sh_coin=-1, stress=True):
    lev = np.array(lev, float); SH = NOSHORT if SHORT is None else SHORT.astype(float)
    R = [sim(C, LO, HI, ACT, GRP, SH, int(s), lev, 1.0, sh_size, sh_rate, sh_coin) for s in starts]
    x = np.array([q[1] for q in R]) * 100
    o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)),
         "early": float(np.median(x[:48])), "late": float(np.median(x[48:])), "shpnl": float(np.median([q[3] for q in R]) * 100)}
    if stress:
        for st, key in ((0.8, "l20"), (0.7, "l30")):
            o[key] = int(sum(sim(C, LO, HI, ACT, GRP, SH, int(s), lev, st, sh_size, sh_rate, sh_coin)[0] > 0 for s in starts))
    return o


def fmt(o):
    return (f"медиана {o['med']:+.0f}% | худшие 10% {o['p10']:+.0f}% | старты 2018–21 {o['early']:+.0f}%, 2022–26 {o['late']:+.0f}% | ликвидаций {o['liq']}/105"
            + (f", при −20% {o['l20']}, при −30% {o['l30']}" if "l20" in o else "") + f" | мин. активы/долг {o['lvl']:.2f}" + (f" | шорты {o['shpnl']:+.1f}% к вложенному" if o["shpnl"] else ""))


if __name__ == "__main__":
    B = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "main-crypto.json")))
    ACT, GRP, RI = plan_of(B)
    # сверка с engine: номера правил основной стратегии
    bad = 0
    for k, (sym, kind, t) in enumerate(COINS):
        close = data.history(sym)[0]
        _, rule, _, _ = engine._reserve_plans(close, kind)["main"]
        s = pd.Series(rule, index=close.index); s = s[~s.index.duplicated()]
        ref = s.reindex(idx).fillna(-1).astype(int).values
        m = ~np.isnan(C[:, k])
        bad += int((ref[m] != RI[m, k]).sum())
    print("расхождений с engine по номерам правил:", bad)
    print("B без плеча:", fmt(portfolio(ACT, GRP)))


def mask(any_of):
    """Матрица дней × монет: выполнен ли хоть один набор условий [[{ind, op, v}, ...], ...]."""
    M = np.zeros(C.shape, dtype=bool)
    for k, (sym, kind, t) in enumerate(COINS):
        close = data.history(sym)[0]; close = close[~close.index.duplicated()]
        I = indicators(close, kind); m = pd.Series(False, index=close.index)
        for conds in any_of:
            mm = pd.Series(True, index=close.index)
            for c in conds:
                s = I[c["ind"]]; mm &= (s < c["v"]) if c["op"] == "<" else (s > c["v"])
            m |= mm.fillna(False)
        M[:, k] = m.reindex(idx).fillna(False).values
    return M


def short_state(entry, exit_, maxd=0):
    """Держим шорт с первого дня входа до дня выхода (или не дольше maxd дней)."""
    W = np.zeros(C.shape)
    for k in range(C.shape[1]):
        on, d = False, 0
        for t in range(C.shape[0]):
            if on:
                d += 1
                if exit_[t, k] or (maxd and d >= maxd):
                    on = False
            elif entry[t, k] and not exit_[t, k]:
                on, d = True, 0
            W[t, k] = 1.0 if on else 0.0
    return W
