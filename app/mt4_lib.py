"""Стенд четвёртого агента по металлам (mt4): месячная модель (поверх стендов агентов 1–3, без их изменения) и дневная модель.

Месячная часть: замороженные данные агента 2 (cache/metals_agent2_data.pkl, месяцы по 2026-10), планы R3 / R6 / Q2,
продление на неполный ноябрь 2026 (средняя дневных фьючерсов, приведённая к ряду Всемирного банка по октябрю).

Дневная часть (протокол — research/mt4_journal.md): взнос $10 каждый торговый день, план дня решается по закрытию дня j и исполняется
по закрытию дня j + 1 + lag; комиссия 0,1%; итог — к дневному DCA, %. Данные замораживаются в cache/mt4_daily.pkl.
"""
import os
import pickle
import sys
import warnings

import numpy as np
import pandas as pd
from numba import njit

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import data  # noqa: E402
import metals_agent2_lib as A  # noqa: E402
import metals_agent3_lib as T  # noqa: E402
import metals_agent_lib as L  # noqa: E402
from metals_agent3_loop5 import cool  # noqa: E402

NAME = L.NAME
DPKL = os.path.join(data.CACHE, "mt4_daily.pkl")
LOGDIR = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/mt4"
DSYM = {"gold": "GC=F", "silver": "SI=F", "platinum": "PL=F", "copper": "HG=F", "palladium": "PA=F", "aluminum": "ALI=F"}
DSEL = ["gold", "silver", "platinum", "copper"]
DEXAM = ["palladium", "aluminum"]
START = "2000-09-01"
HSPLIT = "2013-10-01"
EPIS = {"2008": ("2008-07-01", "2009-03-31"), "2011–13": ("2011-04-01", "2013-12-31"), "2020-03": ("2020-02-01", "2020-04-30"),
        "2022": ("2022-03-01", "2022-10-31"), "2025–26": ("2025-06-01", "2026-11-30")}
MACRO = {"btc": "BTC-USD", "dxy": "DX-Y.NYB", "tnx": "^TNX", "vix": "^VIX"}


# ---------------- месячная модель ----------------
def q2plan(hot2=0.5, v=0.2, N=24):
    return cool(lambda dd: A.r3(dd, hot2=hot2), v, N)


VERS = {"R3": A.ver("R3"), "R6": A.ver("R6"), "Q2": q2plan()}


def mload():
    return T.load()


def nov_extend(D, keys=("gold", "silver", "platinum", "palladium", "copper", "aluminum")):
    """Копия D, где у металлов с дневными фьючерсами добавлен неполный ноябрь 2026 (план ноября = 1)."""
    import macro
    E = dict(D)
    for k in keys:
        h = macro.long_history(DSYM[k])["c"]
        mo = h.resample("ME").mean()
        d = dict(D[k])
        last = d["t"][-1]
        if mo.index[-1] <= last:
            continue
        sc = d["c"][-1] / mo.loc[last]
        nv = float(mo.iloc[-1] * sc)
        d["c"] = np.r_[d["c"], nv]
        d["t"] = d["t"].append(pd.DatetimeIndex([mo.index[-1]]))
        d["nov"] = True
        E[k] = d
    return E


def mplan(d, fn):
    """План по месяцам для d (если d продлён на ноябрь — план ноября = 1)."""
    if d.get("nov"):
        dd = dict(d)
        n0 = len(d["c"]) - 1
        dd["c"] = d["c"][:n0]
        dd["t"] = d["t"][:n0]
        return np.r_[fn(dd), 1.0]
    return fn(d)


def msim(c, plan, a0, a1, lag=0, rate=None):
    n = len(c)
    rate = np.zeros(n) if rate is None else rate
    return L.sim(c, np.asarray(plan, np.float64), a0, a1, lag, rate)


@njit(cache=True)
def msim_state(c, plan, lo, hi, lag):
    """Как L.sim, но возвращает траектории: монеты, резерв, вложено, DCA-монеты."""
    n = len(c)
    U = np.zeros(n); C = np.zeros(n); DU = np.zeros(n)
    cash = 0.0; units = 0.0; du = 0.0
    for i in range(lo, hi):
        p = c[i]
        j = i - 1 - lag
        a = plan[j] if j >= lo else 1.0
        before = cash
        cash += 300.0
        du += 300.0 * 0.999 / p
        if a < 0:
            v = -a * units * p
            if v > 0:
                units += a * units
                cash += v * 0.999
        elif a > 0:
            v = min(cash, 300.0 * min(a, 1.0) + max(a - 1.0, 0.0) * before)
            units += v * 0.999 / p
            cash -= v
        U[i] = units; C[i] = cash; DU[i] = du
    return U, C, DU


