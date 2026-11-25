"""Стенд mcx: перенос паттернов крипто-стратегии combo7 на металлы как ДНЕВНОЙ слой поверх mb1 (или отдельная дневная стратегия).
Протокол — research/mcx_journal.md. Поверх mb_lib.py / mbx_lib.py / mt4_lib.py без их изменения.

Главное:
- основа сравнения — mb1 (дневная: Q2д + пауза докупок серии 90 дней после стресса BTC), `mb_r9.mb1`;
- дневной слой работает со СВОИМ («тактическим») резервом: деньги от дневных продаж слоя (и отложенные взносы слоя) лежат отдельно
  от макро-резерва mb1 и тратятся только правилами слоя; макро-резерв тратят только серии mb1. Монеты общие.
  Отдельная дневная стратегия = тот же счёт без mb1 (макро-план = 1, только взнос);
- решение по вчерашнему закрытию (план j → исполнение по закрытию j + 1 + lag), сдвиг 0/1/2, комиссия 0,1% (проверка 0,5%);
- отбор: золото, серебро, платина, медь; половины A = 2005–15, B = 2016–2025-12 (старт с нуля); экзамен — палладий;
  обвал 2026 — только после решения;
- метрики «активность и точность» (круг 1) одинаковы для крипты (combo7) и металлов.
"""
import os
import sys

import numpy as np
import pandas as pd
from numba import njit

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mb_lib as B  # noqa: E402
import mt4_lib as M  # noqa: E402

NAME = M.NAME
DSEL = ["gold", "silver", "platinum", "copper"]
DEX = ["palladium"]
ALL5 = DSEL + DEX
LOGDIR = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/mcx"
A0, B0, CUT = "2005-01-01", "2016-01-01", "2026-01-01"
# окна «без эпизода» (критерий (б)): слой выключен в окне спуска и дна
EPW = {"2008": ("2008-03-01", "2009-06-30"), "2011": ("2011-04-01", "2011-12-31"), "2013": ("2013-01-01", "2013-12-31"),
       "2015–16": ("2014-09-01", "2016-06-30"), "2018": ("2018-01-01", "2019-03-31"), "2020": ("2020-01-01", "2020-06-30"),
       "2022": ("2022-03-01", "2022-12-31")}
rel = M.rel


def tee(path):
    os.makedirs(LOGDIR, exist_ok=True)
    M.LOGDIR = LOGDIR
    return M.tee(path)


def ix(t, s):
    return int(np.searchsorted(np.asarray(t, "datetime64[ns]"), np.datetime64(s)))


def lsum(v):
    v = np.nan_to_num(np.asarray(v, float))
    return float(np.log1p(v / 100).sum() * 100)


_C = {}


def load():
    """D (месячные), DD (дневные + макро), MM (дневные металлы), base (дневной план mb1 по металлу)."""
    if "MM" not in _C:
        D, DD, MM = B.load()
        from mb_r9 import mb1
        f = mb1(D, DD)
        base = {k: np.asarray(f(MM[k]), np.float64) for k in MM}
        _C.update(D=D, DD=DD, MM=MM, base=base)
    return _C["D"], _C["DD"], _C["MM"], _C["base"]


# ---------------- признаки (только прошлое, на днях металла) ----------------
def on_days(s, t):
    s = s.dropna()
    s = s[~s.index.duplicated(keep="last")]
    return s.reindex(pd.DatetimeIndex(t), method="ffill").values


def sma(x, n):
    return pd.Series(x).rolling(n, min_periods=n).mean().values


def rmax(x, n):
    return pd.Series(x).rolling(n, min_periods=1).max().values


def rmin(x, n):
    return pd.Series(x).rolling(n, min_periods=1).min().values


def rsi(c, n=14):
    s = pd.Series(c)
    d = s.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return (100 - 100 / (1 + up / dn.replace(0, np.nan))).fillna(50).values


def rank_trail(x, W=750, minp=250):
    """Перцентиль текущего значения среди прошлых W дней (0…100)."""
    s = pd.Series(x)
    return (s.rolling(W, min_periods=minp).rank(pct=True) * 100).values


