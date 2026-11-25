"""Стенд mop: опционный рынок (подразумеваемая волатильность) для покупок и продаж металлов поверх mb1. Протокол — research/mop_journal.md.

Основа сравнения — mb1 (found/mb-best.json): Q2д + пауза докупок серии 90 дней после стресса BTC (mb_r9.mb1 / mb_r8.btc_wait).
Стенды mb_lib / mt4_lib не меняются. Данные опционов — cache/mop_vol.json (app/mop_data.py) и cache/op_mkt.json.

Дневной протокол mop (check / ok): ячейки «металл × половина» A = 2005-01…2015-12, B = 2016-01…конец (старт с нуля), + ячейки «с 2008-06» и
«с 2011-03» до конца (эпоха GVZ / VXSLV); сдвиг исполнения 1 и 2 дня; комиссия 0,5%; без каждого из 7 эпизодов; старты 2005–2020.
end — конец оценки (по умолчанию весь ряд; '2025-12-31' — без обвала 2026). Решения правил только по прошлому, поэтому обрезка конца оценки
эквивалентна обрезке данных."""
import json
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mb_lib as B  # noqa: E402
import mt4_lib as M  # noqa: E402
import metals_agent_lib as L  # noqa: E402
from mb_r8 import btc_wait  # noqa: E402

NAME = B.NAME
DSEL, DEXAM = B.DSEL, B.DEXAM
LOGDIR = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/mop"
A0, B0 = "2005-01-01", "2016-01-01"
C08, C11 = "2008-06-03", "2011-03-16"
END25 = "2025-12-31"
EPIS = {"2008": ("2008-07-01", "2009-06-30"), "2011": ("2011-01-01", "2011-12-31"), "2013": ("2013-01-01", "2013-12-31"),
        "2015–16": ("2014-07-01", "2016-06-30"), "2020": ("2020-02-01", "2020-12-31"), "2022": ("2022-01-01", "2022-12-31"),
        "2025–26": ("2025-06-01", "2026-11-30")}
rel = M.rel


def tee(path):
    M.LOGDIR = LOGDIR
    return M.tee(path)


# ---------------- данные ----------------
_V = {}


def vol():
    """{символ: pd.Series} — подразумеваемая вол и др. ряды опционного рынка."""
    if not _V:
        for fn in ("op_mkt.json", "mop_vol.json"):
            js = json.load(open(os.path.join(HERE, "cache", fn)))
            for k, v in js.items():
                if k.startswith("_") or not isinstance(v, dict) or "d" not in v:
                    continue
                s = pd.Series(v["c"], index=pd.to_datetime(v["d"]), dtype=float)
                s = s[~s.index.duplicated(keep="last")].sort_index()
                if k not in _V or len(s) > len(_V[k]):
                    _V[k] = s
    return _V


def ser(sym):
    return vol()[sym]


def on(s, X):
    """Ряд s → торговые дни металла X (последнее значение с датой ≤ дня)."""
    return M.on_days(s, X.t)


def pctl(s, win=252, minp=200):
    """Скользящий перцентиль последнего значения среди прошлых win наблюдений (0…1), только прошлое."""
    return s.rolling(win, min_periods=minp).apply(lambda a: (a[:-1] < a[-1]).mean() + 0.5 * (a[:-1] == a[-1]).mean(), raw=True)


def rvol(c, n=21):
    """Реализованная вол, % годовых, по закрытиям c (n дней)."""
    r = np.r_[np.nan, np.diff(np.log(np.asarray(c, float)))]
    return pd.Series(r).rolling(n, min_periods=int(n * 0.8)).std().values * np.sqrt(252) * 100


_C = {}


def load():
    if "D" not in _C:
        D, DD, MM = B.load()
        _C.update(D=D, DD=DD, MM=MM)
        ref = lambda X: B.q2d(D, X)  # noqa: E731
        _C["fw"] = btc_wait(DD, ref, 0.25, 90)
    return _C["D"], _C["DD"], _C["MM"]


_P = {}


def mb1(X):
    """План mb1 по дням (кэш)."""
    load()
    if X.k not in _P:
        _P[X.k] = _C["fw"](X)[0]
    return _P[X.k].copy()


def mbm(fm):
    """mb1 из другого месячного плана fm (d → план по месяцам): Q2д-исполнение + пауза BTC."""
    D, DD, _ = load()
    fw = btc_wait(DD, lambda X: B.q2d(D, X, fm), 0.25, 90)
    cache = {}

    def f(X):
        if X.k not in cache:
            cache[X.k] = fw(X)[0]
        return cache[X.k].copy()
    return f