# ---------------- дневная модель ----------------
def dload(fresh=False):
    """Дневные ряды: {металл: DataFrame(c, h, l)}, макро (btc, dxy, tnx, vix — закрытия), ставки ФРС/векселей и инфляция по месяцам."""
    if not fresh and os.path.exists(DPKL):
        return pickle.load(open(DPKL, "rb"))
    import macro
    out = {"m": {}, "x": {}}
    for k, s in DSYM.items():
        h = macro.long_history(s)["c"]
        f = pd.DataFrame({"c": h})
        f["h"] = np.nan
        f["l"] = np.nan
        try:
            data.history(s)                      # создаёт / обновляет cache/ohlcv_*.json (свечи с 2009)
        except Exception:  # noqa: BLE001
            pass
        path = os.path.join(data.CACHE, f"ohlcv_{''.join(ch if ch.isalnum() else '_' for ch in s)}.json")
        if os.path.exists(path):
            import json
            raw = json.load(open(path))
            idx = pd.to_datetime(raw["t"], unit="s").normalize()
            for col in ("h", "l"):
                x = pd.Series(raw.get(col) or raw["c"], index=idx, dtype=float)
                x = x[~x.index.duplicated(keep="last")]
                f[col] = x.reindex(f.index)
        out["m"][k] = f
    for k, s in MACRO.items():
        out["x"][k] = macro.long_history(s)["c"]
    D = mload()
    X = D["_X"]
    out["monthly"] = X[["ff", "tb3", "cpi", "y10"]].copy()
    pickle.dump(out, open(DPKL, "wb"))
    return out


def dseries(DD, k, start=START):
    f = DD["m"][k]
    f = f[f.index >= start].dropna(subset=["c"])
    f = f[f["c"] > 0]
    return f


def monthly_on_days(s, idx, lag_days=0):
    """Месячный ряд (конец месяца) → дни idx (значение известно с первого дня следующего месяца + lag_days)."""
    s = s.dropna()
    s2 = s.copy()
    s2.index = s2.index + pd.Timedelta(days=1 + lag_days)
    return s2.reindex(idx, method="ffill").values


def mmap(plan_m, t_m, idx, spread=True):
    """Месячный план (решение по месяцу M, известно в конце M) → дневной план на торговые дни месяца M+1.
    spread=True: докупка g за месяц → g_d = 1 − (1 − g)^(1/nd) в день; продажа f → f_d = 1 − (1 − f)^(1/nd) в день; 0 → 0 весь месяц.
    spread=False: вся продажа / докупка в первый торговый день месяца, дальше обычный взнос (0 — весь месяц)."""
    pm = pd.Series(plan_m, index=pd.DatetimeIndex(t_m).to_period("M"))
    per = idx.to_period("M")
    prev = (per - 1)
    a = pm.reindex(prev).values
    a = np.where(np.isnan(a), 1.0, a)
    nd = pd.Series(1, index=idx).groupby(per).transform("sum").values
    first = np.r_[True, per[1:] != per[:-1]]
    out = np.ones(len(idx))
    for i in range(len(idx)):
        x = a[i]
        if x > 1.0:
            g = min(x - 1.0, 0.999)
            out[i] = 1.0 + (1 - (1 - g) ** (1.0 / nd[i]) if spread else (g if first[i] else 0.0))
        elif x < 0:
            f = min(-x, 0.999)
            fd = 1 - (1 - f) ** (1.0 / nd[i]) if spread else (f if first[i] else 0.0)
            out[i] = -fd if fd > 0 else 1.0
        else:
            out[i] = x
    return out