def feats(X, DD):
    """Дневные признаки металла X (кэш в X)."""
    if hasattr(X, "_f"):
        return X._f
    c = X.c
    lr = np.r_[0.0, np.diff(np.log(c))]
    sd = pd.Series(lr).rolling(63, min_periods=40).std().values          # дневная вол 63 дн.
    sd250 = pd.Series(lr).rolling(250, min_periods=120).std().values
    sd20 = pd.Series(lr).rolling(20, min_periods=15).std().values
    f = {"lr": lr, "sd": sd, "sd250": sd250, "sd20": sd20, "hv": sd250 * np.sqrt(252) * 100}
    for n in (5, 10, 21, 63, 126, 250):
        f[f"r{n}"] = np.r_[np.full(n, np.nan), c[n:] / c[:-n] - 1]
        f[f"z{n}"] = np.log1p(f[f"r{n}"]) / (sd250 * np.sqrt(n))         # рост за n дней в единицах σ годовой вол
    for n in (21, 63, 126, 250):
        f[f"dd{n}"] = c / rmax(c, n) - 1
        f[f"up{n}"] = c / rmin(c, n) - 1
    f["ddath"] = c / np.maximum.accumulate(c) - 1
    f["rsi"] = rsi(c)
    for n in (20, 50, 200):
        f[f"ma{n}"] = c / sma(c, n)
    # «страх/жадность металла» (аналог индекса крипты): перцентиль (3 года) составного счёта
    comp = (rank_trail(f["z21"]) + rank_trail(np.log(f["ma50"])) + rank_trail(f["rsi"]) + rank_trail(-sd20 / sd250)) / 4
    f["fg"] = rank_trail(comp)
    # рынок
    x = DD["x"]
    for nm in ("dxy", "tnx", "vix", "btc"):
        f[nm] = on_days(x[nm], X.t)
    dx = f["dxy"]
    f["dxy_mx10"] = dx / rmax(dx, 10)
    f["dxy_r21"] = np.r_[np.full(21, np.nan), dx[21:] / dx[:-21] - 1]
    f["dxy_ma200"] = dx / sma(dx, 200)
    X._f = f
    return f


def cross(MM, a, b, key="c"):
    """Отношение цен двух металлов на днях металла a (ffill b)."""
    s = pd.Series(MM[b].c, index=MM[b].t)
    return MM[a].c / on_days(s, MM[a].t)