def monthly(s, t_m, how="mean"):
    """Дневной ряд → значения по месяцам t_m (конец месяца M: средняя / последнее за месяц M)."""
    g = s.dropna().resample("ME")
    m = g.mean() if how == "mean" else g.last() if how == "last" else g.max()
    m.index = m.index.to_period("M")
    return m.reindex(pd.DatetimeIndex(t_m).to_period("M")).values


# ---------------- протокол ----------------
def _ix(t, s):
    return int(np.searchsorted(np.asarray(t, "datetime64[ns]"), np.datetime64(s)))


def lsum(v):
    v = np.nan_to_num(np.asarray(v, float))
    return float(np.log1p(v / 100).sum() * 100)


def segs(X, end=None):
    e = X.n if end is None else min(X.n, _ix(X.t, pd.Timestamp(end) + pd.Timedelta(days=1)))
    return {"A": (_ix(X.t, A0), _ix(X.t, B0)), "B": (_ix(X.t, B0), e), "08": (_ix(X.t, C08), e), "11": (_ix(X.t, C11), e),
            "full": (_ix(X.t, A0), e), "all": (0, e)}, e


def run(X, p, seg, lag=0, fee=0.001, rate=None):
    if seg[1] - seg[0] < 250:
        return np.nan
    return M.dsim(X.c, np.asarray(p, np.float64), seg[0], seg[1], lag, X.rate0 if rate is None else rate, fee)[0]


def check(MM, fn, ref=None, keys=DSEL, end=None, starts=True, eps=True, extra=True):
    """Протокол mop против ref (по умолчанию mb1). Возвращает словарь."""
    ref = ref or mb1
    o = {"cells": {}, "lag1": [], "lag2": [], "fee5": [], "ep": {}, "starts": [], "c08": {}, "c11": {}, "full": {}, "all": {}, "nd": 0}
    for k in keys:
        X = MM[k]
        p, p0 = np.asarray(fn(X), np.float64), np.asarray(ref(X), np.float64)
        sg, e = segs(X, end)
        o["nd"] += int((np.abs(p[:e] - p0[:e]) > 1e-12).sum())
        for h in ("A", "B"):
            seg = sg[h]
            if seg[1] - seg[0] < 250:
                continue
            r0 = run(X, p0, seg)
            o["cells"][(k, h)] = rel(run(X, p, seg), r0)
            o["lag1"].append(rel(run(X, p, seg, 1), run(X, p0, seg, 1)))
            o["lag2"].append(rel(run(X, p, seg, 2), run(X, p0, seg, 2)))
            o["fee5"].append(rel(run(X, p, seg, 0, 0.005), run(X, p0, seg, 0, 0.005)))
            if eps:
                for nm, (a, b) in EPIS.items():
                    w = (X.t >= a) & (X.t <= b)
                    pe = np.where(w, p0, p)
                    o["ep"].setdefault(nm, []).append(rel(run(X, pe, seg), r0))
        if extra:
            for key, h in (("c08", "08"), ("c11", "11"), ("full", "full"), ("all", "all")):
                o[key][k] = rel(run(X, p, sg[h]), run(X, p0, sg[h]))
        if starts:
            for y in range(2005, 2021):
                a0 = _ix(X.t, f"{y}-01-01")
                if e - a0 > 250:
                    o["starts"].append(rel(run(X, p, (a0, e)), run(X, p0, (a0, e))))
    v = np.array(list(o["cells"].values()))
    o["n"] = len(v)
    o["ok"] = int((v >= -0.5).sum())
    o["worst"] = float(np.nanmin(v)) if len(v) else 0.0
    o["sum"] = lsum(v)
    o["A"] = lsum([o["cells"][(k, "A")] for k in keys if (k, "A") in o["cells"]])
    o["B"] = lsum([o["cells"][(k, "B")] for k in keys if (k, "B") in o["cells"]])
    o["l1"], o["l2"], o["f5"] = lsum(o["lag1"]), lsum(o["lag2"]), lsum(o["fee5"])
    if eps:
        o["epsum"] = {nm: lsum(v) for nm, v in o["ep"].items()}
    if starts:
        s = np.array(o["starts"])
        o["share"] = float((s >= -0.5).mean() * 100) if len(s) else 100.0
    if extra:
        for key in ("c08", "c11", "full", "all"):
            vv = np.array(list(o[key].values()))
            o[key + "_sum"] = lsum(vv)
            o[key + "_ok"] = int((np.nan_to_num(vv) >= -0.5).sum())
    return o


