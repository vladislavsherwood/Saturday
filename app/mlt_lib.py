"""Стенд mlt: ЛОКАЛЬНАЯ торговля металлами (недели–месяцы) — «ядро + торговая часть». Протокол — research/mlt_journal.md.
Поверх mcx_lib / mb_lib / mt4_lib без их изменения.

Устройство счёта:
- ядро — mb1 (дневной план `mb_r9.mb1`, без изменений) или DCA; получает (1 − f) каждого взноса;
- торговая часть — доля f капитала: такой же счёт ядра (те же взносы, те же сделки mb1), но «металл» торговой части по сигналу правила
  заменяется векселями (ставка 3-мес. векселей): e = 1 — держать металл, e = 0 — металл продан, деньги в векселях, e ∈ (0, 1) — частично.
  Пока e < 1, покупки mb1 торговой части идут в векселя (их «металл» запаркован), продажи mb1 забирают ту же долю запаркованных денег.
  Ребалансировка — только в день смены e (комиссия на проданное/купленное).
- итог: R = (1 − f)·R_ядра + f·R_торг (R = итог / стоимость DCA тех же взносов), поэтому прибавка к ядру = f·(R_торг / R_ядра − 1) — линейна по f;
- решение по закрытию дня j, исполнение по закрытию j + 1 + lag; комиссия 0,1% (проверка 0,5%);
- макро-резерв mb1 — как в протоколе mb (без дохода; проверка — векселя); запаркованные деньги торговой части — всегда векселя.
"""
import os
import sys

import numpy as np
import pandas as pd
from numba import njit

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mcx_lib as C  # noqa: E402
import mt4_lib as M  # noqa: E402

NAME = M.NAME
DSEL = ["gold", "silver", "platinum", "copper"]
DEX = ["palladium"]
ALL5 = DSEL + DEX
LOGDIR = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/mlt"
A0, B0, CUT = "2005-01-01", "2016-01-01", "2026-01-01"
EPW = C.EPW          # 2008, 2011, 2013, 2015–16, 2018, 2020, 2022 — окна «без эпизода» (торговая часть держит металл, e = 1)
rel = M.rel
lsum = C.lsum
ix = C.ix
F0 = 0.3             # доля торговой части (основная, записана до круга 1); справочно 0,2 и 0,5


def tee(path):
    os.makedirs(LOGDIR, exist_ok=True)
    M.LOGDIR = LOGDIR
    return M.tee(path)


def load():
    return C.load()


# ---------------- счёт ----------------
@njit(cache=True)
def simsw(c, pm, e, lo, hi, lag, rm, rt, fee):
    """Счёт с планом ядра pm (1 — взнос, > 1 — взнос + доля макро-резерва, < 0 — продать долю, 0 — копить) и экспозицией e (0…1)
    металла торговой части. Возвращает (итог к DCA %, покупки торговли $, продажи торговли $, экспозиция по дням)."""
    n = len(c)
    tb = np.zeros(n)
    ts = np.zeros(n)
    EX = np.ones(n)
    units = 0.0
    cm = 0.0
    ct = 0.0
    du = 0.0
    j0 = lo - 1 - lag
    cur = e[j0] if j0 >= 0 else 1.0
    for i in range(lo, hi):
        p = c[i]
        j = i - 1 - lag
        a = pm[j] if j >= lo else 1.0
        ee = e[j] if j >= 0 else 1.0
        cm *= 1 + rm[i]
        ct *= 1 + rt[i]
        before = cm
        du += 10.0 * (1 - fee) / p
        cm += 10.0
        if a < 0:
            fr = min(-a, 1.0)
            v = fr * units * p
            units -= fr * units
            w = fr * ct
            ct -= w
            cm += v * (1 - fee) + w
        elif a > 0:
            v = min(cm, 10.0 * min(a, 1.0) + max(a - 1.0, 0.0) * before)
            cm -= v
            units += cur * v * (1 - fee) / p
            ct += (1 - cur) * v
        if ee != cur:
            P = units * p + ct
            d = ee * P - units * p
            if d > 0:
                d = min(d, ct)
                units += d * (1 - fee) / p
                ct -= d
                tb[i] = d
            elif d < 0:
                units += d / p
                ct += -d * (1 - fee)
                ts[i] = -d
            cur = ee
        EX[i] = cur
    fin = units * c[hi - 1] + cm + ct
    return (fin / (du * c[hi - 1]) - 1) * 100, tb, ts, EX