@njit(cache=True)
def dsim(c, plan, lo, hi, lag, rate, fee):
    """Дневной счёт: итог к DCA, %, докупки резерва, продажи по дням, резерв и монеты в конце.
    plan[j] решается по закрытию j и исполняется по закрытию j + 1 + lag. rate[i] — доход резерва за день."""
    n = len(c)
    bx = np.zeros(n)
    sx = np.zeros(n)
    cash = 0.0
    units = 0.0
    du = 0.0
    for i in range(lo, hi):
        p = c[i]
        j = i - 1 - lag
        a = plan[j] if j >= lo else 1.0
        cash *= 1 + rate[i]
        before = cash
        cash += 10.0
        du += 10.0 * (1 - fee) / p
        if a < 0:
            v = -a * units * p
            if v > 0:
                units += a * units
                cash += v * (1 - fee)
                sx[i] = v
        elif a > 0:
            v = min(cash, 10.0 * min(a, 1.0) + max(a - 1.0, 0.0) * before)
            units += v * (1 - fee) / p
            cash -= v
            if v > 10.0 * 1.001:
                bx[i] = v - 10.0
    fin = units * c[hi - 1] + cash
    return (fin / (du * c[hi - 1]) - 1) * 100, bx, sx, cash, units


def rel(a, b):
    return ((1 + a / 100) / (1 + b / 100) - 1) * 100


class Day:
    """Дневной металл: цены, индексы половин, вспомогательные ряды."""

    def __init__(self, DD, k, start=START):
        f = dseries(DD, k, start)
        self.k = k
        self.t = f.index
        self.c = f["c"].values.astype(np.float64)
        self.h = f["h"].values.astype(np.float64)
        self.l = f["l"].values.astype(np.float64)
        self.n = len(self.c)
        self.hs = int(np.searchsorted(self.t.values, np.datetime64(HSPLIT)))
        mon = DD["monthly"]
        self.ff = monthly_on_days(mon["ff"], self.t)
        self.tb3 = monthly_on_days(mon["tb3"], self.t)
        self.rate0 = np.zeros(self.n)
        self.ratetb = np.nan_to_num(self.tb3, nan=2.0) / 100 / 252

    def seg(self, part):
        return {"h1": (0, self.hs), "h2": (self.hs, self.n), "full": (0, self.n)}[part]

    def run(self, plan, part="full", lag=0, rate=None, fee=0.001):
        a0, a1 = self.seg(part) if isinstance(part, str) else part
        r = self.rate0 if rate is None else rate
        if a1 - a0 < 250:
            z = np.zeros(self.n)
            return np.nan, z, z, 0.0, 0.0
        return dsim(self.c, np.asarray(plan, np.float64), a0, a1, lag, r, fee)


def dmetals(DD, keys, start=START):
    return {k: Day(DD, k, start) for k in keys}


def dstat(M, planfn, Ref, keys=DSEL, lag_check=True, starts=True, episodes=True, basefn=None, rate=False):
    """Сравнение правила planfn(X) → план с основой Ref (planfn основы) по протоколу дневной модели.
    Возвращает словарь: ячейки (металл × половина), сумма, половины, сдвиг, без эпизода, старты."""
    o = {"cells": {}, "lag": {}, "full": {}, "ep": {}, "starts": []}
    for k in keys:
        X = M[k]
        p, p0 = planfn(X), Ref(X)
        rt = X.ratetb if rate else None
        for part in ("h1", "h2"):
            o["cells"][(k, part)] = rel(X.run(p, part, rate=rt)[0], X.run(p0, part, rate=rt)[0])
            if lag_check:
                o["lag"][(k, part)] = rel(X.run(p, part, 1, rate=rt)[0], X.run(p0, part, 1, rate=rt)[0])
        o["full"][k] = rel(X.run(p, "full", rate=rt)[0], X.run(p0, "full", rate=rt)[0])
        if episodes:
            for nm, (a, b) in EPIS.items():
                w = (X.t >= a) & (X.t <= b)
                pe = np.where(w, p0, p)
                for part in ("h1", "h2"):
                    o["ep"].setdefault(nm, {})[(k, part)] = rel(X.run(pe, part, rate=rt)[0], X.run(p0, part, rate=rt)[0])
        if starts:
            for y in range(2001, 2021):
                a0 = int(np.searchsorted(X.t.values, np.datetime64(f"{y}-01-01")))
                o["starts"].append(rel(X.run(p, (a0, X.n), rate=rt)[0], X.run(p0, (a0, X.n), rate=rt)[0]))
    v = np.array(list(o["cells"].values()))
    o["ok"] = int((v >= -0.5).sum())
    o["worst"] = float(v.min())
    o["sum"] = float(np.log1p(v / 100).sum() * 100)
    o["h1"] = float(sum(np.log1p(o["cells"][(k, "h1")] / 100) for k in keys) * 100)
    o["h2"] = float(sum(np.log1p(o["cells"][(k, "h2")] / 100) for k in keys) * 100)
    if lag_check:
        o["lagsum"] = float(np.log1p(np.array(list(o["lag"].values())) / 100).sum() * 100)
    if episodes:
        o["epsum"] = {nm: float(np.log1p(np.array(list(d.values())) / 100).sum() * 100) for nm, d in o["ep"].items()}
    if starts:
        s = np.array(o["starts"])
        o["share"] = float((s >= -0.5).mean() * 100)
    return o


