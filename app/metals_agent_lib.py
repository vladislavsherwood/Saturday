"""Общий стенд для 10 кругов исследования стратегии металлов (metals_agent_loopN.py).

Модель — та же, что в build_metals_report.py: взнос $300 в месяц с первого месяца истории металла, решение по данным месяца
исполняется по средней цене следующего месяца, комиссия 0,1%. План месяца — число: 1 — обычный взнос, 1 + g — взнос и доля g
резерва, −f — продать долю f позиции (взнос уходит в резерв), 0 — пропустить покупку (взнос уходит в резерв).
Итог — к обычному DCA, %. Периоды: до 1999 (подбор), после 1999 (проверка, новый старт с нуля), вся история.

Метрики близости к дну и вершине (будущие цены — только для оценки, не для решений):
- выше мин. — на сколько % цена докупок резерва выше минимума цены за ±24 месяца (взвешено по деньгам; меньше — лучше);
- в зоне — доля денег резерва, вложенная не выше +15% от этого минимума;
- доньев: крупное дно (pivots с порогом металла) — была ли докупка резерва в ±12 месяцах по цене ≤ +25% от дна, и было ли таких месяцев ≥ 2;
- продажи к вершине — цена продажи к максимуму за ±24 месяца (взвешено по деньгам; больше — лучше);
- пропущено вершин — крупная вершина без единой продажи в ±12 месяцах по цене ≥ 75% вершины.
"""
import os
import pickle
import sys
import time
import warnings

import numpy as np
import pandas as pd
from numba import njit

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import data  # noqa: E402
import macro  # noqa: E402
import metals_long as ml  # noqa: E402
from metals_monthly import BOT, CUT, TOP  # noqa: E402

UNIT, FEE = 300.0, 0.001
ORDER = [("gold", "Золото"), ("silver", "Серебро"), ("platinum", "Платина"), ("palladium", "Палладий"), ("copper", "Медь"), ("aluminum", "Алюминий"),
         ("nickel", "Никель"), ("lead", "Свинец"), ("zinc", "Цинк"), ("tin", "Олово")]
NAME = dict(ORDER)
SEL = list(ml.METALS)                    # восемь металлов отбора
EXAM = ["palladium", "tin"]              # экзамен
FACTOR = {**{k: v[2] for k, v in ml.METALS.items()}, "palladium": 1.8, "tin": 1.6}
DAILY = {"gold": "GC=F", "silver": "SI=F", "platinum": "PL=F", "palladium": "PA=F", "copper": "HG=F", "aluminum": "ALI=F"}
PKL = os.path.join(data.CACHE, "metals_agent_data.pkl")


def _table():
    X = ml.monthly_table()
    x = pd.read_excel(os.path.join(data.CACHE, "wb_cmo_monthly.xlsx"), sheet_name="Monthly Prices", header=None)
    names = [str(v).strip() for v in x.iloc[4].values]
    body = x.iloc[6:]
    idx = pd.to_datetime(body.iloc[:, 0].astype(str).str.replace("M", "-") + "-01") + pd.offsets.MonthEnd(0)
    X["tin"] = pd.Series(pd.to_numeric(body.iloc[:, names.index("Tin")], errors="coerce").values, index=idx).reindex(X.index)
    X["palladium"] = macro.long_history("PA=F")["c"].resample("ME").mean().reindex(X.index)
    return X


