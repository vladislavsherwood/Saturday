"""Стенд второго агента по металлам (20 кругов улучшения R3). Расширяет metals_agent_lib.py, не меняя его.

Что добавлено к стенду первого агента:
- данные заморожены в cache/metals_agent2_data.pkl (тот же набор, что у metals_agent_lib.load + признаки связей круга 7),
  чтобы за 20 кругов цифры не «поплыли» от обновления рядов;
- R3 (found/metals.json) собран в одну функцию r3() с параметрами — от неё отталкиваются все круги;
- честный протокол отбора: решение — только по 8 металлам ДО 1999 года (и отдельно по половинам 1965–1981 / 1982–1998,
  и с исполнением на месяц позже), критерий записан заранее (select_ok); период после 1999 печатается ТОЛЬКО для
  отобранного кандидата и служит вето (veto_ok); экзамен (палладий, олово) — только в сводках каждые 5 кругов и в конце;
- метрики близости к дну/вершине — как в metals_agent_lib.proximity, плюс те же метрики только на периоде до 1999.
"""
import os
import pickle
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import data  # noqa: E402
import metals_agent_lib as L  # noqa: E402
import metals_long as ml  # noqa: E402
from metals_monthly import BOT, TOP  # noqa: E402

PKL2 = os.path.join(data.CACHE, "metals_agent2_data.pkl")
NAME, SEL, EXAM = L.NAME, L.SEL, L.EXAM
F10, GO, II = "Цена к средней за 10 лет", "Золото к нефти: соотношение к средней за 10 лет", "Пром. индекс к средней за 3 года"
P3, Y1 = L.P3, L.Y1
IND = ["copper", "aluminum", "nickel", "lead", "zinc"]
PREC = ["gold", "silver", "platinum"]
GROUP = {**{k: "prec" for k in PREC + ["palladium"]}, **{k: "ind" for k in IND + ["tin"]}}
H2 = "1982-01-01"                       # граница половин периода подбора
# параметры R3 (found/metals.json, круг 10 первого агента)
DEF = {"g": 0.5, "s5": 0.15, "s6": 0.5, "hot3": 1.81, "hot1": 86.0, "sh": 0.2, "lead": 0.2, "k_on": 3}


def load(fresh=False):
    """Замороженные данные: {металл: d}, d — как в metals_agent_lib.load + key, top/bot, tn/bn (счётчики R3), h82, cu_past."""
    if not fresh and os.path.exists(PKL2):
        return pickle.load(open(PKL2, "rb"))
    from metals_agent_loop7 import prep
    D = L.load()
    thr = prep(D)
    thr[(II, "lo")] = L.pooled(D, II, 0.25)          # R3: порог индекса у дна — центр плато q25
    D["_thr3"] = thr
    for k in L.metals(D):
        d = D[k]
        top, bot = sets(k)
        d["top"], d["bot"] = top, bot
        d["tn3"], d["bn3"] = L.count(d, thr, top), L.count(d, thr, bot)
        d["nt"], d["nb"] = len(top), len(bot)
        d["h82"] = int(np.searchsorted(d["t"].values, np.datetime64(H2)))
        c = d["c"]
        n = len(c)
        d["mn24"] = np.array([c[max(0, i - 24): i + 25].min() for i in range(n)])
        d["mx24"] = np.array([c[max(0, i - 24): i + 25].max() for i in range(n)])
        d["pv"] = ml.pivots(c, d["factor"])
    pickle.dump(D, open(PKL2, "wb"))
    return D


def sets(k):
    """Наборы маркеров R3: 7 общих + групповой маркер вершины; 7 общих + промышленный индекс у дна."""
    top, bot = list(TOP), list(BOT) + [(II, "lo")]
    if GROUP[k] == "ind":
        top.append((F10, "hi"))
    elif k in ("gold", "silver"):
        top.append((GO, "hi"))
    return top, bot


def metals(D):
    return L.metals(D)


def feat(d, f):
    return d["F"][f].values