# ---------------- счёт: макро-резерв mb1 + тактический резерв слоя ----------------
@njit(cache=True)
def sim2(c, pm, ts, tb, tk, tm, lo, hi, lag, rate, fee, capf=1.0, tomac=0):
    """pm — план mb1 (1 взнос, > 1 взнос + доля макро-резерва, < 0 продать долю монет, 0 копить взнос в макро-резерв);
    слой: ts — доля монет к продаже (≥ 0), выручка в тактический резерв; tb — доля тактического резерва к покупке (≥ 0);
    tk — доля взноса дня (0…1), которая не покупается, а уходит в тактический резерв («копить»), пока тактический резерв < capf капитала; tm — доля МАКРО-резерва к покупке по сигналу слоя
    (только «×2» на развороте; не в день продажи/серии mb1); продажа слоя не делается в день продажи/серии mb1,
    покупка слоя не делается в день продажи mb1. Возвращает (итог к DCA %, докупки макро, докупки слоя, продажи макро, продажи слоя,
    тактический резерв по дням, макро-резерв по дням, монеты по дням)."""
    n = len(c)
    bm = np.zeros(n); bt = np.zeros(n); sm = np.zeros(n); st = np.zeros(n)
    CT = np.zeros(n); CM = np.zeros(n); U = np.zeros(n)
    cm = 0.0; ct = 0.0; units = 0.0; du = 0.0
    for i in range(lo, hi):
        p = c[i]
        j = i - 1 - lag
        a = pm[j] if j >= lo else 1.0
        s_ = ts[j] if j >= lo else 0.0
        b_ = tb[j] if j >= lo else 0.0
        k_ = tk[j] if j >= lo else 0.0
        m_ = tm[j] if j >= lo else 0.0
        cm *= 1 + rate[i]
        ct *= 1 + rate[i]
        before = cm
        du += 10.0 * (1 - fee) / p
        cin = 10.0
        if k_ > 0 and a >= 0 and a <= 1.0 and ct < capf * (units * p + cm + ct):
            ct += 10.0 * min(k_, 1.0)                    # слой копит (долю) взноса
            cin = 10.0 * (1.0 - min(k_, 1.0))
        if cin > 0:
            cm += cin
            if a < 0:
                v = -a * units * p
                if v > 0:
                    units += a * units
                    cm += v * (1 - fee)
                    sm[i] = v
            elif a > 0:
                v = min(cm, cin * min(a, 1.0) + max(a - 1.0, 0.0) * before)
                units += v * (1 - fee) / p
                cm -= v
                if v > cin * 1.001 + 1e-9:
                    bm[i] = v - cin
            if m_ > 0 and a >= 0 and a <= 1.0 and cm > 0:
                v = min(m_, 1.0) * cm
                units += v * (1 - fee) / p
                cm -= v
                bt[i] += v
        if a >= 0 and a <= 1.0 and s_ > 0 and units > 0:
            v = min(s_, 1.0) * units * p
            units -= min(s_, 1.0) * units
            if tomac:
                cm += v * (1 - fee)                       # выручка слоя — в макро-резерв mb1 (тратит только серия)
            else:
                ct += v * (1 - fee)
            st[i] = v
        elif a >= 0 and b_ > 0 and ct > 0:
            v = min(b_, 1.0) * ct
            units += v * (1 - fee) / p
            ct -= v
            bt[i] += v
        CT[i] = ct; CM[i] = cm; U[i] = units
    fin = units * c[hi - 1] + cm + ct
    return (fin / (du * c[hi - 1]) - 1) * 100, bm, bt, sm, st, CT, CM, U


def zeros(n):
    return np.zeros(n)


class Layer:
    """Слой: функция X → (ts, tb, tk) массивы длины X.n; standalone=True — без mb1 (макро-план = 1)."""

    def __init__(self, fn, standalone=False, name="", capf=1.0, tomac=0):
        self.fn, self.standalone, self.name, self.capf, self.tomac = fn, standalone, name, capf, tomac
        self._c = {}

    def arrays(self, X):
        if X.k not in self._c:
            r = self.fn(X)
            if len(r) == 3:
                r = tuple(r) + (np.zeros(X.n),)
            self._c[X.k] = tuple(np.nan_to_num(np.asarray(a, np.float64)) for a in r)
        return self._c[X.k]


NULL = Layer(lambda X: (zeros(X.n), zeros(X.n), zeros(X.n)), name="mb1")


def run(X, base, L, seg, lag=0, rate=None, fee=0.001, mask=None):
    ts, tb, tk, tm = L.arrays(X)
    if mask is not None:
        ts, tb, tk, tm = (np.where(mask, 0.0, a) for a in (ts, tb, tk, tm))
    pm = np.ones(X.n) if L.standalone else base[X.k]
    r = X.rate0 if rate is None else rate
    a0, a1 = seg
    if a1 - a0 < 250:
        return (np.nan,) + (np.zeros(X.n),) * 7
    return sim2(X.c, pm, ts, tb, tk, tm, a0, a1, lag, r, fee, L.capf, L.tomac)


def segs(X):
    a, b, c = ix(X.t, A0), ix(X.t, B0), ix(X.t, CUT)
    return {"A": (a, b), "B": (b, c)}