def plan(X, core):
    D, DD, MM, base = load()
    return base[X.k] if core == "mb1" else np.ones(X.n)


_RC = {}


def R(X, e, seg, core="mb1", lag=0, fee=0.001, mrate=None, trate=None):
    """Итог (к DCA, %) счёта ядра с торговой экспозицией e на отрезке seg (e = None — без торговли)."""
    a0, a1 = seg
    if a1 - a0 < 250:
        return np.nan
    if e is None:
        key = (X.k, a0, a1, core, lag, fee, mrate is None)
        if key not in _RC:
            _RC[key] = R(X, np.ones(X.n), seg, core, lag, fee, mrate, trate)
        return _RC[key]
    ee = np.ones(X.n) if e is None else np.asarray(e, np.float64)
    rm = X.rate0 if mrate is None else mrate
    rt = X.ratetb if trate is None else trate
    return simsw(X.c, plan(X, core), ee, a0, a1, lag, rm, rt, fee)[0]


def combo(rc, rtr, f):
    """Итог (к DCA, %) смеси: (1 − f) ядра + f торговой части."""
    return ((1 - f) * (1 + rc / 100) + f * (1 + rtr / 100) - 1) * 100


def segs(X, cut=CUT):
    a, b, c = ix(X.t, A0), ix(X.t, B0), ix(X.t, cut)
    return {"A": (a, b), "B": (b, c)}


# ---------------- правило ----------------
class Rule:
    """fn(X) → e (экспозиция торговой части 0…1 по дням, решение по закрытию дня)."""

    def __init__(self, fn, name=""):
        self.fn, self.name = fn, name
        self._c = {}

    def e(self, X):
        if X.k not in self._c:
            self._c[X.k] = np.clip(np.nan_to_num(np.asarray(self.fn(X), np.float64), nan=1.0), 0.0, 1.0)
        return self._c[X.k]


def check(rule, keys=DSEL, core="mb1", f=F0, fee=0.001, mrate=None, starts=True, epis=True, after=True, lags=(1, 2)):
    """Протокол mlt против ядра: ячейки металл × A/B (прибавка смеси к ядру), сдвиг, без эпизода (e = 1 в окне), старты 2005–2020,
    (а) 2005–25 по металлу и (а-B) половина B; справочно — 2000–26 (вся дневная история) и 2005–26.11 (после решения); к DCA."""
    D, DD, MM, base = load()
    o = {"cells": {}, "lags": {lg: [] for lg in lags}, "ep": {}, "starts": [], "full": {}, "full26": {}, "all": {}, "dca": {}, "trade": {}}
    for k in keys:
        X = MM[k]
        mr = (X.ratetb if mrate == "tb" else None)
        e = rule.e(X)
        sg = segs(X)

        def T(seg, lag=0, ee=e):
            rc = R(X, None, seg, core, lag, fee, mr)
            rtr = R(X, ee, seg, core, lag, fee, mr)
            return rel(combo(rc, rtr, f), rc), combo(rc, rtr, f), rc, rtr
        for h, seg in sg.items():
            if seg[1] - seg[0] < 250:
                continue
            d, tot, rc, rtr = T(seg)
            o["cells"][(k, h)] = d
            o["dca"][(k, h)] = (tot, rc)
            o["trade"][(k, h)] = rtr
            for lg in lags:
                o["lags"][lg].append(T(seg, lg)[0])
            if epis:
                for nm, (a, b) in EPW.items():
                    w = (X.t >= a) & (X.t <= b)
                    o["ep"].setdefault(nm, []).append(T(seg, 0, np.where(w, 1.0, e))[0])
        a0 = sg["A"][0] if sg["A"][1] - sg["A"][0] >= 250 else sg["B"][0]
        d, tot, rc, _ = T((a0, sg["B"][1]))
        o["full"][k] = d
        o["dca"][(k, "F")] = (tot, rc)
        if after:
            d, tot, rc, _ = T((a0, X.n))
            o["full26"][k] = d
            o["dca"][(k, "F26")] = (tot, rc)
            d, tot, rc, _ = T((0, X.n))
            o["all"][k] = d
            o["dca"][(k, "ALL")] = (tot, rc)
        if starts:
            for y in range(2005, 2021):
                s0 = ix(X.t, f"{y}-01-01")
                if sg["B"][1] - s0 > 250:
                    o["starts"].append(T((s0, sg["B"][1]))[0])
    v = np.array(list(o["cells"].values()))
    o["n"] = len(v)
    o["ok"] = int((v >= -0.5).sum())
    o["worst"] = float(v.min()) if len(v) else 0.0
    o["sum"] = lsum(v)
    o["A"] = lsum([o["cells"][(k, "A")] for k in keys if (k, "A") in o["cells"]])
    o["B"] = lsum([o["cells"][(k, "B")] for k in keys if (k, "B") in o["cells"]])
    o["Bplus"] = int(sum(1 for k in keys if (k, "B") in o["cells"] and o["cells"][(k, "B")] > 0.5))
    o["nB"] = int(sum(1 for k in keys if (k, "B") in o["cells"]))
    o["lag"] = {lg: lsum(x) for lg, x in o["lags"].items()}
    o["fsum"] = lsum(list(o["full"].values()))
    o["fok"] = int(sum(1 for x in o["full"].values() if x > 0))
    if epis:
        o["epsum"] = {nm: lsum(x) for nm, x in o["ep"].items()}
    if starts and o["starts"]:
        o["share"] = float((np.array(o["starts"]) >= -0.5).mean() * 100)
    if after:
        o["f26sum"] = lsum(list(o["full26"].values()))
        o["allsum"] = lsum(list(o["all"].values()))
    return o