def r3(d, **kw):
    """План R3 по месяцам (1 — взнос, 1+g — взнос и доля резерва, −f — продать долю)."""
    P = {**DEF, **kw}
    tn, bn, nt, nb = d["tn3"], d["bn3"], d["nt"], d["nb"]
    p = np.select([tn >= nt - 1, tn >= nt - 2], [-P["s6"], -P["s5"]], default=1.0)
    hot = (np.nan_to_num(feat(d, P3)) > P["hot3"]) & (np.nan_to_num(feat(d, Y1)) > P["hot1"])
    p = np.where(hot, np.minimum(p, -P["sh"]), p)
    ep = L.episode(bn, nb - P["k_on"], nb - P["k_on"] - 1)
    p = np.where(ep, 1 + P["g"], p)
    p = np.where(d["cu_past"] & (tn >= nt - 3) & (p == 1.0), -P["lead"], p)
    return p.astype(np.float64)


def episode_r3(d, k_on=3):
    return L.episode(d["bn3"], d["nb"] - k_on, d["nb"] - k_on - 1)


# ---------- расчёт и сравнение ----------
PER = ("before", "h1", "h2", "after", "full")


def edges(d, plan, lag=0, ntr=0, rate=None):
    c, m, n, h = d["c"], d["m"], len(d["c"]), d["h82"]
    rate = np.zeros(n) if rate is None else rate
    plan = np.asarray(plan, np.float64)
    o = {}
    ok = m > 24
    o["before"] = L.sim(c, plan, 0, m, lag, rate, ntr)[0] if ok else np.nan
    o["h1"] = L.sim(c, plan, 0, h, lag, rate, ntr)[0] if ok else np.nan
    o["h2"] = L.sim(c, plan, h, m, lag, rate, ntr)[0] if ok else np.nan
    o["after"] = L.sim(c, plan, m, n, lag, rate, ntr)[0]
    e, bx, sx = L.sim(c, plan, 0, n, lag, rate, ntr)
    o["full"], o["bx"], o["sx"] = e, bx, sx
    return o


def prox(d, bx, sx, a=0, b=None):
    """Метрики близости к дну и вершине (как metals_agent_lib.proximity) на отрезке [a, b)."""
    c = d["c"]
    n = len(c)
    b = n if b is None else b
    bx = bx.copy(); sx = sx.copy()
    bx[:a] = 0; bx[b:] = 0; sx[:a] = 0; sx[b:] = 0
    mn, mx = d["mn24"], d["mx24"]
    r = {}
    tb, ts = bx.sum(), sx.sum()
    r["above"] = float((bx * (c / mn - 1)).sum() / tb * 100) if tb > 0 else np.nan
    r["zone"] = float(bx[c <= mn * 1.15].sum() / tb * 100) if tb > 0 else np.nan
    r["sell_top"] = float((sx * c / mx).sum() / ts * 100) if ts > 0 else np.nan
    bots = [i for i, s in d["pv"] if s < 0 and a <= i < b]
    tops = [i for i, s in d["pv"] if s > 0 and a <= i < b]
    b1 = b2 = 0
    for i in bots:
        j = np.arange(max(0, i - 12), min(n, i + 13))
        kk = ((bx[j] > 0) & (c[j] <= c[i] * 1.25)).sum()
        b1 += kk >= 1
        b2 += kk >= 2
    miss = 0
    missed = []
    for i in tops:
        j = np.arange(max(0, i - 12), min(n, i + 13))
        if not ((sx[j] > 0) & (c[j] >= c[i] * 0.75)).any():
            miss += 1
            missed.append(i)
    r.update({"bots": len(bots), "b1": b1, "b2": b2, "tops": len(tops), "miss": miss, "missed": missed,
              "buy_months": int((bx > 0).sum()), "sell_months": int((sx > 0).sum())})
    return r


def evaluate(D, planfn, keys=None, lag=True):
    """planfn(d) → план (или (план, ntr)). {металл: периоды, сдвиг на месяц, метрики близости (вся история и до 1999)}."""
    out = {}
    for k in keys or metals(D):
        d = D[k]
        p = planfn(d)
        nt = 0
        if isinstance(p, tuple):
            p, nt = p
        e = edges(d, p, 0, nt)
        if lag:
            e1 = edges(d, p, 1, nt)
            for q in PER:
                e[q + "_lag1"] = e1[q]
        e["prox"] = prox(d, e["bx"], e["sx"])
        e["prox_b"] = prox(d, e["bx"], e["sx"], 0, d["m"])
        e["plan"] = p
        out[k] = e
    return out


