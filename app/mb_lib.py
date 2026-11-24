"""Стенд mb: точность покупок (докупок из резерва) на металлах. Поверх mt4_lib.py и metals_agent*_lib.py — без их изменения.

Основа — Q2д (месячный план Q2, исполняемый ежедневно равными долями в следующем месяце). Протокол — research/mb_journal.md.
Здесь: загрузка, планы Q2 / Q2д, конструкторы «внутрисерийных» схем траты резерва, метрики точности покупок (рано / к DCA резерва /
эпизодный тест), протокольные сравнения (дневное — через mt4_lib.gstat + сдвиг 2 дня; месячное — через metals_agent3_lib).
"""
import os
import sys

import numpy as np
import pandas as pd
from numba import njit

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mt4_lib as M  # noqa: E402
import metals_agent3_lib as T  # noqa: E402
import metals_agent2_lib as A  # noqa: E402
import metals_agent_lib as L  # noqa: E402

NAME = M.NAME
DSEL, DEXAM = M.DSEL, M.DEXAM
LOGDIR = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/mb"
Q2M = M.VERS["Q2"]
R3M = M.VERS["R3"]
rel = M.rel
ALLM = ["gold", "silver", "platinum", "palladium", "copper", "aluminum", "nickel", "lead", "zinc", "tin"]


def tee(path):
    M.LOGDIR = LOGDIR
    return M.tee(path)


_CACHE = {}


def load():
    if "D" not in _CACHE:
        _CACHE["D"] = M.mload()
        _CACHE["DD"] = M.dload()
        _CACHE["MM"] = M.dmetals(_CACHE["DD"], DSEL + DEXAM)
    return _CACHE["D"], _CACHE["DD"], _CACHE["MM"]


def q2d(D, X, fn=Q2M):
    """Дневной план из месячного плана fn (решение по месяцу M → равные доли по торговым дням M+1)."""
    return M.mmap(fn(D[X.k]), D[X.k]["t"], X.t, True)


def runs_of(mask):
    """Список (начало, конец включительно) отрезков, где mask истинна."""
    out = []
    i, n = 0, len(mask)
    while i < n:
        if mask[i]:
            j = i
            while j + 1 < n and mask[j + 1]:
                j += 1
            out.append((i, j))
            i = j + 1
        else:
            i += 1
    return out


def episodes(mask, gap):
    """Серии (отрезки mask), слитые, если разрыв ≤ gap шагов: [(начало, конец)]."""
    r = runs_of(mask)
    out = []
    for a, b in r:
        if out and a - out[-1][1] - 1 <= gap:
            out[-1] = (out[-1][0], b)
        else:
            out.append((a, b))
    return out


# ---------------- внутрисерийные схемы (дневные) ----------------
def gday(g_month=0.5, nd=21):
    return 1 - (1 - g_month) ** (1 / nd)


def reshape(p, newg):
    """План p, где в днях серии (p > 1) доля резерва заменена на newg[i] (0 — только взнос; < 0 не бывает)."""
    q = p.copy()
    s = p > 1.0
    q[s] = 1.0 + np.clip(newg[s], 0.0, 0.999)
    return q


@njit(cache=True)
def _defer(ser, falling, rel_ok, gd, mult, force_end, maxwait):
    """Отложенная трата: в днях серии, пока falling — доля дня копится в «кредит» (в днях); в день rel_ok (разворот) тратится
    1 − (1 − gd)^(mult × кредит + 1); иначе — обычная доля gd. В последний день серии (force_end) — весь кредит; maxwait > 0 — кредит
    старше maxwait дней тратится принудительно. Возвращает дневную долю резерва."""
    n = len(ser)
    g = np.zeros(n)
    cr = 0.0
    age = 0
    for i in range(n):
        if not ser[i]:
            cr = 0.0
            age = 0
            continue
        last = (i + 1 >= n) or (not ser[i + 1])
        if falling[i] and not rel_ok[i]:
            cr += 1.0
            age += 1
            g[i] = 0.0
            if (force_end and last) or (maxwait > 0 and age >= maxwait):
                g[i] = 1 - (1 - gd) ** (cr)
                cr = 0.0
                age = 0
        else:
            k = mult * cr + 1.0
            g[i] = 1 - (1 - gd) ** k
            cr = 0.0
            age = 0
    return g