def dok(o, min_ok=7, min_worst=-3.0, min_sum=4.0):
    why = []
    if o["ok"] < min_ok:
        why.append(f"не хуже {o['ok']}/8")
    if o["worst"] < min_worst:
        why.append(f"худшая {o['worst']:+.1f}")
    if o["sum"] < min_sum:
        why.append(f"сумма {o['sum']:+.1f}")
    if o["h1"] < 0 or o["h2"] < 0:
        why.append(f"половины {o['h1']:+.1f}/{o['h2']:+.1f}")
    if "lagsum" in o and o["lagsum"] < 0:
        why.append(f"сдвиг {o['lagsum']:+.1f}")
    if "epsum" in o:
        bad = [nm for nm, v in o["epsum"].items() if v < 0]
        if bad:
            why.append("без эпизода " + ",".join(bad))
    if "share" in o and o["share"] < 70:
        why.append(f"старты {o['share']:.0f}%")
    return not why, "; ".join(why)


def dfmt(o, keys=DSEL):
    cells = " ".join(f"{NAME[k][:3]} {o['cells'][(k, 'h1')]:+.1f}/{o['cells'][(k, 'h2')]:+.1f}" for k in keys)
    s = f"сумма {o['sum']:+.1f} (H1 {o['h1']:+.1f}, H2 {o['h2']:+.1f}), не хуже {o['ok']}/8, худшая {o['worst']:+.1f} | {cells}"
    if "lagsum" in o:
        s += f" | сдвиг {o['lagsum']:+.1f}"
    if "epsum" in o:
        s += " | без эпиз. мин " + f"{min(o['epsum'].values()):+.1f}"
    if "share" in o:
        s += f" | старты {o['share']:.0f}%"
    return s


def dplateau(by, key, axes):
    for j, vals in enumerate(axes):
        if vals is None:
            continue
        i = vals.index(key[j])
        for dj in (-1, 1):
            if 0 <= i + dj < len(vals):
                nk = list(key); nk[j] = vals[i + dj]
                nk = tuple(nk)
                if nk in by and not by[nk]:
                    return False
    return True


# ---------- дневные признаки ----------
def sma(x, n):
    return pd.Series(x).rolling(n, min_periods=int(n * 0.8)).mean().values


def ret(x, n):
    s = pd.Series(x)
    return (s / s.shift(n) - 1).values * 100


def ath_dd(x):
    s = pd.Series(x)
    return (s / s.cummax() - 1).values * 100


def on_days(s, idx):
    """Дневной ряд другого рынка → торговые дни металла (последнее значение с датой ≤ дня; только прошлое)."""
    s = s.dropna()
    s = s[~s.index.duplicated(keep="last")]
    return s.reindex(s.index.union(idx)).ffill().reindex(idx).values


def tee(path):
    """Печать и в консоль, и в файл лога."""
    os.makedirs(LOGDIR, exist_ok=True)
    f = open(os.path.join(LOGDIR, path), "w")
    orig = sys.stdout

    class W:
        def write(self, s):
            orig.write(s); f.write(s)

        def flush(self):
            orig.flush(); f.flush()
    sys.stdout = W()
    return f


@njit(cache=True)
def dsim2(c, plan, defer, release, lo, hi, lag, rate, fee):
    """Как dsim, плюс отложенные взносы: defer[j] — взнос дня (если по плану он покупался) уходит в отдельный «долг», release[j] — весь долг
    покупается по закрытию. Долг не смешивается с резервом плана. Возвращает итог к DCA, %."""
    cash = 0.0
    owed = 0.0
    units = 0.0
    du = 0.0
    for i in range(lo, hi):
        p = c[i]
        j = i - 1 - lag
        a = plan[j] if j >= lo else 1.0
        df = defer[j] if j >= lo else False
        rl = release[j] if j >= lo else False
        cash *= 1 + rate[i]
        before = cash
        du += 10.0 * (1 - fee) / p
        if df and a >= 1.0:
            owed += 10.0
            cash += 0.0
            if a > 1.0:
                v = min(cash, (a - 1.0) * before)
                units += v * (1 - fee) / p
                cash -= v
        else:
            cash += 10.0
            if a < 0:
                v = -a * units * p
                if v > 0:
                    units += a * units
                    cash += v * (1 - fee)
            elif a > 0:
                v = min(cash, 10.0 * min(a, 1.0) + max(a - 1.0, 0.0) * before)
                units += v * (1 - fee) / p
                cash -= v
        if rl and owed > 0:
            units += owed * (1 - fee) / p
            owed = 0.0
    fin = units * c[hi - 1] + cash + owed
    return (fin / (du * c[hi - 1]) - 1) * 100