def rel(a, b):
    return L.rel(a, b)


def cmp(R, Ref, keys=SEL, parts=PER + tuple(p + "_lag1" for p in PER)):
    s = {}
    for p in parts:
        if p not in R[keys[0]]:
            continue
        dd = {k: rel(R[k][p], Ref[k][p]) for k in keys if np.isfinite(Ref[k][p]) and np.isfinite(R[k][p])}
        v = np.array(list(dd.values()))
        if len(v) == 0:
            continue
        s[p] = {"ok": int((v >= -0.5).sum()), "n": len(v), "med": float(np.median(v)), "worst": float(v.min()),
                "logsum": float(np.log1p(v / 100).sum() * 100), "by": dd}
    return s


def select_ok(s, min_ok=7, min_sum=4.0, min_worst=-3.0):
    """Заранее записанный критерий отбора (только период до 1999 на 8 металлах):
    не хуже (−0,5 п.п.) на ≥ 7 из 8, худший металл ≥ −3%, сумма лог-разниц ≥ +4 (в среднем ≥ +0,5% на металл);
    обе половины (1965–1981 и 1982–1998, старт с нуля) — сумма ≥ 0; исполнение на месяц позже — сумма до 1999 ≥ 0."""
    b = s["before"]
    why = []
    if b["ok"] < min_ok:
        why.append(f"не хуже лишь {b['ok']}/8")
    if b["worst"] < min_worst:
        why.append(f"худший {b['worst']:+.1f}")
    if b["logsum"] < min_sum:
        why.append(f"сумма {b['logsum']:+.1f}")
    for h, nm in (("h1", "1965–81"), ("h2", "1982–98")):
        if s[h]["logsum"] < 0:
            why.append(f"{nm} {s[h]['logsum']:+.1f}")
    if "before_lag1" in s and s["before_lag1"]["logsum"] < 0:
        why.append(f"сдвиг {s['before_lag1']['logsum']:+.1f}")
    return not why, "; ".join(why)


def veto_ok(s):
    """Вето по периоду после 1999 (не цель, а запрет): не хуже на ≥ 6 из 8, медиана ≥ −1%, худший металл ≥ −10%."""
    a = s["after"]
    why = []
    if a["ok"] < 6:
        why.append(f"после 1999 не хуже лишь {a['ok']}/8")
    if a["med"] < -1:
        why.append(f"медиана после {a['med']:+.1f}")
    if a["worst"] < -10:
        why.append(f"худший после {a['worst']:+.1f}")
    return not why, "; ".join(why)


def agg(R, keys, which="prox"):
    def mean(f):
        v = [R[k][which][f] for k in keys if np.isfinite(R[k][which][f])]
        return float(np.mean(v)) if v else np.nan
    return {"above": mean("above"), "zone": mean("zone"), "sell_top": mean("sell_top"),
            "bots": sum(R[k][which]["bots"] for k in keys), "b1": sum(R[k][which]["b1"] for k in keys), "b2": sum(R[k][which]["b2"] for k in keys),
            "tops": sum(R[k][which]["tops"] for k in keys), "miss": sum(R[k][which]["miss"] for k in keys)}


def fprox(a):
    return (f"докупки выше мин. на {a['above']:.0f}%, в зоне {a['zone']:.0f}%, доньев с докупкой {a['b1']}/{a['bots']}, ≥2 мес. {a['b2']}/{a['bots']}; "
            f"продажи {a['sell_top']:.0f}% от макс., пропущено вершин {a['miss']}/{a['tops']}")


def fb(s):
    """Строка о периоде подбора (до 1999) — без цифр после 1999."""
    b = s["before"]
    lag = s.get("before_lag1")
    return (f"до 1999: не хуже {b['ok']}/8, мед. {b['med']:+.1f}, худш. {b['worst']:+.1f}, сумма {b['logsum']:+.1f} | половины: {s['h1']['logsum']:+.1f} / {s['h2']['logsum']:+.1f}"
            + (f" | сдвиг: {lag['logsum']:+.1f}" if lag else ""))