# ---------------- метрики точности ----------------
def precision(c, bx, t, a0, a1, ahead, win, gap):
    """Метрики докупок резерва на [a0, a1): «рано» (цена к минимуму следующих ahead шагов), к DCA резерва (окно win шагов от начала
    эпизода), список эпизодов. bx — суммы докупок из резерва по шагам."""
    n = len(c)
    bx = bx.copy()
    bx[:a0] = 0
    bx[a1:] = 0
    tot = bx.sum()
    res = {"money": float(tot)}
    if tot <= 0:
        res.update({"early": np.nan, "vsdca": np.nan, "eps": []})
        return res
    fmin = np.array([c[i: min(n, i + ahead + 1)].min() for i in range(n)])
    idx = np.where(bx > 0)[0]
    res["early"] = float((bx[idx] * (c[idx] / fmin[idx] - 1)).sum() / tot * 100)
    eps = []
    for a, b in episodes(bx > 0, gap):
        m = bx[a: b + 1]
        cc = c[a: b + 1]
        avg = m.sum() / (m / cc).sum()
        w1 = min(n, a + win)
        ref = (w1 - a) / (1.0 / c[a:w1]).sum()
        lo_a, lo_b = max(0, a - win // 4), min(n, b + win // 2 + 1)
        j = lo_a + int(np.argmin(c[lo_a:lo_b]))
        before = m[: max(0, j - a)].sum() / m.sum() * 100 if j >= a else 0.0
        eps.append({"start": t[a], "end": t[b], "money": float(m.sum()), "avg": float(avg), "vsdca": float((avg / ref - 1) * 100),
                    "low": float(c[j]), "low_t": t[j], "above_low": float((avg / c[j] - 1) * 100), "start_above_low": float((c[a] / c[j] - 1) * 100),
                    "steps_to_low": int(j - a), "before_low": float(before)})
    res["eps"] = eps
    w = np.array([e["money"] for e in eps])
    res["vsdca"] = float((w * np.array([e["vsdca"] for e in eps])).sum() / w.sum())
    res["above_low"] = float((w * np.array([e["above_low"] for e in eps])).sum() / w.sum())
    res["before_low"] = float((w * np.array([e["before_low"] for e in eps])).sum() / w.sum())
    return res


@njit(cache=True)
def ep_value(c, plan, s, H, lag):
    """Эпизодный тест: в шаг s резерв = 1, без взносов и продаж; план (1 + g → доля g резерва) исполняется со сдвигом lag;
    через H шагов — стоимость купленного + остаток. Возвращает (стоимость, доля потраченного)."""
    n = len(c)
    e = min(n - 1, s + H)
    cash = 1.0
    units = 0.0
    for i in range(s, e + 1):
        j = i - 1 - lag
        if j < s - 1:
            continue
        a = plan[j]
        if a > 1.0:
            v = (a - 1.0) * cash
            units += v * 0.999 / c[i]
            cash -= v
    return units * c[e] + cash, 1.0 - cash


def ep_test(c, plan, plan0, starts, H, lag=0):
    """Лог-разницы (%) стоимости резерва схемы plan к plan0 по эпизодам, начинающимся в starts."""
    out = []
    for s in starts:
        v, f = ep_value(c, plan, s, H, lag)
        v0, f0 = ep_value(c, plan0, s, H, lag)
        out.append((np.log(v / v0) * 100, f, f0))
    return out


def series_starts(plan, t, gap):
    return [a for a, _ in episodes(plan > 1.0, gap)]


# ---------------- протокол: дневная модель ----------------
def dcheck(MM, fn, ref, keys=DSEL, rate=False, starts=True, episodes_=True):
    """mt4_lib.gstat + сдвиг 2 дня. Возвращает словарь o и (ok, why)."""
    o = M.gstat(MM, fn, ref, keys=keys, starts=starts, episodes=episodes_, rate=rate)
    l2 = []
    for k in keys:
        X = MM[k]
        p, p0 = fn(X), ref(X)
        rt = X.ratetb if rate else None
        for part in ("h1", "h2"):
            l2.append(M.rel(M.grun(X, p, part, 2, rate=rt), M.grun(X, p0, part, 2, rate=rt)))
    o["lag2"] = float(np.log1p(np.nan_to_num(np.array(l2)) / 100).sum() * 100)
    ok, why = M.gok(o)
    if o["lag2"] < 0:
        why = (why + "; " if why else "") + f"сдвиг 2 дн. {o['lag2']:+.1f}"
        ok = False
    return o, ok, why


def dfmt(o, keys=DSEL):
    return M.gfmt(o, keys) + f" | сдвиг2 {o['lag2']:+.1f}"


def dprec(MM, fn, keys=DSEL, part="full"):
    """Метрики точности докупок в дневной модели (по металлам): рано (12 мес. = 252 дн.), к DCA резерва (24 мес. = 504 дн.)."""
    out = {}
    for k in keys:
        X = MM[k]
        p = fn(X)
        a0, a1 = X.seg(part)
        r = X.run(p, (a0, a1))
        out[k] = precision(X.c, r[1], X.t, a0, a1, 252, 504, 63)
    return out


def mprec(D, fn, keys, a0key="h82", part="h2"):
    """То же в месячной модели (рано — 12 мес., к DCA резерва — 24 мес.). part: h2 (1982–98), after, full."""
    out = {}
    for k in keys:
        d = D[k]
        c = d["c"]
        p = np.asarray(fn(d), np.float64)
        n, m, h = len(c), d["m"], d["h82"]
        a0, a1 = {"h2": (h, m), "after": (m, n), "full": (0, n)}[part]
        if a1 - a0 < 24:
            continue
        _, bx, _ = L.sim(c, p, a0, a1, 0, np.zeros(n))
        out[k] = precision(c, bx, d["t"], a0, a1, 12, 24, 3)
    return out


def agg_prec(P):
    w = np.array([v["money"] for v in P.values()])
    if w.sum() <= 0:
        return {"early": np.nan, "vsdca": np.nan}
    f = lambda key: float(np.nansum(w * np.array([v.get(key, np.nan) for v in P.values()])) / w[np.isfinite([v.get(key, np.nan) for v in P.values()])].sum())  # noqa: E731
    return {"early": f("early"), "vsdca": f("vsdca"), "above_low": f("above_low"), "before_low": f("before_low")}


def fprec(P, keys=None):
    keys = keys or list(P)
    return "; ".join(f"{NAME[k][:4]} рано {P[k]['early']:.0f}%, к DCA рез. {P[k]['vsdca']:+.0f}%" for k in keys
                     if k in P and np.isfinite(P[k].get("early", np.nan)))


# ---------------- эпизодный тест на всех сериях ----------------
def ep_all_daily(MM, fn, ref, keys=DSEL + DEXAM, H=504, lag=0):
    rows = []
    for k in keys:
        X = MM[k]
        p, p0 = fn(X), ref(X)
        st = series_starts(p0, X.t, 63)
        for s, (dv, f, f0) in zip(st, ep_test(X.c, p, p0, st, H, lag)):
            rows.append((k, str(X.t[s])[:7], dv, f, f0))
    return rows


def ep_all_monthly(D, fn, ref, keys=ALLM, H=24, lag=0):
    rows = []
    for k in keys:
        d = D[k]
        p, p0 = np.asarray(fn(d), np.float64), np.asarray(ref(d), np.float64)
        st = series_starts(p0, d["t"], 3)
        for s, (dv, f, f0) in zip(st, ep_test(d["c"], p, p0, st, H, lag)):
            rows.append((k, str(d["t"][s])[:7], dv, f, f0))
    return rows


def ep_sum(rows):
    v = np.array([r[2] for r in rows])
    if len(v) == 0:
        return {"n": 0, "share": np.nan, "med": np.nan, "mean": np.nan}
    return {"n": len(v), "share": float((v >= -0.5).mean() * 100), "med": float(np.median(v)), "mean": float(v.mean()),
            "worst": float(v.min()), "best": float(v.max())}


def fep(e):
    return f"эпизодов {e['n']}, не хуже в {e['share']:.0f}%, медиана {e['med']:+.1f}, среднее {e['mean']:+.1f}, худший {e['worst']:+.1f}, лучший {e['best']:+.1f}"


# ---------------- протокол: месячная модель ----------------
def mstudy(D, cands, Ref, show=20):
    return T.study(D, cands, Ref, show=show)


def mveto(D, r, quiet=False):
    """Вето: 1999–2026 против R3 (протокол агента 3) и против Q2 (не хуже на ≥ 6/8)."""
    R3 = T.run(D, R3M)
    Q = T.run(D, Q2M)
    s3 = T.cmp(r["R"], R3)
    ok3, why3 = T.veto_ok(s3)
    sq = T.cmp(r["R"], Q)
    okq = sq["after"]["ok"] >= 6
    if not quiet:
        print(f"  ВЕТО {r['name']}: к R3 — {T.fv(s3)} → {'да' if ok3 else 'нет: ' + why3}")
        print(f"      к Q2 — {T.fv(sq)} → {'да' if okq else 'нет (не хуже < 6/8)'}")
        print(f"      по металлам 1999–2026 к Q2: {T.bym(sq, 'after')}")
    return ok3 and okq


def clean(o):
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if isinstance(o, (pd.Timestamp, np.datetime64)):
        return str(o)[:10]
    if hasattr(o, "item"):
        o = o.item()
    if isinstance(o, float):
        return None if not np.isfinite(o) else round(o, 3)
    return o


# ================= НОВЫЙ ПРОТОКОЛ (указание пользователя): главный период 2005–2026, половины A = 2005–15, B = 2016–26 =================
A0, B0 = "2005-01-01", "2016-01-01"
EPIS2 = {"2008": ("2008-07-01", "2009-03-31"), "2011–15": ("2011-04-01", "2015-12-31"), "2020-03": ("2020-02-01", "2020-04-30"),
         "2022": ("2022-03-01", "2022-10-31"), "2025–26": ("2025-06-01", "2026-11-30")}
MSEL = A.SEL


def _ix(t, s):
    return int(np.searchsorted(np.asarray(t, "datetime64[ns]"), np.datetime64(s)))


def dsegs(X):
    a, b = _ix(X.t, A0), _ix(X.t, B0)
    return {"A": (a, b), "B": (b, X.n)}


def lsum(v):
    v = np.nan_to_num(np.asarray(v, float))
    return float(np.log1p(v / 100).sum() * 100)


def dcheck2(MM, fn, ref, keys=DSEL, rate=None, starts=True, episodes_=True, cache=None):
    """Дневной протокол (2005–26): ячейки металл × половина A/B, сдвиг 1 и 2 дня, без эпизода, старты 2005–2020.
    rate: None — резерв без дохода; 'tb' — векселя."""
    o = {"cells": {}, "lag1": [], "lag2": [], "ep": {}, "starts": [], "full": {}}
    for k in keys:
        X = MM[k]
        p, p0 = np.asarray(fn(X), np.float64), np.asarray(ref(X), np.float64)
        rt = X.ratetb if rate == "tb" else X.rate0
        sg = dsegs(X)
        for h, seg in sg.items():
            if seg[1] - seg[0] < 250:
                continue
            o["cells"][(k, h)] = rel(X.run(p, seg, rate=rt)[0], X.run(p0, seg, rate=rt)[0])
            for lag, key in ((1, "lag1"), (2, "lag2")):
                o[key].append(rel(X.run(p, seg, lag, rate=rt)[0], X.run(p0, seg, lag, rate=rt)[0]))
            if episodes_:
                for nm, (a, b) in EPIS2.items():
                    w = (X.t >= a) & (X.t <= b)
                    pe = np.where(w, p0, p)
                    o["ep"].setdefault(nm, []).append(rel(X.run(pe, seg, rate=rt)[0], X.run(p0, seg, rate=rt)[0]))
        full = (sg["A"][0], X.n)
        o["full"][k] = rel(X.run(p, full, rate=rt)[0], X.run(p0, full, rate=rt)[0])
        if starts:
            for y in range(2005, 2021):
                a0 = _ix(X.t, f"{y}-01-01")
                if X.n - a0 > 250:
                    o["starts"].append(rel(X.run(p, (a0, X.n), rate=rt)[0], X.run(p0, (a0, X.n), rate=rt)[0]))
    v = np.array(list(o["cells"].values()))
    o["n"] = len(v)
    o["ok"] = int((v >= -0.5).sum())
    o["worst"] = float(v.min())
    o["sum"] = lsum(v)
    o["A"] = lsum([o["cells"][(k, "A")] for k in keys if (k, "A") in o["cells"]])
    o["B"] = lsum([o["cells"][(k, "B")] for k in keys if (k, "B") in o["cells"]])
    o["l1"], o["l2"] = lsum(o["lag1"]), lsum(o["lag2"])
    if episodes_:
        o["epsum"] = {nm: lsum(v) for nm, v in o["ep"].items()}
    if starts:
        s = np.array(o["starts"])
        o["share"] = float((s >= -0.5).mean() * 100)
    return o


def dok2(o, min_ok=7, min_worst=-3.0, min_sum=4.0):
    why = []
    need = min_ok if o["n"] == 8 else int(np.ceil(o["n"] * 7 / 8))
    if o["ok"] < need:
        why.append(f"не хуже {o['ok']}/{o['n']}")
    if o["worst"] < min_worst:
        why.append(f"худшая {o['worst']:+.1f}")
    if o["sum"] < min_sum:
        why.append(f"сумма {o['sum']:+.1f}")
    if o["A"] < 0 or o["B"] < 0:
        why.append(f"половины {o['A']:+.1f}/{o['B']:+.1f}")
    if o["l1"] < 0 or o["l2"] < 0:
        why.append(f"сдвиг {o['l1']:+.1f}/{o['l2']:+.1f}")
    if "epsum" in o:
        bad = [nm for nm, v in o["epsum"].items() if v < 0]
        if bad:
            why.append("без эпизода " + ",".join(bad))
    if "share" in o and o["share"] < 70:
        why.append(f"старты {o['share']:.0f}%")
    return not why, "; ".join(why)


def dfmt2(o, keys=DSEL):
    cells = " ".join(f"{NAME[k][:3]} " + "/".join(f"{o['cells'][(k, h)]:+.1f}" if (k, h) in o["cells"] else "—" for h in ("A", "B")) for k in keys)
    s = f"сумма {o['sum']:+.1f} (A {o['A']:+.1f}, B {o['B']:+.1f}), не хуже {o['ok']}/{o['n']}, худшая {o['worst']:+.1f} | {cells} | сдвиг {o['l1']:+.1f}/{o['l2']:+.1f}"
    if "epsum" in o:
        s += " | без эпиз. мин " + f"{min(o['epsum'].values()):+.1f}"
    if "share" in o:
        s += f" | старты {o['share']:.0f}%"
    return s


def msegs(d):
    t = d["t"]
    return {"A": (_ix(t, A0), _ix(t, B0)), "B": (_ix(t, B0), len(d["c"])), "82": (d["h82"], d["m"]), "65": (_ix(t, "1965-01-01"), d["h82"]),
            "full05": (_ix(t, A0), len(d["c"]))}


def mrun(d, p, seg, lag=0, rate=None):
    c = d["c"]
    n = len(c)
    a0, a1 = seg
    if a1 - a0 < 24:
        return np.nan
    r = np.zeros(n) if rate is None else rate
    return L.sim(c, np.asarray(p, np.float64), a0, a1, lag, r)[0]


def mcheck2(D, fn, ref, keys=MSEL):
    """Месячный протокол (2005–26) + вторичная проверка 1982–98 / 1965–81."""
    o = {"cells": {}, "lag1": [], "sec82": {}, "sec65": {}, "full05": {}}
    for k in keys:
        d = D[k]
        p, p0 = np.asarray(fn(d), np.float64), np.asarray(ref(d), np.float64)
        sg = msegs(d)
        for h in ("A", "B"):
            o["cells"][(k, h)] = rel(mrun(d, p, sg[h]), mrun(d, p0, sg[h]))
            o["lag1"].append(rel(mrun(d, p, sg[h], 1), mrun(d, p0, sg[h], 1)))
        o["full05"][k] = rel(mrun(d, p, sg["full05"]), mrun(d, p0, sg["full05"]))
        for key, h in (("sec82", "82"), ("sec65", "65")):
            e, e0 = mrun(d, p, sg[h]), mrun(d, p0, sg[h])
            if np.isfinite(e) and np.isfinite(e0):
                o[key][k] = rel(e, e0)
    v = np.array(list(o["cells"].values()))
    o["n"] = len(v)
    o["ok"] = int((v >= -0.5).sum())
    o["worst"] = float(np.nanmin(v))
    o["sum"] = lsum(v)
    o["A"] = lsum([o["cells"][(k, "A")] for k in keys])
    o["B"] = lsum([o["cells"][(k, "B")] for k in keys])
    o["l1"] = lsum(o["lag1"])
    for key in ("sec82", "sec65"):
        vv = np.array(list(o[key].values()))
        o[key + "_sum"] = lsum(vv) if len(vv) else 0.0
        o[key + "_worst"] = float(vv.min()) if len(vv) else 0.0
    return o


def mok2(o, min_sum=4.0):
    why = []
    if o["ok"] < 13:
        why.append(f"не хуже {o['ok']}/16")
    if o["worst"] < -5:
        why.append(f"худшая {o['worst']:+.1f}")
    if o["sum"] < min_sum:
        why.append(f"сумма {o['sum']:+.1f}")
    if o["A"] < 0 or o["B"] < 0:
        why.append(f"половины {o['A']:+.1f}/{o['B']:+.1f}")
    if o["l1"] < 0:
        why.append(f"сдвиг {o['l1']:+.1f}")
    return not why, "; ".join(why)


def msec(o):
    """Вторичная проверка: (ok, грубый провал, строка)."""
    bad = []
    for key, nm in (("sec82", "1982–98"), ("sec65", "1965–81")):
        if o[key + "_sum"] < -10 or o[key + "_worst"] < -10:
            bad.append(f"{nm} сумма {o[key + '_sum']:+.1f}, худший {o[key + '_worst']:+.1f}")
    gross = o["sec82_sum"] < -30 or o["sec65_sum"] < -30
    return not bad, gross, "; ".join(bad)


def mfmt2(o, keys=MSEL):
    cells = " ".join(f"{NAME[k][:3]} {o['cells'][(k, 'A')]:+.1f}/{o['cells'][(k, 'B')]:+.1f}" for k in keys)
    return (f"сумма {o['sum']:+.1f} (A {o['A']:+.1f}, B {o['B']:+.1f}), не хуже {o['ok']}/16, худшая {o['worst']:+.1f}, сдвиг {o['l1']:+.1f} | {cells}"
            f" || втор.: 1982–98 {o['sec82_sum']:+.1f} (худш. {o['sec82_worst']:+.1f}), 1965–81 {o['sec65_sum']:+.1f} (худш. {o['sec65_worst']:+.1f})")


def q2var(**kw):
    """Q2 с изменёнными параметрами r3 (g — доля резерва в месяц серии, k_on, persist и т. д.)."""
    from metals_agent3_loop5 import cool
    base = {"hot2": 0.5, **kw}
    return cool(lambda dd: A.r3(dd, **base), 0.2, 24)


def dprec2(MM, fn, keys=DSEL):
    """Точность докупок в дневной модели на 2005–26 (старт с нуля в 2005)."""
    out = {}
    for k in keys:
        X = MM[k]
        p = fn(X)
        a0 = dsegs(X)["A"][0]
        r = X.run(p, (a0, X.n))
        out[k] = precision(X.c, r[1], X.t, a0, X.n, 252, 504, 63)
    return out


def fprec2(P, keys=None):
    keys = keys or list(P)
    a = agg_prec({k: P[k] for k in keys})
    return (f"рано {a['early']:.1f}%, к DCA рез. {a['vsdca']:+.1f}% | " +
            ", ".join(f"{NAME[k][:3]} {P[k]['early']:.0f}/{P[k]['vsdca']:+.0f}" for k in keys if np.isfinite(P[k].get('early', np.nan))))