def ok(o, min_sum=4.0, min_ep=2.0):
    """Критерий mop (записан в журнале до круга 1)."""
    why = []
    need = int(np.ceil(o["n"] * 7 / 8))
    if o["ok"] < need:
        why.append(f"не хуже {o['ok']}/{o['n']}")
    if o["worst"] < -3:
        why.append(f"худшая {o['worst']:+.1f}")
    if o["sum"] < min_sum:
        why.append(f"сумма {o['sum']:+.1f}")
    if o["A"] < 0 or o["B"] < 0:
        why.append(f"половины {o['A']:+.1f}/{o['B']:+.1f}")
    if o["l1"] < 0 or o["l2"] < 0 or o["f5"] < 0:
        why.append(f"сдвиг/комиссия {o['l1']:+.1f}/{o['l2']:+.1f}/{o['f5']:+.1f}")
    if "epsum" in o:
        bad = [nm for nm, v in o["epsum"].items() if v < min_ep]
        if bad:
            why.append("без эпизода " + ",".join(f"{nm} {o['epsum'][nm]:+.1f}" for nm in bad))
    if "share" in o and o["share"] < 70:
        why.append(f"старты {o['share']:.0f}%")
    if "c08_sum" in o:
        nk = len(o["c08"])
        for key, nm in (("c08", "с 2008"), ("c11", "с 2011")):
            if o[key + "_sum"] < 0 or o[key + "_ok"] < (nk + 1) // 2 + (1 if nk % 2 == 0 else 0):
                why.append(f"{nm} {o[key + '_sum']:+.1f} ({o[key + '_ok']}/{nk})")
    return not why, "; ".join(why)


def fmt(o, keys=DSEL, short=False):
    cells = " ".join(f"{NAME[k][:3]} " + "/".join(f"{o['cells'][(k, h)]:+.1f}" if (k, h) in o["cells"] else "—" for h in ("A", "B")) for k in keys)
    s = f"Σ {o['sum']:+.1f} (A {o['A']:+.1f}, B {o['B']:+.1f}) {o['ok']}/{o['n']} худш. {o['worst']:+.1f}"
    if short:
        return s
    s += f" | {cells} | сдв {o['l1']:+.1f}/{o['l2']:+.1f} ком.0,5% {o['f5']:+.1f}"
    if "c08_sum" in o:
        s += f" | с08 {o['c08_sum']:+.1f} с11 {o['c11_sum']:+.1f}"
    if "epsum" in o:
        s += " | без эп. мин " + f"{min(o['epsum'].values()):+.1f} ({min(o['epsum'], key=o['epsum'].get)})"
    if "share" in o:
        s += f" | старты {o['share']:.0f}%"
    return s


def both(MM, fn, nm, keys=DSEL, ref=None, show=True):
    """Сначала до 2025-12 (решение), затем весь ряд (справка). Возвращает (ok25, o25, ofull)."""
    o25 = check(MM, fn, ref, keys, END25)
    k25, w25 = ok(o25)
    of = check(MM, fn, ref, keys, None, starts=False, eps=True)
    kf, wf = ok(of)
    if show:
        print(f"  {nm:<46} дн.{o25['nd']:5d} | ≤2025: {fmt(o25)} → {'✓' if k25 else '✗ ' + w25}")
        print(f"  {'':<46}          | весь: Σ {of['sum']:+.1f} (A {of['A']:+.1f}, B {of['B']:+.1f}) {of['ok']}/{of['n']}, с08 {of['c08_sum']:+.1f}, с11 {of['c11_sum']:+.1f}"
              f", без эп. мин {min(of['epsum'].values()):+.1f} → {'✓' if kf else '✗'}")
    return k25, o25, of


# ---------------- помощники правил ----------------
def scale_sells(p, mask, m):
    """Дневные продажи (p < 0) в днях mask × m (m = 0 → обычный взнос)."""
    q = p.copy()
    s = (p < 0) & mask
    if m == 0:
        q[s] = 1.0
    else:
        q[s] = -np.clip(-p[s] * m, 0, 0.95)
    return q


def defer_buys(p, wait):
    """Докупки серии (p > 1) в днях wait откладываются (доля копится) и выдаются в первый день серии без ожидания (как btc_wait)."""
    s = p > 1.0
    g = np.where(s, p - 1.0, 0.0)
    out = np.zeros(len(p))
    cr = 1.0
    for i in range(len(p)):
        if not s[i]:
            cr = 1.0
            continue
        if wait[i]:
            cr *= (1 - g[i])
        else:
            out[i] = 1 - cr * (1 - g[i])
            cr = 1.0
    return B.reshape(p, out)


def since_days(ev):
    return L.since(np.asarray(ev, bool))


def fwd(c, h):
    f = np.full(len(c), np.nan)
    f[:-h] = np.log(c[h:] / c[:-h]) * 100
    return f