def load(fresh=False):
    """По каждому металлу: цены, попадания маркеров (n×7), признаки, минимум/максимум внутри месяца для маржи."""
    if not fresh and os.path.exists(PKL) and time.time() - os.path.getmtime(PKL) < 86400:
        return pickle.load(open(PKL, "rb"))
    X = _table()
    F = {k: ml.features(X, k) for k, _ in ORDER}
    pool = pd.concat([F[k][F[k].index < CUT] for k in ml.METALS])
    thr = {(f, d): float(pool[f].dropna().quantile(0.8 if d == "hi" else 0.2)) for f, d in TOP + BOT}
    hit = lambda k, f, d: ((F[k][f] > thr[(f, d)]) if d == "hi" else (F[k][f] < thr[(f, d)])).fillna(False)      # noqa: E731
    D = {}
    for k, title in ORDER:
        start = "1972-01-01" if k in ("gold", "silver") else "1965-01-01"
        c = X[k][X.index >= start].dropna()
        hT = np.column_stack([hit(k, f, d).reindex(c.index).values for f, d in TOP]).astype(np.int64)
        hB = np.column_stack([hit(k, f, d).reindex(c.index).values for f, d in BOT]).astype(np.int64)
        cv = c.values.astype(np.float64)
        # минимум / максимум внутри месяца: дневные закрытия (×0,97 / ×1,03 на тени), иначе консервативно от средних соседних месяцев ±10%
        prv = np.r_[cv[0], cv[:-1]]; nxt = np.r_[cv[1:], cv[-1]]
        lo = np.minimum.reduce([cv, (cv + prv) / 2, (cv + nxt) / 2]) * 0.9
        hi = np.maximum.reduce([cv, (cv + prv) / 2, (cv + nxt) / 2]) * 1.1
        if k in DAILY:
            h = macro.long_history(DAILY[k])["c"]
            g = h.groupby(h.index.to_period("M"))
            rl = (g.min() / g.mean()).reindex(c.index.to_period("M")).values
            rh = (g.max() / g.mean()).reindex(c.index.to_period("M")).values
            nd = g.size().reindex(c.index.to_period("M")).fillna(0).values
            ok = np.isfinite(rl) & (nd >= 15)
            lo = np.where(ok, cv * rl * 0.97, lo)
            hi = np.where(ok, cv * rh * 1.03, hi)
        D[k] = {"name": title, "c": cv, "t": c.index, "hT": hT, "hB": hB, "tn": hT.sum(1), "bn": hB.sum(1), "F": F[k].reindex(c.index),
                "lo": lo, "hi": hi, "ff": X["ff"].reindex(c.index).ffill().fillna(5.0).values, "tb3": X["tb3"].reindex(c.index).ffill().fillna(5.0).values,
                "m": int(np.searchsorted(c.index.values, np.datetime64(CUT))), "factor": FACTOR[k]}
    D["_thr"] = thr
    D["_X"] = X
    pickle.dump(D, open(PKL, "wb"))
    return D


def metals(D):
    return [k for k, _ in ORDER if k in D]


@njit(cache=True)
def sim(c, plan, lo, hi, lag, rate, ntr=0):
    """Итог к DCA, % на [lo, hi); rate — доход резерва за месяц (0 — как в основе). Возвращает итог, докупки резерва и продажи по месяцам.
    ntr > 0 — равные доли: в первый месяц серии докупок (план > 1) фиксируется доля = резерв × (план − 1) / ntr, дальше каждый месяц серии — она же."""
    n = len(c)
    bx = np.zeros(n)
    sx = np.zeros(n)
    cash = 0.0
    units = 0.0
    du = 0.0
    tr = 0.0
    prev = 1.0
    for i in range(lo, hi):
        p = c[i]
        j = i - 1 - lag
        a = plan[j] if j >= lo else 1.0
        cash *= 1 + rate[i]
        before = cash
        cash += UNIT
        du += UNIT * (1 - FEE) / p
        if a < 0:
            v = -a * units * p
            if v > 0:
                units += a * units
                cash += v * (1 - FEE)
                sx[i] = v
        elif a > 0:
            if ntr > 0 and a > 1.0:
                if prev <= 1.0:
                    tr = before * (a - 1.0) / ntr
                v = min(cash, UNIT + tr)
            else:
                v = min(cash, UNIT * min(a, 1.0) + max(a - 1.0, 0.0) * before)
            units += v * (1 - FEE) / p
            cash -= v
            if v > UNIT * 1.001:
                bx[i] = v - UNIT
        prev = a
    return ((units * c[hi - 1] + cash) / (du * c[hi - 1]) - 1) * 100, bx, sx