def segs_btc(X):
    a = int(np.searchsorted(X.t.values, np.datetime64("2014-10-01")))
    b = int(np.searchsorted(X.t.values, np.datetime64("2020-10-01")))
    return {"b1": (a, b), "b2": (b, X.n)}


def window_rule(event, W):
    """defer — в течение W дней после события (включая день события); release — первый день после окончания окна."""
    since = L.since(event)
    defer = (since <= W)
    release = np.r_[False, defer[:-1] & ~defer[1:]]
    return defer, release


def _norm(r, n):
    if isinstance(r, tuple):
        return r
    z = np.zeros(n, bool)
    return np.asarray(r, np.float64), z, z


def grun(X, r, seg, lag=0, rate=None, fee=0.001):
    p, df, rl = _norm(r, X.n)
    a0, a1 = X.seg(seg) if isinstance(seg, str) else seg
    if a1 - a0 < 250:
        return np.nan
    rt = X.rate0 if rate is None else rate
    return dsim2(X.c, np.asarray(p, np.float64), df, rl, a0, a1, lag, rt, fee)


def gstat(M_, fn, ref, keys=DSEL, starts=True, episodes=True, btc=False, rate=False):
    """Как dstat, но fn(X) может вернуть (план, defer, release); btc=True — ещё половины эры BTC (2014-10…2020-09 / 2020-10…)."""
    o = {"cells": {}, "lag": {}, "ep": {}, "starts": [], "bcells": {}}
    for k in keys:
        X = M_[k]
        r, r0 = _norm(fn(X), X.n), _norm(ref(X), X.n)
        rt = X.ratetb if rate else None
        for part in ("h1", "h2"):
            o["cells"][(k, part)] = rel(grun(X, r, part, rate=rt), grun(X, r0, part, rate=rt))
            o["lag"][(k, part)] = rel(grun(X, r, part, 1, rate=rt), grun(X, r0, part, 1, rate=rt))
        if btc:
            for nm, sg in segs_btc(X).items():
                o["bcells"][(k, nm)] = rel(grun(X, r, sg, rate=rt), grun(X, r0, sg, rate=rt))
        if episodes:
            for nm, (a, b) in EPIS.items():
                w = (X.t >= a) & (X.t <= b)
                pe = np.where(w, r0[0], r[0])
                de = np.where(w, r0[1], r[1])
                fst = np.r_[w[:1], w[1:] & ~w[:-1]]
                re = np.where(w, r0[2], r[2]) | (fst & r[1].any())
                for part in ("h1", "h2"):
                    o["ep"].setdefault(nm, {})[(k, part)] = rel(grun(X, (pe, de, re), part, rate=rt), grun(X, r0, part, rate=rt))
        if starts:
            for y in range(2001, 2021):
                a0 = int(np.searchsorted(X.t.values, np.datetime64(f"{y}-01-01")))
                o["starts"].append(rel(grun(X, r, (a0, X.n), rate=rt), grun(X, r0, (a0, X.n), rate=rt)))
    v = np.array(list(o["cells"].values()))
    v = np.nan_to_num(v)
    o["ok"] = int((v >= -0.5).sum())
    o["worst"] = float(v.min())
    o["sum"] = float(np.log1p(v / 100).sum() * 100)
    o["h1"] = float(sum(np.log1p(np.nan_to_num(o["cells"][(k, "h1")]) / 100) for k in keys) * 100)
    o["h2"] = float(sum(np.log1p(np.nan_to_num(o["cells"][(k, "h2")]) / 100) for k in keys) * 100)
    o["lagsum"] = float(np.log1p(np.nan_to_num(np.array(list(o["lag"].values()))) / 100).sum() * 100)
    if episodes:
        o["epsum"] = {nm: float(np.log1p(np.nan_to_num(np.array(list(d.values()))) / 100).sum() * 100) for nm, d in o["ep"].items()}
    if starts:
        s = np.array(o["starts"])
        o["share"] = float((s >= -0.5).mean() * 100)
    if btc:
        o["b1"] = float(sum(np.log1p(o["bcells"][(k, "b1")] / 100) for k in keys) * 100)
        o["b2"] = float(sum(np.log1p(o["bcells"][(k, "b2")] / 100) for k in keys) * 100)
    return o


