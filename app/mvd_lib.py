"""Стенд mvd: ПЛАВНЫЙ ВЗНОС ПО ИНДИКАТОРАМ на металлах (дёшево по индикатору — купить больше взноса из накопленного,
дорого — меньше взноса, остаток копить). Протокол — research/mvd_journal.md. Поверх mcx_lib / mb_lib / mt4_lib без их изменения.

Счёт (`simv`): взнос $10 каждый торговый день; решение по закрытию дня j, исполнение по закрытию j + 1 + lag; комиссия 0,1%.
Два кармана денег: макро-резерв mb1 (его тратят только серии mb1) и КОПИЛКА шкалы S (её пополняет и тратит только шкала).
- pm — план основы: единицы (DCA, «базовый вариант без продаж и серий») или дневной план mb1 (1 взнос, > 1 серия, < 0 продажа, 0 остывание);
- mult — множитель взноса дня (по индикатору): в день «взнос» основы покупается mult × $10; если mult < 1 — недокупленное идёт в копилку
  (пока S < cap; сверх предела — покупается, т. е. копить больше cap нельзя); если mult > 1 — сверх взноса тратится из копилки (сколько есть);
- leak — доля копилки, докупаемая каждый день принудительно (0 — нет);
- cool (только поверх mb1): 0 — в остывании mb1 копит 100% взноса в макро-резерв (как mb1); 1 — в остывании покупается min(mult, 1) × взнос,
  остаток — в макро-резерв; 2 — в остывании покупается только надбавка min(mult − 1, 1) × взнос (дешёвые дни), остаток — в макро-резерв;
- ser (только поверх mb1): что делать с копилкой в серии mb1: 0 — лежит; 1 — тратится той же долей, что макро-резерв; 2 — сливается в макро-резерв;
- pmax ≥ 0: копилка тратится, только если цена ≤ средней цены накопления × (1 + pmax);
- adv > 0: «аванс» — при mult > 1 и пустой копилке покупка в долг до adv $ (ставка ФРС + dspread), долг гасится недокупленными взносами;
- va > 0: «value averaging» вместо mult: целевая стоимость позиции растёт на взнос в день и на vag годовых; покупка = цель − стоимость,
  в пределах [0, vamax × взнос] (и сколько есть в копилке + взнос).
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
LOGDIR = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/mvd"
A0, B0, CUT = "2005-01-01", "2016-01-01", "2026-01-01"
EPW = C.EPW                     # 2008, 2011, 2013, 2015–16, 2018, 2020, 2022 — окна «без эпизода» (шкала выключена)
rel = M.rel
lsum = C.lsum
ix = C.ix


def tee(path):
    os.makedirs(LOGDIR, exist_ok=True)
    M.LOGDIR = LOGDIR
    return M.tee(path)


def load():
    return C.load()


# ---------------- счёт ----------------
@njit(cache=True)
def simv(c, pm, mult, lo, hi, lag, rate, fee, cap, cool, ser, leak, va, vag, vamax, pmax=-1.0, adv=0.0, drate=None):
    n = len(c)
    bx = np.zeros(n)        # покупки из копилки сверх взноса ($)
    SS = np.zeros(n)        # копилка по дням
    BM = np.zeros(n)        # покупки макро-резерва (серии mb1) сверх взноса
    cm = 0.0
    S = 0.0
    units = 0.0
    du = 0.0
    T = 0.0
    ssum = 0.0
    usum = 0.0
    mincov = 1e9
    if drate is None:
        drate = np.zeros(n)
    for i in range(lo, hi):
        p = c[i]
        j = i - 1 - lag
        a = pm[j] if j >= lo else 1.0
        m = mult[j] if j >= lo else 1.0
        cm *= 1 + rate[i]
        if S >= 0:
            S *= 1 + rate[i]
            ssum *= 1 + rate[i]
        else:
            S *= 1 + drate[i]
        T *= 1 + vag / 252.0
        T += 10.0
        before = cm
        du += 10.0 * (1 - fee) / p
        if a < 0:
            cm += 10.0
            v = -a * units * p
            if v > 0:
                units += a * units
                cm += v * (1 - fee)
        elif a > 1.0:
            cm += 10.0
            v = min(cm, 10.0 + (a - 1.0) * before)
            units += v * (1 - fee) / p
            cm -= v
            if v > 10.0:
                BM[i] = v - 10.0
            if ser == 1 and S > 0:
                w = min(a - 1.0, 1.0) * S
                units += w * (1 - fee) / p
                S -= w
                bx[i] += w
            elif ser == 2 and S > 0:
                cm += S
                S = 0.0
        elif a == 0.0 and cool == 0:
            cm += 10.0
        else:
            if va > 0 and m >= 0:
                want = T - units * p
                if want < 0:
                    want = 0.0
                if want > vamax * 10.0:
                    want = vamax * 10.0
            elif va > 0:
                want = 10.0
            else:
                want = m * 10.0
            if a == 0.0:
                if cool == 2:
                    b = min(max(want - 10.0, 0.0), 10.0)     # в остывании покупается только надбавка «дёшево» (не больше взноса)
                else:
                    b = min(want, 10.0)
                units += b * (1 - fee) / p
                cm += 10.0 - b
            elif want <= 10.0:
                sv = 10.0 - want
                b = 10.0
                if S < 0:
                    r = min(sv, -S)
                    S += r
                    sv -= r
                    b -= r
                room = cap - S
                if room < 0:
                    room = 0.0
                s_ = min(sv, room)
                S += s_
                ssum += s_
                usum += s_ / p
                b -= s_
                units += b * (1 - fee) / p
            else:
                need = want - 10.0
                e = 0.0
                if S > 0 and (pmax < 0 or usum <= 0 or p <= ssum / usum * (1 + pmax)):
                    e = min(S, need)
                    if S > 0:
                        f_ = e / S
                        ssum *= 1 - f_
                        usum *= 1 - f_
                    S -= e
                d = 0.0
                if adv > 0 and S <= 0:
                    d = min(need - e, adv + S)
                    if d < 0:
                        d = 0.0
                    S -= d
                units += (10.0 + e + d) * (1 - fee) / p
                bx[i] += e + d
            if leak > 0 and S > 0:
                w = leak * S
                units += w * (1 - fee) / p
                ssum *= 1 - leak
                usum *= 1 - leak
                S -= w
                bx[i] += w
        SS[i] = S
        if S < 0:
            cv = (units * p + cm) / (-S)
            if cv < mincov:
                mincov = cv
    fin = units * c[hi - 1] + cm + S
    return (fin / (du * c[hi - 1]) - 1) * 100, bx, SS, BM, units, cm, S, mincov


class Scale:
    """Шкала: u(X) → «дороговизна» 0…1 (0 — дёшево), карта u → множитель, параметры копилки. base: 'dca' или 'mb1'."""

    def __init__(self, ufn, mapf=None, cap=252 * 10.0, base="dca", cool=0, ser=0, leak=0.0, va=0, vag=0.0, vamax=3.0, name="", pmax=-1.0, adv=0.0,
                 dspread=2.0, ffmax=None):
        self.ufn, self.mapf, self.cap, self.base, self.cool, self.ser, self.leak = ufn, mapf, cap, base, cool, ser, leak
        self.pmax, self.adv, self.dspread, self.ffmax = pmax, adv, dspread, ffmax
        self.va, self.vag, self.vamax, self.name = va, vag, vamax, name
        self._u = {}

    def u(self, X):
        if X.k not in self._u:
            self._u[X.k] = np.asarray(self.ufn(X), np.float64)
        return self._u[X.k]

    def mult(self, X, u=None):
        u = self.u(X) if u is None else u
        m = np.asarray(self.mapf(np.where(np.isfinite(u), u, 0.5)), np.float64)
        if self.ffmax is not None:                      # сверх взноса (аванс) — только при ставке ФРС < ffmax
            m = np.where(np.nan_to_num(X.ff, nan=5.0) >= self.ffmax, np.minimum(m, 1.0), m)
        return m


def run(S_, X, seg, lag=0, rate=None, fee=0.001, mask=None, u=None):
    _, _, _, base = load()
    a0, a1 = seg
    if a1 - a0 < 250:
        return (np.nan,) + (np.zeros(X.n),) * 3 + (0.0, 0.0, 0.0, 1e9)
    pm = np.ones(X.n) if S_ is None or S_.base == "dca" else base[X.k]
    if S_ is None:
        m = np.ones(X.n)
        args = (1e18, 0, 0, 0.0, 0, 0.0, 3.0, -1.0, 0.0, np.zeros(X.n))
    else:
        m = S_.mult(X, u)
        if mask is not None:
            m = np.where(mask, -1.0 if S_.va else 1.0, m)
        args = (S_.cap, S_.cool, S_.ser, S_.leak, S_.va, S_.vag, S_.vamax, S_.pmax, S_.adv,
                (np.nan_to_num(X.ff, nan=5.0) + S_.dspread) / 100 / 252)
    r = X.rate0 if rate is None else rate
    return simv(X.c, pm, m, a0, a1, lag, r, fee, *args)


def run_mb1(X, seg, lag=0, rate=None, fee=0.001):
    _, _, _, base = load()
    a0, a1 = seg
    if a1 - a0 < 250:
        return np.nan
    r = X.rate0 if rate is None else rate
    return simv(X.c, base[X.k], np.ones(X.n), a0, a1, lag, r, fee, 1e18, 0, 0, 0.0, 0, 0.0, 3.0, -1.0, 0.0, np.zeros(X.n))[0]


def segs(X, cut=CUT):
    a, b, c = ix(X.t, A0), ix(X.t, B0), ix(X.t, cut)
    return {"A": (a, b), "B": (b, c)}


def refval(S_, X, seg, lag=0, rate=None, fee=0.001):
    """Итог основы (к DCA, %): для base='dca' — 0 (DCA) с той же комиссией; для 'mb1' — mb1."""
    if S_.base == "dca":
        return run(None, X, seg, lag, rate, fee)[0]
    return run_mb1(X, seg, lag, rate, fee)


def check(S_, keys=DSEL, rate=None, fee=0.001, starts=True, epis=True, after=True, u_over=None):
    """Протокол mvd (решение до 2025-12) против основы шкалы (DCA или mb1): ячейки металл × A/B, сдвиг 1/2, без каждого эпизода
    (шкала выключена в окне), старты 2005–2020, (а) 2005–25 по металлу; after — 2005–2026.11 и вся история 2000–26 (после решения).
    u_over: {металл: u} — подменённый индикатор (контроль с перемешиванием)."""
    _, _, MM, _ = load()
    o = {"cells": {}, "lag1": [], "lag2": [], "ep": {}, "starts": [], "full": {}, "full26": {}, "all26": {}, "abs": {}}
    for k in keys:
        X = MM[k]
        u = None if u_over is None else u_over[k]
        rt = X.rate0 if rate is None else (X.ratetb if rate == "tb" else rate)
        sg = segs(X)
        R = lambda seg, lag=0, mask=None: run(S_, X, seg, lag, rt, fee, mask, u)[0]  # noqa: E731
        F = lambda seg, lag=0: refval(S_, X, seg, lag, rt, fee)  # noqa: E731
        for h, seg in sg.items():
            if seg[1] - seg[0] < 250:
                continue
            r0 = F(seg)
            r1 = R(seg)
            o["cells"][(k, h)] = rel(r1, r0)
            o["abs"][(k, h)] = r1
            for lag, key in ((1, "lag1"), (2, "lag2")):
                o[key].append(rel(R(seg, lag), F(seg, lag)))
            if epis:
                for nm, (a, b) in EPW.items():
                    w = (X.t >= a) & (X.t <= b)
                    o["ep"].setdefault(nm, []).append(rel(R(seg, 0, w), r0))
        a0 = sg["A"][0] if sg["A"][1] - sg["A"][0] >= 250 else sg["B"][0]
        fs = (a0, sg["B"][1])
        o["full"][k] = rel(R(fs), F(fs))
        o["abs"][(k, "full")] = R(fs)
        if after:
            o["full26"][k] = rel(R((a0, X.n)), F((a0, X.n)))
            o["all26"][k] = rel(R((0, X.n)), F((0, X.n)))
            o["abs"][(k, "full26")] = R((a0, X.n))
            o["abs"][(k, "all26")] = R((0, X.n))
        if starts:
            for y in range(2005, 2021):
                s0 = ix(X.t, f"{y}-01-01")
                if sg["B"][1] - s0 > 250:
                    o["starts"].append(rel(R((s0, sg["B"][1])), F((s0, sg["B"][1]))))
    v = np.array(list(o["cells"].values()))
    o["n"] = len(v)
    o["ok"] = int((v >= -0.5).sum())
    o["worst"] = float(v.min()) if len(v) else 0.0
    o["sum"] = lsum(v)
    o["A"] = lsum([o["cells"][(k, "A")] for k in keys if (k, "A") in o["cells"]])
    o["B"] = lsum([o["cells"][(k, "B")] for k in keys if (k, "B") in o["cells"]])
    o["Bok"] = int(sum(1 for k in keys if (k, "B") in o["cells"] and o["cells"][(k, "B")] > 0.5))
    o["l1"], o["l2"] = lsum(o["lag1"]), lsum(o["lag2"])
    o["fsum"] = lsum(list(o["full"].values()))
    o["fok"] = int(sum(1 for x in o["full"].values() if x >= -0.5))
    if epis:
        o["epsum"] = {nm: lsum(x) for nm, x in o["ep"].items()}
    if starts and o["starts"]:
        o["share"] = float((np.array(o["starts"]) >= -0.5).mean() * 100)
    if after:
        o["f26sum"] = lsum(list(o["full26"].values()))
        o["a26sum"] = lsum(list(o["all26"].values()))
    return o


def ok(o, min_sum=4.0):
    """Критерий mvd (записан до круга 1; к основе — DCA или mb1): ≥ 7/8 ячеек не хуже (−0,5), худшая ≥ −3, сумма ≥ +4, обе половины ≥ 0
    и половина B > 0 (B лучше основы не менее чем у 3 из 4 металлов на +0,5), сдвиг 1/2 ≥ 0, (б) без каждого эпизода сумма > 0,
    старты ≥ 70%, (а) 2005–25 по металлу не хуже у ≥ 3/4 и сумма ≥ 0."""
    why = []
    need = int(np.ceil(o["n"] * 7 / 8))
    if o["ok"] < need:
        why.append(f"не хуже {o['ok']}/{o['n']}")
    if o["worst"] < -3:
        why.append(f"худшая {o['worst']:+.1f}")
    if o["sum"] < min_sum:
        why.append(f"сумма {o['sum']:+.1f}")
    if o["A"] < -0.05 or o["B"] <= 0:
        why.append(f"половины {o['A']:+.1f}/{o['B']:+.1f}")
    if o["Bok"] < 3:
        why.append(f"B лучше у {o['Bok']}/4")
    if o["l1"] < 0 or o["l2"] < 0:
        why.append(f"сдвиг {o['l1']:+.1f}/{o['l2']:+.1f}")
    if "epsum" in o:
        bad = [f"{nm} {v:+.1f}" for nm, v in o["epsum"].items() if v <= 0]
        if bad:
            why.append("без эпизода: " + ", ".join(bad))
    if "share" in o and o["share"] < 70:
        why.append(f"старты {o['share']:.0f}%")
    if o["fok"] < 3 or o["fsum"] < 0:
        why.append(f"2005–25 не хуже {o['fok']}/{len(o['full'])}, сумма {o['fsum']:+.1f}")
    return not why, "; ".join(why)


def fmt(o, keys=DSEL, short=False):
    cells = " ".join(f"{NAME[k][:3]} " + "/".join(f"{o['cells'][(k, h)]:+.1f}" if (k, h) in o["cells"] else "—" for h in ("A", "B")) for k in keys)
    s = f"сумма {o['sum']:+.1f} (A {o['A']:+.1f}, B {o['B']:+.1f}), не хуже {o['ok']}/{o['n']}, худш. {o['worst']:+.1f} | {cells}"
    if short:
        return s
    s += f" | сдвиг {o['l1']:+.1f}/{o['l2']:+.1f}"
    if "epsum" in o:
        s += " | без эпиз. мин " + min((f"{v:+.1f} ({nm})" for nm, v in o["epsum"].items()), key=lambda z: float(z.split()[0]))
    if "share" in o:
        s += f" | старты {o['share']:.0f}%"
    s += f" | 2005–25 {o['fsum']:+.1f} ({o['fok']}/{len(o['full'])})"
    return s


def fafter(o, keys=DSEL):
    return ("после решения: 2005–26.11 " + " ".join(f"{NAME[k][:3]} {o['full26'][k]:+.1f}" for k in keys if k in o["full26"]) + f" (сумма {o['f26sum']:+.1f}); "
            "вся история 2000–26 " + " ".join(f"{NAME[k][:3]} {o['all26'][k]:+.1f}" for k in keys if k in o["all26"]) + f" (сумма {o['a26sum']:+.1f})")


# ---------------- индикаторы (только прошлое; u = 0 — дёшево, 1 — дорого) ----------------
def sma(x, n):
    return pd.Series(x).rolling(n, min_periods=n).mean().values


def prank(x, W=1260, minp=250):
    """Перцентиль текущего значения среди прошлых W дней (0…1)."""
    s = pd.Series(np.asarray(x, float))
    return s.rolling(W, min_periods=minp).rank(pct=True).values


def resample_rsi(c, t, rule, n=14):
    """RSI по закрытиям недель/месяцев; на день — значение последнего ЗАКОНЧЕННОГО периода (известно после его закрытия)."""
    s = pd.Series(c, index=t)
    w = s.resample(rule).last().dropna()
    r = pd.Series(C.rsi(w.values, n), index=w.index)
    # период, закончившийся датой метки; день внутри следующего периода видит прошлую метку
    return r.reindex(t, method="ffill").shift(1).values


_IND = {}


def ind(X, name):
    """Сырые индикаторы (ориентация: БОЛЬШЕ = ДОРОЖЕ)."""
    key = (X.k, name)
    if key in _IND:
        return _IND[key]
    D, DD, MM, _ = load()
    f = C.feats(X, DD)
    c = X.c
    lc = np.log(c)
    sd250 = f["sd250"]
    if name == "ma200":
        v = np.log(f["ma200"]) / (sd250 * np.sqrt(100))
    elif name == "ma50":
        v = np.log(f["ma50"]) / (sd250 * np.sqrt(25))
    elif name == "z3y":
        m = pd.Series(lc).rolling(756, min_periods=500).mean().values
        s = pd.Series(lc).rolling(756, min_periods=500).std().values
        v = (lc - m) / s
    elif name == "rsi_d":
        v = f["rsi"]
    elif name == "rsi_w":
        v = resample_rsi(c, X.t, "W-FRI")
    elif name == "rsi_m":
        v = resample_rsi(c, X.t, "ME")
    elif name == "dd1y":
        v = np.log(c / C.rmax(c, 252)) / (sd250 * np.sqrt(252))
    elif name == "pct3":
        v = prank(c, 756)
    elif name == "pct5":
        v = prank(c, 1260)
    elif name == "dxy":       # сильный доллар (выше своей средней 200 дн.) — металл дёшев → ориентация «больше = дороже»: минус
        v = -np.log(f["dxy_ma200"])
    elif name == "rr":        # реальная ставка 10 лет (y10 − инфляция за год) выше своей средней 3 лет — металл дёшев
        Xm = D["_X"]
        rr = Xm["y10"] - (Xm["cpi"] / Xm["cpi"].shift(12) - 1) * 100
        dev = rr - rr.rolling(36, min_periods=24).mean()
        v = -M.monthly_on_days(dev, X.t)
    elif name == "gsr":       # золото/серебро высоко — серебро дёшево (только серебро)
        g = pd.Series(MM["gold"].c, index=MM["gold"].t)
        r = np.log(C.on_days(g, X.t) / c)
        v = -(r - pd.Series(r).rolling(1260, min_periods=500).mean().values)
    else:
        raise KeyError(name)
    v = np.asarray(v, float)
    _IND[key] = v
    return v


def U(name, W=1260):
    """u-функция: перцентиль индикатора за прошлые W дней (0 — самый дешёвый)."""
    def f(X):
        return prank(ind(X, name), W)
    f.__name__ = f"u_{name}_{W}"
    return f


def Ucomp(names, W=1260):
    def f(X):
        us = np.vstack([prank(ind(X, nm), W) for nm in names])
        return np.nanmean(us, axis=0)
    return f


def lin(k, lo=0.0, hi=None):
    """Плавная линейная карта: mult = 1 + k·(1 − 2u), в пределах [lo, hi]."""
    hi = 1 + k if hi is None else hi
    return lambda u: np.clip(1 + k * (1 - 2 * u), lo, hi)


def steps(q1, q2, mhi, mlo):
    """Ступени: u ≤ q1 → mhi; u ≥ q2 → mlo; иначе 1."""
    return lambda u: np.where(u <= q1, mhi, np.where(u >= q2, mlo, 1.0))


def shifted(S_, keys, seed, minsh=252):
    """Контроль: индикатор каждого металла циклически сдвинут на случайное число дней (структура ряда сохранена, связь с ценой разрушена)."""
    _, _, MM, _ = load()
    rng = np.random.default_rng(seed)
    out = {}
    for k in keys:
        u = S_.u(MM[k])
        n = len(u)
        sh = int(rng.integers(minsh, n - minsh))
        out[k] = np.roll(u, sh)
    return out


def control(S_, keys=DSEL, nseed=20, **kw):
    """Распределение суммы 8 ячеек и половины B у контроля со сдвинутым индикатором."""
    sums, bs, fs = [], [], []
    for s in range(nseed):
        o = check(S_, keys, starts=False, epis=False, after=False, u_over=shifted(S_, keys, s), **kw)
        sums.append(o["sum"])
        bs.append(o["B"])
        fs.append(o["fsum"])
    return np.array(sums), np.array(bs), np.array(fs)