def edges(d, plan, lag=0, interest=False, ntr=0):
    c, m, n = d["c"], d["m"], len(d["c"])
    rate = d["tb3"] / 1200 if interest else np.zeros(n)
    plan = np.asarray(plan, np.float64)
    out = {}
    out["before"] = sim(c, plan, 0, m, lag, rate, ntr)[0] if m > 24 else np.nan
    out["after"] = sim(c, plan, m, n, lag, rate, ntr)[0]
    e, bx, sx = sim(c, plan, 0, n, lag, rate, ntr)
    out["full"] = e
    out["bx"], out["sx"] = bx, sx
    return out


def proximity(d, bx, sx):
    """Метрики близости к дну и вершине по сделкам с первой даты (см. описание модуля)."""
    c = d["c"]
    n = len(c)
    w = 24
    mn = np.array([c[max(0, i - w): i + w + 1].min() for i in range(n)])
    mx = np.array([c[max(0, i - w): i + w + 1].max() for i in range(n)])
    r = {}
    tb = bx.sum()
    r["above"] = float((bx * (c / mn - 1)).sum() / tb * 100) if tb > 0 else np.nan
    r["zone"] = float(bx[c <= mn * 1.15].sum() / tb * 100) if tb > 0 else np.nan
    ts = sx.sum()
    r["sell_top"] = float((sx * c / mx).sum() / ts * 100) if ts > 0 else np.nan
    pv = ml.pivots(c, d["factor"])
    bots = [i for i, s in pv if s < 0]
    tops = [i for i, s in pv if s > 0]
    b1 = b2 = 0
    for i in bots:
        j = np.arange(max(0, i - 12), min(n, i + 13))
        k = ((bx[j] > 0) & (c[j] <= c[i] * 1.25)).sum()
        b1 += k >= 1
        b2 += k >= 2
    miss = 0
    for i in tops:
        j = np.arange(max(0, i - 12), min(n, i + 13))
        miss += not ((sx[j] > 0) & (c[j] >= c[i] * 0.75)).any()
    r.update({"bots": len(bots), "b1": b1, "b2": b2, "tops": len(tops), "miss": miss, "buy_months": int((bx > 0).sum()), "sell_months": int((sx > 0).sum())})
    return r


def base_plan(d):
    tn, bn = d["tn"], d["bn"]
    return np.select([bn >= 4, tn >= 6, tn >= 5], [2.0, -0.3, -0.1], default=1.0).astype(np.float64)


def run(D, planfn, keys=None, lag=0, interest=False, prox=True, ntr=0):
    """planfn(d) → план по месяцам (или (план, ntr)). Возвращает {металл: {before, after, full, (метрики)}}."""
    out = {}
    for k in keys or metals(D):
        d = D[k]
        p = planfn(d)
        nt = ntr
        if isinstance(p, tuple):
            p, nt = p
        e = edges(d, p, lag, interest, nt)
        if lag == 0 and not interest:
            e1 = edges(d, p, 1, False, nt)
            e["full_lag1"], e["after_lag1"], e["before_lag1"] = e1["full"], e1["after"], e1["before"]
        if prox:
            e.update(proximity(d, e["bx"], e["sx"]))
        out[k] = e
    return out


def rel(a, b):
    """Насколько итог a лучше итога b, % (по отношению капиталов)."""
    return ((1 + a / 100) / (1 + b / 100) - 1) * 100


def compare(R, B, keys=SEL, parts=("before", "after", "full")):
    """Сводка против основы: для каждой части — в скольких металлах не хуже (−0,5 п.п. допуск), медиана и худшая разница."""
    s = {}
    for p in parts:
        dd = np.array([rel(R[k][p], B[k][p]) for k in keys if np.isfinite(B[k][p])])
        s[p] = {"ok": int((dd >= -0.5).sum()), "n": len(dd), "med": float(np.median(dd)), "worst": float(dd.min()), "logsum": float(np.log1p(dd / 100).sum() * 100)}
    return s


