"""Стенд mbx: фильтрация ПОКУПОК металлов поверх mb1 (Q2д + пауза докупок 90 дней после стресса BTC). Протокол — research/mbx_journal.md.

Поверх mb_lib.py / mt4_lib.py / metals_agent*_lib.py без их изменения. Главное отличие от стенда mb:
- основа сравнения — mb1 (дневная) и её месячный аналог (Q2 + отложенная докупка после стресса BTC);
- решение принимается по данным ДО 2025-12 включительно (CUT): половины A = 2005-01…2015-12, B = 2016-01…2025-12 (старт с нуля);
  2026 (обвал после пузыря) смотрится отдельно и только после решения;
- «без эпизода»: правило выключается (план = план mb1) в окне каждого из доньев 2008, 2015–16, 2018, 2020, 2022 (и 2026 — после решения);
- новые правила задаются как преобразование месячного плана Q2 (fn: d → план), дневной план = Q2д-отображение + пауза BTC, как у mb1.
"""
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mb_lib as B  # noqa: E402
import mt4_lib as M  # noqa: E402
import metals_agent_lib as L  # noqa: E402
import metals_agent2_lib as A  # noqa: E402
from mb_r8 import btc_wait  # noqa: E402

NAME = M.NAME
DSEL, DEXAM = M.DSEL, M.DEXAM
MSEL = A.SEL
LOGDIR = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/mbx"
Q2M = M.VERS["Q2"]
rel = M.rel
A0, B0, CUT = "2005-01-01", "2016-01-01", "2026-01-01"
# окна «без эпизода» — спуск и дно (поправка после круга 2: правила остывания и малых серий действуют на спуске, узкие окна дна их не ловили)
EPX = {"2008": ("2008-03-01", "2009-06-30"), "2015–16": ("2011-04-01", "2016-06-30"), "2018": ("2016-08-01", "2019-03-31"),
       "2020": ("2020-01-01", "2020-06-30"), "2022": ("2022-03-01", "2022-12-31")}
EP26 = {"2026": ("2026-01-01", "2026-12-31")}


def tee(path):
    os.makedirs(LOGDIR, exist_ok=True)
    M.LOGDIR = LOGDIR
    return M.tee(path)


def load():
    D, DD, MM = B.load()
    return D, DD, MM


def ix(t, s):
    return int(np.searchsorted(np.asarray(t, "datetime64[ns]"), np.datetime64(s)))


def lsum(v):
    v = np.nan_to_num(np.asarray(v, float))
    return float(np.log1p(v / 100).sum() * 100)


# ---------------- ценовые признаки конкретного металла (по месячным средним, только прошлое) ----------------
def rolling_max(c, n):
    return pd.Series(c).rolling(n, min_periods=1).max().values