def ok(o, min_sum=4.0):
    """Критерий mlt (записан до круга 1; см. журнал): ≥ 7/8 ячеек не хуже (−0,5), худшая ≥ −3, сумма ≥ +4, половина A ≥ 0;
    (а-B) половина B: сумма > 0 и лучше ядра (> +0,5) у большинства металлов; сдвиг 1 и 2 дня — сумма ≥ 0;
    (б) без каждого эпизода сумма > 0; старты ≥ 70%; (а) 2005–25 — лучше ядра у большинства металлов и сумма > 0."""
    why = []
    need = int(np.ceil(o["n"] * 7 / 8))
    if o["ok"] < need:
        why.append(f"не хуже {o['ok']}/{o['n']}")
    if o["worst"] < -3:
        why.append(f"худшая {o['worst']:+.1f}")
    if o["sum"] < min_sum:
        why.append(f"сумма {o['sum']:+.1f}")
    if o["A"] < -0.05:
        why.append(f"A {o['A']:+.1f}")
    if o["B"] <= 0 or o["Bplus"] * 2 <= o["nB"]:
        why.append(f"B {o['B']:+.1f} (лучше у {o['Bplus']}/{o['nB']})")
    bad = [f"{lg}д {v:+.1f}" for lg, v in o["lag"].items() if v < 0]
    if bad:
        why.append("сдвиг " + ", ".join(bad))
    if "epsum" in o:
        bad = [f"{nm} {v:+.1f}" for nm, v in o["epsum"].items() if v <= 0]
        if bad:
            why.append("без эпизода: " + ", ".join(bad))
    if "share" in o and o["share"] < 70:
        why.append(f"старты {o['share']:.0f}%")
    if o["fok"] * 2 <= len(o["full"]) or o["fsum"] <= 0:
        why.append(f"2005–25 лучше {o['fok']}/{len(o['full'])}, сумма {o['fsum']:+.1f}")
    return not why, "; ".join(why)


def fmt(o, keys=DSEL, short=False):
    cells = " ".join(f"{NAME[k][:3]} " + "/".join(f"{o['cells'][(k, h)]:+.1f}" if (k, h) in o["cells"] else "—" for h in ("A", "B")) for k in keys)
    s = f"сумма {o['sum']:+.1f} (A {o['A']:+.1f}, B {o['B']:+.1f} [{o['Bplus']}/{o['nB']}]), не хуже {o['ok']}/{o['n']}, худш. {o['worst']:+.1f} | {cells}"
    if short:
        return s
    s += " | сдвиг " + "/".join(f"{v:+.1f}" for v in o["lag"].values())
    if o.get("epsum"):
        s += " | без эпиз. мин " + min((f"{v:+.1f} ({nm})" for nm, v in o["epsum"].items()), key=lambda z: float(z.split()[0]))
    if "share" in o:
        s += f" | старты {o['share']:.0f}%"
    s += f" | 2005–25 {o['fsum']:+.1f} ({o['fok']}/{len(o['full'])})"
    return s


def fafter(o, keys=DSEL):
    return ("после решения 2005–26.11: " + " ".join(f"{NAME[k][:3]} {o['full26'][k]:+.1f}" for k in keys if k in o["full26"]) + f" (Σ {o['f26sum']:+.1f}); "
            "вся дневная история 2000–26: " + " ".join(f"{NAME[k][:3]} {o['all'][k]:+.1f}" for k in keys if k in o["all"]) + f" (Σ {o['allsum']:+.1f})")