def fa(s):
    """Строка вето (после 1999) и вся история."""
    a, f = s["after"], s["full"]
    lag = s.get("after_lag1")
    return (f"после 1999: не хуже {a['ok']}/8, мед. {a['med']:+.1f}, худш. {a['worst']:+.1f}, сумма {a['logsum']:+.1f}"
            + (f" (сдвиг {lag['logsum']:+.1f})" if lag else "") + f" | вся: не хуже {f['ok']}/8, мед. {f['med']:+.1f}, худш. {f['worst']:+.1f}")


def line(R, keys, parts=("before", "after", "full")):
    return ", ".join(f"{NAME[k]} " + "/".join("—" if not np.isfinite(R[k][p]) else f"{R[k][p]:+.0f}" for p in parts) for k in keys)


def bymetal(s, part):
    return ", ".join(f"{NAME[k][:4]} {v:+.1f}" for k, v in s[part]["by"].items())


def study(D, cands, Ref, show=15, keys=SEL, quiet=False):
    """Считает варианты (имя → planfn), печатает ТОЛЬКО период подбора (до 1999), отмечает прошедших критерий. Возвращает строки."""
    rows = []
    for name, fn in cands.items():
        R = evaluate(D, fn, keys=metals(D))
        s = cmp(R, Ref, keys)
        ok, why = select_ok(s)
        rows.append({"name": name, "R": R, "s": s, "ok": ok, "why": why, "a": agg(R, keys, "prox_b")})
    rows.sort(key=lambda r: -r["s"]["before"]["logsum"])
    if not quiet:
        for r in rows[:show]:
            a = r["a"]
            print(f"  {'✓' if r['ok'] else '·'} {r['name']}\n      {fb(r['s'])}{'' if r['ok'] else '  ← ' + r['why']}\n"
                  f"      до 1999: доньев ≥2 мес. {a['b2']}/{a['bots']}, в зоне {a['zone']:.0f}% | продажи {a['sell_top']:.0f}%, пропущено {a['miss']}/{a['tops']}")
        print(f"  прошли критерий: {sum(r['ok'] for r in rows)} из {len(rows)}")
    return rows


def veto(rows, Ref, keys=SEL):
    """Печатает период после 1999 только для переданных (уже отобранных) строк."""
    out = []
    for r in rows:
        ok, why = veto_ok(r["s"])
        print(f"  ВЕТО {r['name']}: {fa(r['s'])} → {'проходит' if ok else 'ОТКЛОНЁН: ' + why}")
        print(f"      по металлам до / после: {bymetal(r['s'], 'before')} | {bymetal(r['s'], 'after')}")
        out.append(ok)
    return out


def exam(R, Ref):
    return "; ".join(f"{NAME[k]} " + "/".join(("—" if not np.isfinite(R[k][p]) else f"{rel(R[k][p], Ref[k][p]):+.1f}") for p in ("before", "after", "full")) for k in EXAM)


def ma(x, n):
    s = pd.Series(x)
    return s.rolling(n, min_periods=int(n * 0.7)).mean().values


def since(m):
    return L.since(m)


def runs(m):
    return L.runs(m)


def dbn(provider, dataset, code):
    return ml.dbn(provider, dataset, code)


def plateau(by, key, axes):
    """Плато: все существующие соседи по каждой оси (±1 шаг сетки) тоже прошли критерий. by: {кортеж параметров: строка}."""
    for j, vals in enumerate(axes):
        if vals is None:
            continue
        i = vals.index(key[j])
        for dj in (-1, 1):
            if 0 <= i + dj < len(vals):
                nk = list(key); nk[j] = vals[i + dj]
                nk = tuple(nk)
                if nk in by and not by[nk]["ok"]:
                    return False
    return True


def pick(rows, meta, axes, extra=None):
    """Отбор по заранее записанному правилу: прошёл select_ok, плато по сетке, доп. условие; из таких — наибольшая сумма до 1999."""
    by = {meta[r["name"]]: r for r in rows}
    good = []
    for r in rows:
        key = meta[r["name"]]
        r["plateau"] = plateau(by, key, axes(key) if callable(axes) else axes)
        if r["ok"] and r["plateau"] and (extra is None or extra(r)):
            good.append(r)
    good.sort(key=lambda r: -r["s"]["before"]["logsum"])
    return good, by