def check(Lr, keys=DSEL, ref=None, rate=None, fee=0.001, starts=True, epis=True, after=True):
    """Протокол mcx (решение до 2025-12) против ref (по умолчанию mb1 = слой NULL): ячейки металл × A/B, сдвиг 1/2, без каждого эпизода,
    старты 2005–2020, (а) весь 2005–2025 по металлу; after — справочно до 2026-11."""
    D, DD, MM, base = load()
    ref = ref or NULL
    o = {"cells": {}, "lag1": [], "lag2": [], "ep": {}, "starts": [], "full": {}, "full26": {}}
    for k in keys:
        X = MM[k]
        rt = X.ratetb if rate == "tb" else X.rate0
        sg = segs(X)
        R = lambda L_, seg, lag=0, mask=None: run(X, base, L_, seg, lag, rt, fee, mask)[0]  # noqa: E731
        for h, seg in sg.items():
            if seg[1] - seg[0] < 250:
                continue
            o["cells"][(k, h)] = rel(R(Lr, seg), R(ref, seg))
            for lag, key in ((1, "lag1"), (2, "lag2")):
                o[key].append(rel(R(Lr, seg, lag), R(ref, seg, lag)))
            if epis:
                for nm, (a, b) in EPW.items():
                    w = (X.t >= a) & (X.t <= b)
                    o["ep"].setdefault(nm, []).append(rel(R(Lr, seg, 0, w), R(ref, seg)))
        a0 = sg["A"][0] if sg["A"][1] - sg["A"][0] >= 250 else sg["B"][0]
        o["full"][k] = rel(R(Lr, (a0, sg["B"][1])), R(ref, (a0, sg["B"][1])))
        if after:
            o["full26"][k] = rel(R(Lr, (a0, X.n)), R(ref, (a0, X.n)))
        if starts:
            for y in range(2005, 2021):
                s0 = ix(X.t, f"{y}-01-01")
                if sg["B"][1] - s0 > 250:
                    o["starts"].append(rel(R(Lr, (s0, sg["B"][1])), R(ref, (s0, sg["B"][1]))))
    v = np.array(list(o["cells"].values()))
    o["n"] = len(v)
    o["ok"] = int((v >= -0.5).sum())
    o["worst"] = float(v.min()) if len(v) else 0.0
    o["sum"] = lsum(v)
    o["A"] = lsum([o["cells"][(k, "A")] for k in keys if (k, "A") in o["cells"]])
    o["B"] = lsum([o["cells"][(k, "B")] for k in keys if (k, "B") in o["cells"]])
    o["l1"], o["l2"] = lsum(o["lag1"]), lsum(o["lag2"])
    o["fsum"] = lsum(list(o["full"].values()))
    o["fok"] = int(sum(1 for x in o["full"].values() if x >= -0.5))
    if epis:
        o["epsum"] = {nm: lsum(x) for nm, x in o["ep"].items()}
    if starts and o["starts"]:
        o["share"] = float((np.array(o["starts"]) >= -0.5).mean() * 100)
    if after:
        o["f26sum"] = lsum(list(o["full26"].values()))
    return o


def ok(o, min_sum=4.0):
    """Критерий mcx (записан до круга 2): ≥ 7/8 ячеек не хуже (−0,5), худшая ≥ −3, сумма ≥ +4, обе половины ≥ 0, сдвиг 1/2 ≥ 0,
    (б) без каждого эпизода сумма > 0 (знак сохраняется), старты ≥ 70%, (а) 2005–25 по металлу не хуже у большинства и сумма ≥ 0."""
    why = []
    need = int(np.ceil(o["n"] * 7 / 8))
    if o["ok"] < need:
        why.append(f"не хуже {o['ok']}/{o['n']}")
    if o["worst"] < -3:
        why.append(f"худшая {o['worst']:+.1f}")
    if o["sum"] < min_sum:
        why.append(f"сумма {o['sum']:+.1f}")
    if o["A"] < -0.05 or o["B"] < -0.05:
        why.append(f"половины {o['A']:+.1f}/{o['B']:+.1f}")
    if o["l1"] < 0 or o["l2"] < 0:
        why.append(f"сдвиг {o['l1']:+.1f}/{o['l2']:+.1f}")
    if "epsum" in o:
        bad = [f"{nm} {v:+.1f}" for nm, v in o["epsum"].items() if v <= 0]
        if bad:
            why.append("без эпизода: " + ", ".join(bad))
    if "share" in o and o["share"] < 70:
        why.append(f"старты {o['share']:.0f}%")
    if o["fok"] * 2 <= len(o["full"]) or o["fsum"] < 0:
        why.append(f"2005–25 не хуже {o['fok']}/{len(o['full'])}, сумма {o['fsum']:+.1f}")
    return not why, "; ".join(why)