# ---------------- активность, точность и контроль ----------------
def trades(X, e, seg, core="mb1", lag=0, f=F0):
    a0, a1 = seg
    _, tb, ts, EX = simsw(X.c, plan(X, core), np.asarray(e, np.float64), a0, a1, lag, X.rate0, X.ratetb, 0.001)
    return tb * f, ts * f, EX


def ntrades(e, a0, a1, t):
    """Сделок в год (смен экспозиции) на отрезке."""
    x = np.asarray(e)[max(a0 - 1, 0):a1]
    yrs = (t[a1 - 1] - t[a0]).days / 365.25
    return float((np.abs(np.diff(x)) > 1e-9).sum() / yrs)


def precision(rule, keys=DSEL, core="mb1", f=F0, a0d=A0, a1d=CUT, e_over=None):
    """Метрики mcx (место сделок в диапазоне ±90 дн., пойманные локальные доньи/вершины) для сделок торговой части."""
    D, DD, MM, base = load()
    out = {"lows": 0, "lows_caught": 0, "highs": 0, "highs_caught": 0, "tpy": []}
    acc = {z: [] for z in ("buy_pos180", "sell_pos180", "buy_loc180", "sell_loc180", "time_in")}
    for k in keys:
        X = MM[k]
        a0, a1 = ix(X.t, a0d), ix(X.t, a1d)
        e = rule.e(X) if e_over is None else e_over[k]
        tb, ts, EX = trades(X, e, (a0, a1), core, 0, f)
        o = C.activity(X.t, X.c, tb, ts, a0, a1)
        for z in ("lows", "lows_caught", "highs", "highs_caught"):
            out[z] += o[z]
        for z in acc:
            if z in o:
                acc[z].append(o[z])
        acc["time_in"].append(float(EX[a0:a1].mean()))
        out["tpy"].append(ntrades(e, a0, a1, X.t))
    for z, v in acc.items():
        out[z] = float(np.mean(v)) if v else np.nan
    out["tpy_min"] = float(min(out["tpy"]))
    out["tpy_mean"] = float(np.mean(out["tpy"]))
    return out


def pfmt(p):
    return (f"сделок/год {p['tpy_mean']:.1f} (мин {p['tpy_min']:.1f}), в металле {p['time_in'] * 100:.0f}% дней; доньев {p['lows_caught']}/{p['lows']}, "
            f"вершин {p['highs_caught']}/{p['highs']}; место продаж {p.get('sell_pos180', np.nan):.2f} (0 = верх), откупов {p.get('buy_pos180', np.nan):.2f} (0 = дно); "
            f"к местной DCA прод. {p.get('sell_loc180', np.nan):+.1f}, откуп {p.get('buy_loc180', np.nan):+.1f}")


@njit(cache=True)
def _shuffle_runs(x, seed):
    """Перемешать порядок отрезков «в металле» и «вне металла» (раздельно), сохранив их длины, число сделок и чередование."""
    np.random.seed(seed)
    n = len(x)
    starts = [0]
    for i in range(1, n):
        if x[i] != x[i - 1]:
            starts.append(i)
    starts.append(n)
    m = len(starts) - 1
    vals = np.empty(m)
    lens = np.empty(m, np.int64)
    for r in range(m):
        vals[r] = x[starts[r]]
        lens[r] = starts[r + 1] - starts[r]
    out = np.empty(n)
    # раздельные списки по значению; чередование сохраняется, если значений два
    idx_a = np.where(vals == vals[0])[0]
    idx_b = np.where(vals != vals[0])[0]
    pa = idx_a[np.random.permutation(len(idx_a))]
    pb = idx_b[np.random.permutation(len(idx_b))]
    pos = 0
    ia = 0
    ib = 0
    for r in range(m):
        if r % 2 == 0 and ia < len(pa):
            q = pa[ia]
            ia += 1
        elif ib < len(pb):
            q = pb[ib]
            ib += 1
        else:
            q = pa[ia]
            ia += 1
        out[pos:pos + lens[q]] = vals[q]
        pos += lens[q]
    return out