def rolling_mean(c, n):
    return pd.Series(c).rolling(n, min_periods=max(6, n // 2)).mean().values


def rsi(c, n=14):
    s = pd.Series(c)
    d = s.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    r = 100 - 100 / (1 + up / dn.replace(0, np.nan))
    return r.fillna(50).values


def pfeat(d):
    """Ценовые признаки металла по месяцам: dd36 (к максимуму 36 мес.), ddath (к историческому максимуму ряда), ma48 (к средней 48 мес.),
    rsi (месячный RSI 14), retr (доля отката подъёма: от «основания» — минимума 60 мес. до максимума 36 мес.), base (цена к основанию)."""
    if "_pf" in d:
        return d["_pf"]
    c = np.asarray(d["c"], float)
    n = len(c)
    mx36 = rolling_max(c, 36)
    out = {"dd36": c / mx36 - 1, "ddath": c / np.maximum.accumulate(c) - 1, "ma48": c / rolling_mean(c, 48), "rsi": rsi(c)}
    base = np.full(n, np.nan)
    for i in range(n):
        j = max(0, i - 35) + int(np.argmax(c[max(0, i - 35): i + 1]))     # месяц максимума 36 мес.
        base[i] = c[max(0, j - 60): j + 1].min()
    out["retr"] = (mx36 - c) / np.maximum(mx36 - base, 1e-9)
    out["base"] = c / base
    d["_pf"] = out
    return out


def mcond(d, name, thr):
    """Ценовой маркер дна металла (месяц) по имени и порогу."""
    f = pfeat(d)
    if name == "dd36":
        return f["dd36"] <= -thr
    if name == "ddath":
        return f["ddath"] <= -thr
    if name == "ma48":
        return f["ma48"] <= thr
    if name == "rsi":
        return f["rsi"] <= thr
    if name == "retr":
        return f["retr"] >= thr
    if name == "base":
        return f["base"] <= thr
    raise KeyError(name)


# ---------------- конструкторы месячных планов ----------------
def sale_info(p, c, v=0.2):
    """Для каждого месяца: месяцев с последней продажи ≥ v и средняя цена продаж «пачки» (продажи с разрывом ≤ 6 мес.)."""
    n = len(p)
    since = np.full(n, 10 ** 6)
    sp = np.full(n, np.nan)
    last = -10 ** 6
    acc = []
    for i in range(n):
        if p[i] <= -v + 1e-9:
            if i - last > 6:
                acc = []
            acc.append(c[i])
            last = i
        since[i] = i - last
        sp[i] = float(np.mean(acc)) if acc else np.nan
    return since, sp


# ---------------- дневная модель ----------------
class Bench:
    """Обёртка: месячный план fn → дневной план mb1-типа (Q2д-отображение + пауза BTC 25%/90 дн.) с кэшем."""

    def __init__(self, D, DD, MM):
        self.D, self.DD, self.MM = D, DD, MM
        self._c = {}

    def dplan(self, fn, X, btc=True):
        key = (id(fn), X.k, btc)
        if key not in self._c:
            base = lambda XX: B.q2d(self.D, XX, fn)  # noqa: E731
            self._c[key] = (btc_wait(self.DD, base, 0.25, 90)(X)[0] if btc else base(X), fn)
        return self._c[key][0]

    def ref(self, X):
        return self.dplan(Q2M, X)


def dsegs3(X):
    a, b, c = ix(X.t, A0), ix(X.t, B0), ix(X.t, CUT)
    return {"A": (a, b), "B": (b, c)}


def dcheck3(Bn, fn, keys=DSEL, ref_fn=None, rate=None, fee=0.001, starts=True, epis=True, after=True):
    """Дневной протокол mbx (решение до 2025-12): ячейки металл × A/B, сдвиг 1 и 2 дня, без каждого эпизода, старты 2005–2020 (до CUT),
    весь 2005–2025 по металлу; after=True — справочно до конца данных (2026-11) и без/с 2026."""
    MM = Bn.MM
    ref_fn = ref_fn or Q2M
    o = {"cells": {}, "lag1": [], "lag2": [], "ep": {}, "starts": [], "full": {}, "full26": {}, "b26": {}}
    for k in keys:
        X = MM[k]
        p, p0 = Bn.dplan(fn, X), Bn.dplan(ref_fn, X)
        rt = X.ratetb if rate == "tb" else X.rate0
        sg = dsegs3(X)
        run = lambda pl, seg, lag=0: X.run(pl, seg, lag, rate=rt, fee=fee)[0]  # noqa: E731
        for h, seg in sg.items():
            if seg[1] - seg[0] < 250:
                continue
            o["cells"][(k, h)] = rel(run(p, seg), run(p0, seg))
            for lag, key in ((1, "lag1"), (2, "lag2")):
                o[key].append(rel(run(p, seg, lag), run(p0, seg, lag)))
            if epis:
                for nm, (a, b) in EPX.items():
                    w = (X.t >= a) & (X.t <= b)
                    pe = np.where(w, p0, p)
                    o["ep"].setdefault(nm, []).append(rel(run(pe, seg), run(p0, seg)))
        a0 = sg["A"][0] if sg["A"][1] - sg["A"][0] >= 250 else sg["B"][0]
        o["full"][k] = rel(run(p, (a0, sg["B"][1])), run(p0, (a0, sg["B"][1])))
        if after:
            o["full26"][k] = rel(run(p, (a0, X.n)), run(p0, (a0, X.n)))
            o["b26"][k] = rel(run(p, (sg["B"][0], X.n)), run(p0, (sg["B"][0], X.n)))
        if starts:
            for y in range(2005, 2021):
                s0 = ix(X.t, f"{y}-01-01")
                if sg["B"][1] - s0 > 250 and s0 >= 0:
                    o["starts"].append(rel(run(p, (s0, sg["B"][1])), run(p0, (s0, sg["B"][1]))))
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
        s = np.array(o["starts"])
        o["share"] = float((s >= -0.5).mean() * 100)
    if after:
        o["f26sum"] = lsum(list(o["full26"].values()))
    return o


def dok3(o, min_sum=4.0):
    """Критерий mbx (дневной, до 2025-12): ≥ 7/8 ячеек не хуже, худшая ≥ −3, сумма ≥ +4, обе половины ≥ 0, сдвиг 1/2 дня ≥ 0,
    без каждого эпизода сумма ≥ max(+2, 30% полной), старты ≥ 70%, весь 2005–25: не хуже у большинства металлов и сумма ≥ 0."""
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
        lim = max(2.0, 0.3 * o["sum"])
        bad = [f"{nm} {v:+.1f}" for nm, v in o["epsum"].items() if v < lim]
        if bad:
            why.append("без эпизода: " + ", ".join(bad))
    if "share" in o and o["share"] < 70:
        why.append(f"старты {o['share']:.0f}%")
    if o["fok"] * 2 <= len(o["full"]) or o["fsum"] < 0:
        why.append(f"2005–25 не хуже {o['fok']}/{len(o['full'])}, сумма {o['fsum']:+.1f}")
    return not why, "; ".join(why)


def dfmt3(o, keys=DSEL):
    cells = " ".join(f"{NAME[k][:3]} " + "/".join(f"{o['cells'][(k, h)]:+.1f}" if (k, h) in o["cells"] else "—" for h in ("A", "B")) for k in keys)
    s = (f"сумма {o['sum']:+.1f} (A {o['A']:+.1f}, B {o['B']:+.1f}), не хуже {o['ok']}/{o['n']}, худшая {o['worst']:+.1f} | {cells} | "
         f"сдвиг {o['l1']:+.1f}/{o['l2']:+.1f}")
    if "epsum" in o:
        s += " | без эпиз.: " + " ".join(f"{nm} {v:+.1f}" for nm, v in o["epsum"].items())
    if "share" in o:
        s += f" | старты {o['share']:.0f}%"
    s += f" | 2005–25 по мет. {o['fsum']:+.1f} ({o['fok']}/{len(o['full'])})"
    return s


def dafter(o, keys=DSEL):
    """Справочно после решения: 2005–2026-11 и 2016–2026-11 по металлам."""
    return ("2005–26.11: " + " ".join(f"{NAME[k][:3]} {o['full26'][k]:+.1f}" for k in keys if k in o["full26"]) + f" (сумма {o['f26sum']:+.1f}); "
            "2016–26.11: " + " ".join(f"{NAME[k][:3]} {o['b26'][k]:+.1f}" for k in keys if k in o["b26"]))


# ---------------- месячная модель ----------------
def btc_month_window(DD):
    btc = DD["x"]["btc"]
    r30 = btc / btc.shift(1, freq="30D").reindex(btc.index, method="ffill") - 1
    ev = (r30 <= -0.25).resample("ME").max().fillna(False)
    return ev.rolling(3, min_periods=1).max().astype(bool)


def mwrap(fn, DD):
    """Месячный аналог паузы BTC (как mb_r9.mb1_monthly) поверх плана fn."""
    win = btc_month_window(DD)

    def f(d):
        p = np.asarray(fn(d), np.float64).copy()
        w = win.reindex(pd.DatetimeIndex(d["t"])).fillna(False).values.astype(bool)
        ser = p > 1.0
        g = np.where(ser, p - 1.0, 0.0)
        res = p.copy()
        cr = 1.0
        for i in range(len(p)):
            if not ser[i]:
                cr = 1.0
                continue
            if w[i]:
                cr *= (1 - g[i])
                res[i] = 1.0
            else:
                res[i] = 1.0 + (1 - cr * (1 - g[i]))
                cr = 1.0
        return res
    f.__name__ = "mw_" + getattr(fn, "__name__", "fn")
    return f


def msegs3(d):
    t = d["t"]
    return {"A": (ix(t, A0), ix(t, B0)), "B": (ix(t, B0), ix(t, CUT)), "82": (d["h82"], d["m"]), "65": (ix(t, "1965-01-01"), d["h82"]),
            "all": (0, ix(t, CUT)), "05": (ix(t, A0), ix(t, CUT)), "26": (ix(t, A0), len(d["c"]))}


def mrun(d, p, seg, lag=0):
    a0, a1 = seg
    if a1 - a0 < 24:
        return np.nan
    return L.sim(d["c"], np.asarray(p, np.float64), a0, a1, lag, np.zeros(len(d["c"])))[0]


def mcheck3(D, fn, ref, keys=MSEL, epis=True):
    """Месячный протокол mbx: 16 ячеек A/B (до 2025-12), сдвиг на месяц, без эпизода, вторичная 1982–98 / 1965–81,
    вся история ряда (до 2025-12) и 2005–2026-10 (справочно)."""
    o = {"cells": {}, "lag1": [], "sec82": {}, "sec65": {}, "all": {}, "y05": {}, "y26": {}, "ep": {}}
    for k in keys:
        d = D[k]
        p, p0 = np.asarray(fn(d), np.float64), np.asarray(ref(d), np.float64)
        sg = msegs3(d)
        for h in ("A", "B"):
            o["cells"][(k, h)] = rel(mrun(d, p, sg[h]), mrun(d, p0, sg[h]))
            o["lag1"].append(rel(mrun(d, p, sg[h], 1), mrun(d, p0, sg[h], 1)))
            if epis:
                for nm, (a, b) in EPX.items():
                    w = (d["t"] >= a) & (d["t"] <= b)
                    pe = np.where(w, p0, p)
                    o["ep"].setdefault(nm, []).append(rel(mrun(d, pe, sg[h]), mrun(d, p0, sg[h])))
        for key, h in (("sec82", "82"), ("sec65", "65"), ("all", "all"), ("y05", "05"), ("y26", "26")):
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
    if epis:
        o["epsum"] = {nm: lsum(x) for nm, x in o["ep"].items()}
    for key in ("sec82", "sec65", "all", "y05", "y26"):
        vv = np.array(list(o[key].values()))
        o[key + "_sum"] = lsum(vv) if len(vv) else 0.0
        o[key + "_worst"] = float(vv.min()) if len(vv) else 0.0
        o[key + "_ok"] = int((vv >= -0.5).sum())
    return o


def mok3(o):
    """Месячный критерий mbx (подтверждение): ≥ 12/16 не хуже, худшая ≥ −5, сумма ≥ 0, сдвиг ≥ 0;
    вторичная 1982–98 / 1965–81 — не катастрофа (сумма ≥ −30)."""
    why = []
    if o["ok"] < int(np.ceil(o["n"] * 12 / 16)):
        why.append(f"не хуже {o['ok']}/{o['n']}")
    if o["worst"] < -5:
        why.append(f"худшая {o['worst']:+.1f}")
    if o["sum"] < 0:
        why.append(f"сумма {o['sum']:+.1f}")
    if o["l1"] < 0:
        why.append(f"сдвиг {o['l1']:+.1f}")
    if o["sec82_sum"] < -30 or o["sec65_sum"] < -30:
        why.append(f"втор. {o['sec82_sum']:+.1f}/{o['sec65_sum']:+.1f}")
    return not why, "; ".join(why)


def mfmt3(o, keys=MSEL):
    cells = " ".join(f"{NAME[k][:3]} {o['cells'][(k, 'A')]:+.1f}/{o['cells'][(k, 'B')]:+.1f}" for k in keys)
    s = (f"сумма {o['sum']:+.1f} (A {o['A']:+.1f}, B {o['B']:+.1f}), не хуже {o['ok']}/{o['n']}, худшая {o['worst']:+.1f}, сдвиг {o['l1']:+.1f} | {cells}"
         f" || втор. 1982–98 {o['sec82_sum']:+.1f} (худш. {o['sec82_worst']:+.1f}), 1965–81 {o['sec65_sum']:+.1f} (худш. {o['sec65_worst']:+.1f})"
         f" | вся история до 2025 {o['all_sum']:+.1f} ({o['all_ok']}/{len(o['all'])})")
    if "epsum" in o:
        s += " | без эпиз.: " + " ".join(f"{nm} {v:+.1f}" for nm, v in o["epsum"].items())
    return s


def keep(p0, p, allow_cool=True):
    """Применить правило покупки только там, где план основы — взнос (1) или накопление (0, остывание); продажи и серии не трогаем."""
    m = (p0 == 1.0) | ((p0 == 0.0) if allow_cool else False)
    return np.where(m, p, p0)


# ---------------- позиционирование CFTC (Commitments of Traders, legacy futures only, с 1986) ----------------
COT_CODE = {"gold": "088691", "silver": "084691", "platinum": "076651", "palladium": "075651", "copper": "085692"}
COT_DIR = os.path.join(LOGDIR, "cot")
COT_URL = ("https://publicreporting.cftc.gov/resource/6dca-aqww.json?$limit=50000&$select=report_date_as_yyyy_mm_dd,market_and_exchange_names,"
           "open_interest_all,noncomm_positions_long_all,noncomm_positions_short_all,comm_positions_long_all,comm_positions_short_all"
           "&$where=cftc_contract_market_code='{code}'&$order=report_date_as_yyyy_mm_dd")


def cot_weekly(k):
    """Недельный ряд: net = (некоммерческие длинные − короткие) / открытый интерес; источник — открытые данные CFTC (publicreporting.cftc.gov)."""
    import json
    path = os.path.join(COT_DIR, f"legacy_{COT_CODE[k]}.json")
    if not os.path.exists(path):
        import urllib.request
        os.makedirs(COT_DIR, exist_ok=True)
        with urllib.request.urlopen(COT_URL.format(code=COT_CODE[k]).replace("$", "%24").replace("'", "%27"), timeout=120) as r:
            open(path, "wb").write(r.read())
    raw = json.load(open(path))
    t = pd.to_datetime([r["report_date_as_yyyy_mm_dd"][:10] for r in raw])
    f = lambda key: np.array([float(r.get(key, "nan")) for r in raw])  # noqa: E731
    oi = f("open_interest_all")
    s = pd.DataFrame({"net": (f("noncomm_positions_long_all") - f("noncomm_positions_short_all")) / oi,
                      "comm": (f("comm_positions_long_all") - f("comm_positions_short_all")) / oi}, index=t)
    return s[~s.index.duplicated(keep="last")].sort_index()


def cot_monthly(d, k, W=156):
    """Признаки COT по месяцам d['t'] (последний отчёт месяца, известен до конца месяца): net, idx (положение net в диапазоне
    последних W недель, 0 — минимум), pct (доля недель за 5 лет с net ниже текущего). NaN, где данных нет."""
    key = f"_cot{W}"
    if key in d:
        return d[key]
    w = cot_weekly(k)
    net = w["net"]
    lo = net.rolling(W, min_periods=W // 2).min()
    hi = net.rolling(W, min_periods=W // 2).max()
    idx = (net - lo) / (hi - lo)
    pct = net.rolling(260, min_periods=104).apply(lambda x: (x[:-1] < x[-1]).mean(), raw=True)
    m = pd.DataFrame({"net": net, "idx": idx, "pct": pct}).resample("ME").last()
    out = {c: m[c].reindex(pd.DatetimeIndex(d["t"])).values for c in m.columns}
    d[key] = out
    return out


# ---------------- акции добытчиков (Yahoo: ^XAU с 1983, GDX с 2006, SIL с 2010, COPX с 2010) ----------------
MKT_DIR = os.path.join(LOGDIR, "mkt")


def mkt_daily(sym):
    import json
    path = os.path.join(MKT_DIR, sym.replace("^", "_") + ".json")
    if not os.path.exists(path):
        import data
        os.makedirs(MKT_DIR, exist_ok=True)
        r = data._get("https://query1.finance.yahoo.com/v8/finance/chart/" + sym.replace("^", "%5E") + "?period1=0&period2=9999999999&interval=1d")["chart"]["result"][0]
        json.dump({"t": r["timestamp"], "c": r["indicators"]["quote"][0]["close"]}, open(path, "w"))
    raw = json.load(open(path))
    s = pd.Series(raw["c"], index=pd.to_datetime(raw["t"], unit="s").normalize(), dtype=float).dropna()
    return s[(s > 0) & ~s.index.duplicated(keep="last")]


def miners_monthly(d, sym, W=36):
    """Признаки добытчиков по месяцам d['t']: rel — средняя месяца индекса добытчиков к средней цене металла, ridx — положение rel в диапазоне W мес.
    (0 — минимум), rdd — rel к максимуму W мес. − 1, mdd — сам индекс к максимуму W мес. − 1."""
    key = f"_mn_{sym}_{W}"
    if key in d:
        return d[key]
    m = mkt_daily(sym).resample("ME").mean().reindex(pd.DatetimeIndex(d["t"])).values
    c = np.asarray(d["c"], float)
    rel_ = m / c
    s = pd.Series(rel_)
    lo, hi = s.rolling(W, min_periods=W // 2).min(), s.rolling(W, min_periods=W // 2).max()
    ms = pd.Series(m)
    out = {"rel": rel_, "ridx": ((s - lo) / (hi - lo)).values, "rdd": (s / hi - 1).values,
           "mdd": (ms / ms.rolling(W, min_periods=W // 2).max() - 1).values}
    d[key] = out
    return out