def agg_prox(R, keys):
    def wavg(f):
        v = [R[k][f] for k in keys if np.isfinite(R[k][f])]
        return float(np.mean(v)) if v else np.nan
    return {"above": wavg("above"), "zone": wavg("zone"), "sell_top": wavg("sell_top"),
            "bots": sum(R[k]["bots"] for k in keys), "b1": sum(R[k]["b1"] for k in keys), "b2": sum(R[k]["b2"] for k in keys),
            "tops": sum(R[k]["tops"] for k in keys), "miss": sum(R[k]["miss"] for k in keys)}


def fmt_prox(a):
    return (f"докупки выше мин.±24 на {a['above']:.0f}%, в зоне +15% {a['zone']:.0f}% денег, доньев с докупкой {a['b1']}/{a['bots']}, с ≥2 мес. {a['b2']}/{a['bots']}; "
            f"продажи на {a['sell_top']:.0f}% от макс.±24, пропущено вершин {a['miss']}/{a['tops']}")


def line(R, keys, parts=("before", "after", "full")):
    return ", ".join(f"{NAME[k]} " + "/".join("—" if not np.isfinite(R[k][p]) else f"{R[k][p]:+.0f}" for p in parts) for k in keys)


def summary_line(name, R, B, keys=SEL):
    s = compare(R, B, keys)
    a = agg_prox(R, keys)
    return (f"{name}\n   разница: до 1999 не хуже {s['before']['ok']}/{s['before']['n']}, медиана {s['before']['med']:+.1f}, худший {s['before']['worst']:+.1f} | "
            f"после {s['after']['ok']}/{s['after']['n']}, {s['after']['med']:+.1f}, {s['after']['worst']:+.1f} | вся {s['full']['ok']}/{s['full']['n']}, {s['full']['med']:+.1f}, {s['full']['worst']:+.1f}"
            f"\n   {fmt_prox(a)}")


def runs(m):
    """Сколько месяцев подряд держится условие m (включая текущий)."""
    out = np.zeros(len(m), np.int64)
    k = 0
    for i, x in enumerate(m):
        k = k + 1 if x else 0
        out[i] = k
    return out


def since(m):
    """Сколько месяцев прошло с последнего месяца, где m истинно (большое число — ещё не было)."""
    out = np.full(len(m), 10 ** 6, np.int64)
    last = -10 ** 6
    for i, x in enumerate(m):
        if x:
            last = i
        out[i] = i - last
    return out


def study(D, cands, B, keys=SEL, show=12, sort="before", extra=None):
    """Считает каждый вариант (имя → planfn), печатает лучшие по сумме лог-разниц к основе на периоде sort (по умолчанию — до 1999)."""
    rows = []
    for name, fn in cands.items():
        R = run(D, fn, keys)
        s = compare(R, B, keys)
        rows.append({"name": name, "R": R, "s": s, "a": agg_prox(R, keys)})
    rows.sort(key=lambda r: -r["s"][sort]["logsum"])
    for r in rows[:show]:
        s, a = r["s"], r["a"]
        print(f"  {r['name']}\n     до 1999: не хуже {s['before']['ok']}/8, сумма {s['before']['logsum']:+.0f}, мед. {s['before']['med']:+.1f}, худш. {s['before']['worst']:+.1f} | "
              f"после: {s['after']['ok']}/8, сумма {s['after']['logsum']:+.0f}, мед. {s['after']['med']:+.1f}, худш. {s['after']['worst']:+.1f} | вся: {s['full']['ok']}/8, мед. {s['full']['med']:+.1f}, худш. {s['full']['worst']:+.1f}"
              f"\n     доньев ≥1/≥2 мес.: {a['b1']}/{a['b2']} из {a['bots']}, выше мин. {a['above']:.0f}%, в зоне {a['zone']:.0f}% | продажи {a['sell_top']:.0f}%, пропущено {a['miss']}/{a['tops']}")
    return rows