def fmt(o, keys=DSEL):
    cells = " ".join(f"{NAME[k][:3]} " + "/".join(f"{o['cells'][(k, h)]:+.1f}" if (k, h) in o["cells"] else "—" for h in ("A", "B")) for k in keys)
    s = (f"сумма {o['sum']:+.1f} (A {o['A']:+.1f}, B {o['B']:+.1f}), не хуже {o['ok']}/{o['n']}, худш. {o['worst']:+.1f} | {cells} | "
         f"сдвиг {o['l1']:+.1f}/{o['l2']:+.1f}")
    if "epsum" in o:
        s += " | без эпиз. мин " + min((f"{v:+.1f} ({nm})" for nm, v in o["epsum"].items()), key=lambda z: float(z.split()[0]))
    if "share" in o:
        s += f" | старты {o['share']:.0f}%"
    s += f" | 2005–25 {o['fsum']:+.1f} ({o['fok']}/{len(o['full'])})"
    return s


def fafter(o, keys=DSEL):
    return "после решения 2005–2026.11: " + " ".join(f"{NAME[k][:3]} {o['full26'][k]:+.1f}" for k in keys if k in o["full26"]) + f" (сумма {o['f26sum']:+.1f})"


# ---------------- метрики «активность и точность» (одинаковые для крипты и металлов) ----------------
def _win(dates, W):
    d = np.asarray(dates, "datetime64[D]").astype(np.int64)
    lo = np.searchsorted(d, d - W // 2, "left")
    hi = np.searchsorted(d, d + W // 2, "right")
    return d, lo, hi


def _clusters(mask, d, gap=7):
    idx = np.where(mask)[0]
    if len(idx) == 0:
        return 0
    return int(1 + (np.diff(d[idx]) > gap).sum())


def activity(dates, c, buy, sell, a0, a1, Ws=(90, 180), sd=None, minamt=200.0):
    """dates, c — дни и закрытия; buy — покупки из резерва сверх взноса ($), sell — продажи ($); период [a0, a1).
    Дно/вершина «поймано», если в ±30 дн. по цене не дальше σ·√21 от экстремума куплено/продано ≥ minamt (по умолчанию 20 взносов).
    Возвращает словарь метрик (будущие цены — только для оценки)."""
    c = np.asarray(c, float)
    buy = np.where(np.arange(len(c)) < a0, 0, np.asarray(buy, float))
    buy[a1:] = 0
    sell = np.where(np.arange(len(c)) < a0, 0, np.asarray(sell, float))
    sell[a1:] = 0
    d = np.asarray(dates, "datetime64[D]").astype(np.int64)
    yrs = (d[a1 - 1] - d[a0]) / 365.25
    o = {"years": yrs}
    o["buy_days"] = float((buy >= 10).sum() / yrs)               # день/эпизод сделки — сумма ≥ 1 взноса (мелочь не считается)
    o["sell_days"] = float((sell >= 10).sum() / yrs)
    o["buy_eps"] = _clusters(buy >= 10, d) / yrs
    o["sell_eps"] = _clusters(sell >= 10, d) / yrs
    o["buy_money"] = float(buy.sum())
    o["sell_money"] = float(sell.sum())
    seg = c[a0:a1]
    hdca = len(seg) / (1.0 / seg).sum()
    if sd is None:
        lr = np.diff(np.log(seg))
        sd = float(np.std(lr))
    o["sd"] = sd
    bi, si = np.where(buy > 0)[0], np.where(sell > 0)[0]
    mb, ms = buy[bi], sell[si]
    if len(bi):
        o["buy_vs_dca"] = float((mb.sum() / (mb / c[bi]).sum()) / hdca - 1) * 100
    if len(si):
        o["sell_vs_dca"] = float((ms.sum() / (ms / c[si]).sum()) / hdca - 1) * 100
    for W in Ws:
        _, lo, hi = _win(dates, W)
        mn = np.array([c[lo[i]:hi[i]].min() for i in range(len(c))])
        mx = np.array([c[lo[i]:hi[i]].max() for i in range(len(c))])
        hm = np.array([(hi[i] - lo[i]) / (1.0 / c[lo[i]:hi[i]]).sum() for i in range(len(c))])
        rng = np.maximum(mx - mn, 1e-12)
        if len(bi):
            pos = (c[bi] - mn[bi]) / rng[bi]
            o[f"buy_pos{W}"] = float((mb * pos).sum() / mb.sum())
            o[f"buy_low20_{W}"] = float(mb[pos <= 0.2].sum() / mb.sum() * 100)
            for X in (0.05, 0.10):
                o[f"buy_near{int(X * 100)}_{W}"] = float(mb[c[bi] <= mn[bi] * (1 + X)].sum() / mb.sum() * 100)
            o[f"buy_loc{W}"] = float((mb * (c[bi] / hm[bi] - 1)).sum() / mb.sum() * 100)
        if len(si):
            pos = (mx[si] - c[si]) / rng[si]
            o[f"sell_pos{W}"] = float((ms * pos).sum() / ms.sum())
            o[f"sell_hi20_{W}"] = float(ms[pos <= 0.2].sum() / ms.sum() * 100)
            for X in (0.05, 0.10):
                o[f"sell_near{int(X * 100)}_{W}"] = float(ms[c[si] >= mx[si] * (1 - X)].sum() / ms.sum() * 100)
            o[f"sell_loc{W}"] = float((ms * (c[si] / hm[si] - 1)).sum() / ms.sum() * 100)
    # крупные доньи / вершины периода: экстремум окна ±90 дней и размах от экстремума прошлых 180 дн. ≥ 2σ·√63
    _, lo, hi = _win(dates, 180)
    thr = 2 * sd * np.sqrt(63)
    band = sd * np.sqrt(21)
    lows, highs = [], []
    for i in range(a0, a1):
        w = c[lo[i]:hi[i]]
        p0 = max(0, np.searchsorted(d, d[i] - 180))
        if c[i] == w.min() and np.log(c[p0:i + 1].max() / c[i]) >= thr:
            lows.append(i)
        if c[i] == w.max() and np.log(c[i] / c[p0:i + 1].min()) >= thr:
            highs.append(i)
    caught_l = caught_h = 0
    for i in lows:
        m = (np.abs(d - d[i]) <= 30) & (c <= c[i] * (1 + band))
        caught_l += bool(buy[m].sum() >= minamt)
    for i in highs:
        m = (np.abs(d - d[i]) <= 30) & (c >= c[i] * (1 - band))
        caught_h += bool(sell[m].sum() >= minamt)
    o["lows"], o["lows_caught"], o["highs"], o["highs_caught"] = len(lows), caught_l, len(highs), caught_h
    o["low_dates"] = [str(np.datetime64(int(d[i]), "D")) for i in lows]
    o["high_dates"] = [str(np.datetime64(int(d[i]), "D")) for i in highs]
    return o


ACOLS = [("buy_days", "дн. покупок/год", "{:.1f}"), ("buy_eps", "эпиз. покупок/год", "{:.1f}"), ("sell_days", "дн. продаж/год", "{:.1f}"),
         ("sell_eps", "эпиз. продаж/год", "{:.1f}"), ("buy_pos180", "покупки: место в диапазоне 180 дн. (0 = дно)", "{:.2f}"),
         ("buy_near10_180", "покупки ≤ +10% от мин. 180 дн., % денег", "{:.0f}"), ("buy_low20_180", "покупки в нижней 1/5 диапазона 180, %", "{:.0f}"),
         ("buy_near5_90", "≤ +5% от мин. 90 дн., %", "{:.0f}"), ("buy_loc180", "к местной DCA ±90 дн., %", "{:+.1f}"),
         ("buy_vs_dca", "к DCA периода, %", "{:+.1f}"), ("sell_pos180", "продажи: место от верха 180 (0 = верх)", "{:.2f}"),
         ("sell_near10_180", "продажи ≥ −10% от макс. 180, %", "{:.0f}"), ("sell_hi20_180", "продажи в верхней 1/5, %", "{:.0f}"),
         ("sell_loc180", "продажи к местной DCA, %", "{:+.1f}"), ("sell_vs_dca", "продажи к DCA периода, %", "{:+.1f}")]


def afmt(o):
    parts = []
    for key, nm, f in ACOLS:
        if key in o:
            parts.append(f"{nm} {f.format(o[key])}")
    parts.append(f"доньев пойм. {o['lows_caught']}/{o['lows']}, вершин {o['highs_caught']}/{o['highs']}")
    return "; ".join(parts)


def layer_activity(L, k, a0d=A0, a1d=CUT, lag=0):
    """Метрики активности и точности металла k для слоя L поверх mb1 (покупки = макро + слой, продажи = макро + слой)."""
    D, DD, MM, base = load()
    X = MM[k]
    a0, a1 = ix(X.t, a0d), ix(X.t, a1d)
    r = run(X, base, L, (a0, a1), lag)
    o = activity(X.t, X.c, r[1] + r[2], r[3] + r[4], a0, a1)
    o["edge"] = r[0]
    return o, r


# ---------------- отчёт по варианту ----------------
def prec_agg(L, keys=DSEL, a0d=A0, a1d=CUT):
    """Агрегат точности по металлам (2005–2025): пойманные доньи/вершины (сумма), место покупок/продаж в диапазоне 180 (среднее по металлам
    с покупками), к местной DCA, эпизодов сделок в год (среднее)."""
    out = {"lows": 0, "lows_caught": 0, "highs": 0, "highs_caught": 0}
    acc = {k_: [] for k_ in ("buy_pos180", "sell_pos180", "buy_loc180", "sell_loc180", "buy_eps", "sell_eps", "buy_low20_180", "sell_hi20_180")}
    per = {}
    for k in keys:
        o, _ = layer_activity(L, k, a0d, a1d)
        per[k] = o
        for z in ("lows", "lows_caught", "highs", "highs_caught"):
            out[z] += o[z]
        for z in acc:
            if z in o:
                acc[z].append(o[z])
    for z, v in acc.items():
        out[z] = float(np.mean(v)) if v else np.nan
    out["per"] = per
    return out


def pfmt(p):
    return (f"эпиз./год пок. {p['buy_eps']:.1f} прод. {p['sell_eps']:.1f}; доньев {p['lows_caught']}/{p['lows']}, вершин {p['highs_caught']}/{p['highs']}; "
            f"место пок. {p['buy_pos180']:.2f} (низ 1/5 {p['buy_low20_180']:.0f}%), прод. {p['sell_pos180']:.2f}; к мест. DCA пок. {p['buy_loc180']:+.1f}, прод. {p['sell_loc180']:+.1f}")


_P0 = {}


def prec_ok(p, keys=DSEL):
    """(г): пойманных доньев + вершин больше, чем у mb1; место покупок не хуже mb1 более чем на 0,05; покупки к местной DCA не хуже mb1 (+0,5)."""
    key = tuple(keys)
    if key not in _P0:
        _P0[key] = prec_agg(NULL, keys)
    b = _P0[key]
    why = []
    if p["lows_caught"] + p["highs_caught"] <= b["lows_caught"] + b["highs_caught"]:
        why.append(f"поймано {p['lows_caught'] + p['highs_caught']} ≤ {b['lows_caught'] + b['highs_caught']}")
    if p["buy_pos180"] > b["buy_pos180"] + 0.05:
        why.append(f"место покупок {p['buy_pos180']:.2f} > {b['buy_pos180']:.2f}+0,05")
    if p["buy_loc180"] > b["buy_loc180"] + 0.5:
        why.append(f"к местной DCA {p['buy_loc180']:+.1f} > {b['buy_loc180']:+.1f}")
    return not why, "; ".join(why)


def report(name, L, keys=DSEL, prec=True, quiet=False):
    o = check(L, keys)
    good, why = ok(o)
    line = f"{name}: {fmt(o, keys)} → {'✓' if good else '✗ ' + why}"
    if prec:
        p = prec_agg(L, keys)
        g2, w2 = prec_ok(p, keys)
        line += f"\n    точность: {pfmt(p)} → (г) {'✓' if g2 else '✗ ' + w2}"
        o["prec"] = p
        o["prec_ok"] = g2
        good = good and g2
    o["good"] = good
    if not quiet:
        print(line)
    return o


def check_runner(runner, keys=DSEL, starts=True, epis=True, after=True, fee=0.001, rate=None):
    """То же, что check, но для произвольного счёта: runner(X, seg, lag, mask, fee, rate) → итог к DCA % (mask — окно, где правило выключено)."""
    D, DD, MM, base = load()
    ref = lambda X, seg, lag=0, rt=None: run(X, base, NULL, seg, lag, rt, fee)[0]  # noqa: E731
    o = {"cells": {}, "lag1": [], "lag2": [], "ep": {}, "starts": [], "full": {}, "full26": {}}
    for k in keys:
        X = MM[k]
        rt = X.ratetb if rate == "tb" else X.rate0
        sg = segs(X)
        R = lambda seg, lag=0, mask=None: runner(X, seg, lag, mask, fee, rt)  # noqa: E731
        for h, seg in sg.items():
            if seg[1] - seg[0] < 250:
                continue
            o["cells"][(k, h)] = rel(R(seg), ref(X, seg, 0, rt))
            for lag, key in ((1, "lag1"), (2, "lag2")):
                o[key].append(rel(R(seg, lag), ref(X, seg, lag, rt)))
            if epis:
                for nm, (a, b) in EPW.items():
                    w = (X.t >= a) & (X.t <= b)
                    o["ep"].setdefault(nm, []).append(rel(R(seg, 0, w), ref(X, seg, 0, rt)))
        a0 = sg["A"][0] if sg["A"][1] - sg["A"][0] >= 250 else sg["B"][0]
        o["full"][k] = rel(R((a0, sg["B"][1])), ref(X, (a0, sg["B"][1]), 0, rt))
        if after:
            o["full26"][k] = rel(R((a0, X.n)), ref(X, (a0, X.n), 0, rt))
        if starts:
            for y in range(2005, 2021):
                s0 = ix(X.t, f"{y}-01-01")
                if sg["B"][1] - s0 > 250:
                    o["starts"].append(rel(R((s0, sg["B"][1])), ref(X, (s0, sg["B"][1]), 0, rt)))
    v = np.array(list(o["cells"].values()))
    o["n"] = len(v)
    o["ok"] = int((v >= -0.5).sum())
    o["worst"] = float(v.min()) if len(v) else 0.0
    o["sum"] = lsum(v)
    o["A"] = lsum([o["cells"][(k, "A")] for k in keys if (k, "A") in o["cells"]])
    o["B"] = lsum([o["cells"][(k, "B")] for k in keys if (k, "B") in o["cells"]])
    o["l1"], o["l2"] = lsum(o["lag1"]), lsum(o["lag2"])
    o["fsum"] = lsum(list(o["full"].values()))
    o["fok"] = int(sum(1 for x in o["full"].values() if x >= -0.5))
    if epis:
        o["epsum"] = {nm: lsum(x) for nm, x in o["ep"].items()}
    if starts and o["starts"]:
        o["share"] = float((np.array(o["starts"]) >= -0.5).mean() * 100)
    if after:
        o["f26sum"] = lsum(list(o["full26"].values()))
    return o