def shuffled(rule, keys, seed, a0d=A0, a1d=CUT):
    """Экспозиция с перемешанными отрезками на [a0d, a1d) (вне отрезка — как у правила)."""
    D, DD, MM, base = load()
    out = {}
    for i, k in enumerate(keys):
        X = MM[k]
        e = rule.e(X).copy()
        a0, a1 = ix(X.t, a0d) - 1, ix(X.t, a1d)
        e[a0:a1] = _shuffle_runs(e[a0:a1].copy(), seed * 31 + i)
        out[k] = e
    return out


def control(rule, keys=DSEL, core="mb1", f=F0, nseed=50, prec=True):
    """(г) контроль: те же длины отрезков в/вне металла в случайном порядке. Возвращает распределение прибавки 2005–25 (сумма по металлам)
    и точности."""
    D, DD, MM, base = load()

    def edge(emap):
        v = []
        for k in keys:
            X = MM[k]
            sg = segs(X)
            a0 = sg["A"][0] if sg["A"][1] - sg["A"][0] >= 250 else sg["B"][0]
            seg = (a0, sg["B"][1])
            rc = R(X, None, seg, core)
            v.append(rel(combo(rc, R(X, emap[k], seg, core), f), rc))
        return lsum(v)
    real = edge({k: rule.e(MM[k]) for k in keys})
    sims, ps = [], []
    for s in range(nseed):
        em = shuffled(rule, keys, s)
        sims.append(edge(em))
        if prec:
            ps.append(precision(rule, keys, core, f, e_over=em))
    sims = np.array(sims)
    o = {"real": real, "pct": float((sims < real).mean() * 100), "med": float(np.median(sims)), "p80": float(np.percentile(sims, 80))}
    if prec:
        for z in ("sell_pos180", "buy_pos180", "sell_loc180", "buy_loc180"):
            o[z] = float(np.nanmedian([p[z] for p in ps]))
        o["caught"] = float(np.median([p["lows_caught"] + p["highs_caught"] for p in ps]))
    return o


def prec_ok(p, ctl):
    """(г): прибавка выше 80% перемешанных; место продаж и откупов лучше медианы перемешанных; поймано доньев + вершин больше медианы."""
    why = []
    if ctl["pct"] < 80:
        why.append(f"прибавка выше {ctl['pct']:.0f}% перемешанных (< 80)")
    if not p["sell_pos180"] < ctl["sell_pos180"]:
        why.append(f"место продаж {p['sell_pos180']:.2f} ≥ {ctl['sell_pos180']:.2f}")
    if not p["buy_pos180"] < ctl["buy_pos180"]:
        why.append(f"место откупов {p['buy_pos180']:.2f} ≥ {ctl['buy_pos180']:.2f}")
    if not p["lows_caught"] + p["highs_caught"] > ctl["caught"]:
        why.append(f"поймано {p['lows_caught'] + p['highs_caught']} ≤ {ctl['caught']:.0f}")
    if p["tpy_min"] < 2:
        why.append(f"(д) сделок/год мин {p['tpy_min']:.1f} < 2")
    return not why, "; ".join(why)


# ---------------- индикаторы (только прошлое) ----------------
def sma(x, n):
    return pd.Series(x).rolling(n, min_periods=n).mean().values


def ema(x, n):
    return pd.Series(x).ewm(span=n, adjust=False, min_periods=n).mean().values


def sstd(x, n):
    return pd.Series(x).rolling(n, min_periods=n).std().values


def rmax(x, n):
    """Максимум ПРЕДЫДУЩИХ n дней (без сегодняшнего)."""
    return pd.Series(x).shift(1).rolling(n, min_periods=n).max().values


def rmin(x, n):
    return pd.Series(x).shift(1).rolling(n, min_periods=n).min().values


def F(X):
    """Признаки металла (кэш): цены, вол, RSI, средние, z роста, Боллинджер, рынок (DXY, VIX, BTC, 10-летняя ставка)."""
    D, DD, MM, base = load()
    return C.feats(X, DD)


def ret(c, n):
    return np.r_[np.full(n, np.nan), c[n:] / c[:-n] - 1]


@njit(cache=True)
def hyst(sell, buy, maxout=0, init=1.0):
    """Конечный автомат: e = 1 → (sell) → 0 → (buy или maxout дней вне металла) → 1."""
    n = len(sell)
    out = np.empty(n)
    e = init
    cnt = 0
    for j in range(n):
        if e == 1.0:
            if sell[j]:
                e = 0.0
                cnt = 0
        else:
            cnt += 1
            if buy[j] or (maxout > 0 and cnt >= maxout):
                e = 1.0
        out[j] = e
    return out