def lagcheck(R, B, keys=SEL):
    """Устойчивость к исполнению на месяц позже: разница к основе (тоже со сдвигом) по всей истории."""
    dd = np.array([rel(R[k]["full_lag1"], B[k]["full_lag1"]) for k in keys])
    da = np.array([rel(R[k]["after_lag1"], B[k]["after_lag1"]) for k in keys])
    return f"сдвиг исполнения на месяц: вся история не хуже {(dd >= -0.5).sum()}/{len(dd)}, мед. {np.median(dd):+.1f}; после 1999 не хуже {(da >= -0.5).sum()}/{len(da)}, мед. {np.median(da):+.1f}"


def episode(bn, k_on, k_hold):
    """Серия докупок: начинается при bn ≥ k_on, держится, пока bn ≥ k_hold."""
    ep = np.zeros(len(bn), bool)
    for i in range(len(bn)):
        ep[i] = bn[i] >= k_on or (i > 0 and ep[i - 1] and bn[i] >= k_hold)
    return ep


def base_sells(d):
    tn = d["tn"]
    return np.select([tn >= 6, tn >= 5], [-0.3, -0.1], default=1.0)


def r1_plan(d, sell=None, g=0.5):
    """Рабочая основа после круга 1: дна ≥ 4 → 50% резерва в месяц, серия держится при дна ≥ 3; иначе продажи (по умолчанию как в основе)."""
    s = base_sells(d) if sell is None else sell(d)
    return np.where(episode(d["bn"], 4, 3), 1 + g, s)


def pooled(D, f, q, keys=SEL):
    """Процентиль q признака f по месяцам до 1999 года на металлах keys."""
    v = np.concatenate([D[k]["F"][f].values[: D[k]["m"]] for k in keys])
    v = v[np.isfinite(v)]
    return float(np.quantile(v, q))


P3, Y1 = "Цена к средней за 3 года", "Изменение за год, %"


def r2_sells(d, s5=0.15, s6=0.5, hot3=1.81, hot1=86.0, sh=0.2):
    """Продажи после круга 2: вершины 5 → 15%, ≥6 → 50%; цена к средней за 3 года > 1,81 и рост за год > 86% → продать 20% (бо́льшая из продаж)."""
    tn = d["tn"]
    p = np.select([tn >= 6, tn >= 5], [-s6, -s5], default=1.0)
    hot = (np.nan_to_num(d["F"][P3].values) > hot3) & (np.nan_to_num(d["F"][Y1].values) > hot1)
    return np.where(hot, np.minimum(p, -sh), p)


def r2_plan(d):
    return r1_plan(d, r2_sells)


def own_thr(d, q, marks, until=None):
    """Пороги маркеров по собственной истории металла до 1999 (или до индекса until)."""
    m = d["m"] if until is None else until
    out = {}
    for f, dr in marks:
        v = d["F"][f].values[:m]
        v = v[np.isfinite(v)]
        out[(f, dr)] = float(np.quantile(v, q if dr == "hi" else 1 - q)) if len(v) > 24 else np.nan
    return out


def count(d, thr, marks):
    n = np.zeros(len(d["c"]), np.int64)
    for f, dr in marks:
        x = d["F"][f].values
        t = thr[(f, dr)]
        h = (x > t) if dr == "hi" else (x < t)
        n += np.nan_to_num(h, nan=0).astype(np.int64)
    return n


def plan_generic(d, tn, bn, g=0.5, k_on=4, k_hold=3, s5=0.15, s6=0.5, k5=5, k6=6, hot3=1.81, hot1=86.0, sh=0.2):
    """R2 с заданными счётчиками маркеров и порогами перегрева."""
    p = np.select([tn >= k6, tn >= k5], [-s6, -s5], default=1.0)
    hot = (np.nan_to_num(d["F"][P3].values) > hot3) & (np.nan_to_num(d["F"][Y1].values) > hot1)
    p = np.where(hot, np.minimum(p, -sh), p)
    return np.where(episode(bn, k_on, k_hold), 1 + g, p)