def gok(o, **kw):
    ok, why = dok(o, **kw)
    if "b1" in o and (o["b1"] < 0 or o["b2"] < 0):
        why = (why + "; " if why else "") + f"эра BTC {o['b1']:+.1f}/{o['b2']:+.1f}"
        ok = False
    return ok, why


def gfmt(o, keys=DSEL):
    s = dfmt(o, keys)
    if "b1" in o:
        s += f" | эра BTC {o['b1']:+.1f}/{o['b2']:+.1f}"
    return s


@njit(cache=True)
def dsim_wick(c, low, plan, lo, hi, lag, k, f, fee):
    """Как dsim + лимит на покупку по цене c[j] × (1 − k) (j — вчерашний день) на долю f резерва; исполняется, если минимум дня ≤ уровня.
    Возвращает итог к DCA, %, число исполнений."""
    cash = 0.0
    units = 0.0
    du = 0.0
    nf = 0
    for i in range(lo, hi):
        p = c[i]
        j = i - 1 - lag
        a = plan[j] if j >= lo else 1.0
        if j >= lo and cash > 0 and low[i] > 0 and low[i] < p * 10:
            lv = c[i - 1] * (1 - k)
            if low[i] <= lv:
                v = f * cash
                units += v * (1 - fee) / lv
                cash -= v
                nf += 1
        before = cash
        cash += 10.0
        du += 10.0 * (1 - fee) / p
        if a < 0:
            v = -a * units * p
            if v > 0:
                units += a * units
                cash += v * (1 - fee)
        elif a > 0:
            v = min(cash, 10.0 * min(a, 1.0) + max(a - 1.0, 0.0) * before)
            units += v * (1 - fee) / p
            cash -= v
    return ((units * c[hi - 1] + cash) / (du * c[hi - 1]) - 1) * 100, nf


@njit(cache=True)
def dsim_margin(c, low, plan, lev, ff, lo, hi, lag, stress, spread, ml_lvl, fee):
    """Дневной счёт с займом: в день докупки из резерва (план > 1) к покупке добавляется заём lev[j] × (сумма из резерва).
    Проценты — ставка ФРС + spread годовых по дням (/252). Долг гасится выручкой продаж и деньгами резерва в обычные дни, взносами.
    Ликвидация: (монеты по минимуму дня × stress + деньги) / долг ≤ ml_lvl → всё продаётся по этому минимуму.
    Возвращает итог к DCA, %, ликвидации, мин. уровень обеспечения."""
    cash = 0.0
    units = 0.0
    debt = 0.0
    du = 0.0
    liq = 0
    worst = 1e9
    for i in range(lo, hi):
        p = c[i]
        j = i - 1 - lag
        a = plan[j] if j >= lo else 1.0
        L_ = lev[j] if j >= lo else 0.0
        debt *= 1 + (ff[i] + spread) / 100 / 252
        before = cash
        cash += 10.0
        du += 10.0 * (1 - fee) / p
        if a < 0:
            v = -a * units * p
            if v > 0:
                units += a * units
                cash += v * (1 - fee)
        elif a > 1.0:
            v = min(cash, 10.0 + (a - 1.0) * before)
            extra = L_ * max(v - 10.0, 0.0)
            units += (v + extra) * (1 - fee) / p
            cash -= v
            debt += extra
        elif a > 0:
            r = min(debt, 10.0) if debt > 0 else 0.0
            debt -= r
            cash -= r
            if 10.0 - r > 0:
                units += (10.0 - r) * (1 - fee) / p
                cash -= 10.0 - r
        if debt > 0 and cash > 0 and a <= 1.0:
            r = min(debt, cash)
            debt -= r
            cash -= r
        if debt > 0:
            pl = low[i] * stress
            lvl = (units * pl + cash) / debt
            if lvl < worst:
                worst = lvl
            if lvl <= ml_lvl:
                liq += 1
                cash += units * pl * (1 - fee) - debt
                units = 0.0
                debt = 0.0
    fin = units * c[hi - 1] + cash - debt
    return (fin / (du * c[hi - 1]) - 1) * 100, liq, worst