@njit(cache=True)
def hyst3(down, up, init=1.0):
    """Тренд с гистерезисом: down → 0, up → 1, иначе держать."""
    n = len(down)
    out = np.empty(n)
    e = init
    for j in range(n):
        if e == 1.0 and down[j]:
            e = 0.0
        elif e == 0.0 and up[j]:
            e = 1.0
        out[j] = e
    return out


def b(x):
    return np.nan_to_num(np.asarray(x, float), nan=0.0) > 0.5


def fwd(c, h):
    return np.r_[np.log(c[h:] / c[:-h]), np.full(h, np.nan)]


# ---------------- прогон списка правил ----------------
def tpy(rule, keys=DSEL, a0d=A0, a1d=CUT):
    D, DD, MM, base = load()
    v = []
    for k in keys:
        X = MM[k]
        v.append(ntrades(rule.e(X), ix(X.t, a0d), ix(X.t, a1d), X.t))
    return float(np.mean(v)), float(min(v))


def scan(rules, core="mb1", keys=DSEL, show=True, f=F0):
    """Протокол по списку правил; печать: сумма, половины, ячейки, (а-B), сдвиг, без эпизода, старты, 2005–25, сделок/год. Возвращает [(rule, o, good, why)]."""
    out = []
    for r in rules:
        o = check(r, keys, core, f)
        g, why = ok(o)
        m, mn = tpy(r, keys)
        o["tpy"], o["tpy_min"] = m, mn
        if mn < 2:
            why = (why + "; " if why else "") + f"(д) сделок/год мин {mn:.1f}"
            g = False
        out.append((r, o, g, why))
        if show:
            print(f"  {r.name}: {fmt(o, keys)} | сделок/год {m:.1f} (мин {mn:.1f}) → {'✓' if g else '✗ ' + why}")
    return out


def best(res, n=3):
    return sorted(res, key=lambda z: -z[1]["sum"])[:n]


# ---------------- гибрид HY3 (круг 5) с параметрами и крючками для фильтров ----------------
def regime(X, kind="Ra"):
    f = F(X)
    c = X.c
    if kind == "Ra":
        return b(f["ma200"] > 1) & b(sma(c, 50) > sma(c, 200))
    if kind == "Rb":
        return b(f["ma200"] > 1)
    if kind == "Rc":
        return b(f["r250"] > 0)
    raise ValueError(kind)


def hy3_parts(X, rg="Ra", z=1.25, k50=2.0, nb=20, rsib=50, zn=21):
    """Части HY3: up (режим), s_dn (продажа вне режима: рост zn дн. > z·σ), s_up (продажа в режиме: отрыв > k50·σ√25 над SMA50),
    bb (откуп: вне режима цена ≤ SMA nb, в режиме RSI14 < rsib)."""
    f = F(X)
    c = X.c
    up = regime(X, rg)
    zz = f[f"z{zn}"] if f"z{zn}" in f else np.log1p(ret(c, zn)) / (f["sd250"] * np.sqrt(zn))
    s_dn = b(zz > z) & ~up if z is not None else np.zeros(X.n, bool)
    s_up = b(np.log(f["ma50"]) > k50 * f["sd250"] * 5) & up if k50 is not None else np.zeros(X.n, bool)
    bb = np.where(up, b(f["rsi"] < rsib), b(c <= sma(c, nb)))
    return up, s_dn, s_up, bb


def HY3(rg="Ra", z=1.25, k50=2.0, nb=20, rsib=50, maxout=126, zn=21, sell_ok=None, buy_block=None, buy_force=None, name=None):
    """HY3: вне сильного роста продать торговую часть на отскоке (рост zn дн. > z·σ), откуп при цене ≤ SMA nb; в сильном росте — продать только при
    отрыве > k50·σ√25 над SMA50, откуп при RSI14 < rsib; всегда откуп через maxout дн. Крючки (функции X → bool массив):
    sell_ok — продажа разрешена только там, где True; buy_block — откуп откладывается, пока True; buy_force — откуп сразу, если True."""
    def fn(X):
        up, s_dn, s_up, bb = hy3_parts(X, rg, z, k50, nb, rsib, zn)
        s = s_dn | s_up
        if sell_ok is not None:
            s = s & sell_ok(X)
        if buy_block is not None:
            bb = bb & ~buy_block(X)
        if buy_force is not None:
            bb = bb | buy_force(X)
        return hyst(s, bb, maxout)
    return Rule(fn, name or f"HY3 {rg} z{zn}>{z} k50 {k50} SMA{nb} RSI<{rsib} {maxout}д")
