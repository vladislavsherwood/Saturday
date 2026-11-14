"""Стенд третьего агента по металлам: новый протокол «без суперцикла 1965–81». Расширяет metals_agent2_lib.py, не меняя его.

Протокол (решение пользователя, записан до первого круга):
- ОТБОР: 8 металлов (золото, серебро, платина, медь, алюминий, никель, свинец, цинк), период 1982-01 … 1998-12, старт с нуля в 1982
  (часть «h2» стенда второго агента). Данные 1965–1981 в отборе не участвуют (только как история для средних и, по желанию, для порогов).
- Критерий отбора (sel_ok) против текущей основы: в 1982–98 не хуже (допуск −0,5 п.п.) на ≥ 7 из 8, худший металл ≥ −3%,
  сумма лог-разниц ≥ +4; исполнение на месяц позже — сумма ≥ 0; старты каждый январь 1982–1990 до 1999 (72 прогона) — не хуже в ≥ 70%;
  у параметрических правил — плато (соседние значения по каждой оси тоже проходят). Простое лучше сложного: при равенстве — меньше параметров.
- ВЕТО (только для уже выбранного кандидата, печатается после выбора): 1999–2026, старт с нуля в 1999, против R3 —
  медиана ≥ 0, не хуже на ≥ 5 из 8, худший металл ≥ −10%.
- ЭКЗАМЕН: палладий, олово — только в финальной сводке.
"""
import numpy as np
import pandas as pd

import metals_agent2_lib as A
import metals_agent_lib as L
from metals_monthly import BOT, TOP

SEL, EXAM, NAME = A.SEL, A.EXAM, A.NAME
P3, Y1, F10, GO, II = A.P3, A.Y1, A.F10, A.GO, A.II


def load():
    return A.load()


def pooled82(D, f, q, keys=SEL):
    """Процентиль q признака f по месяцам 1982–1998 на металлах отбора."""
    v = np.concatenate([D[k]["F"][f].values[D[k]["h82"]: D[k]["m"]] for k in keys])
    v = v[np.isfinite(v)]
    return float(np.quantile(v, q))


def rethr(D, hot=False):
    """Копия D с порогами маркеров, пересчитанными по 1982–1998 (80/20, групповые q80, индекс q25); hot=True — и перегрев (q97 обоих признаков).
    Пересчитываются tn3, bn3, cu_past (медь-лидер)."""
    thr = {}
    for f, dr in TOP + BOT + [(F10, "hi"), (GO, "hi")]:
        thr[(f, dr)] = pooled82(D, f, 0.8 if dr == "hi" else 0.2)
    thr[(II, "lo")] = pooled82(D, II, 0.25)
    E = {k: v for k, v in D.items() if k.startswith("_")}
    E["_thr82"] = thr
    E["_hot"] = (pooled82(D, P3, 0.97), pooled82(D, Y1, 0.97)) if hot else (1.81, 86.0)
    cu = D["copper"]
    tn7 = L.count(cu, thr, TOP)
    c = pd.Series(cu["c"], index=cu["t"])
    sig = pd.Series(tn7 >= 5, index=cu["t"]).astype(int).rolling(6, min_periods=1).max() > 0
    past = sig & (c < c.rolling(12, min_periods=9).mean())
    for k in A.metals(D):
        d = dict(D[k])
        d["tn3"], d["bn3"] = L.count(d, thr, d["top"]), L.count(d, thr, d["bot"])
        d["cu_past"] = past.reindex(d["t"]).fillna(False).values & (k != "copper")
        E[k] = d
    return E


def hotkw(D):
    h = D.get("_hot")
    return {} if h is None else {"hot3": h[0], "hot1": h[1]}


PER3 = ("h2", "after", "full")


def run(D, planfn, keys=None, lag=True):
    """Итог к DCA по периодам 1982–98 (h2), 1999–2026 (after), вся история (full) + сдвиг на месяц; метрики близости на 1982–98 и после 1999."""
    out = {}
    for k in keys or A.metals(D):
        d = D[k]
        c, m, n, h = d["c"], d["m"], len(d["c"]), d["h82"]
        p = np.asarray(planfn(d), np.float64)
        z = np.zeros(n)
        e = {"plan": p}
        if m > 24:
            e["h2"], bx, sx = L.sim(c, p, h, m, 0, z)
            e["prox_h2"] = A.prox(d, bx, sx, h, m)
            e["bx_h2"], e["sx_h2"] = bx, sx
            if lag:
                e["h2_lag1"] = L.sim(c, p, h, m, 1, z)[0]
            e["starts"] = []
            for y in range(1982, 1991):
                a0 = int(np.searchsorted(d["t"].values, np.datetime64(f"{y}-01-01")))
                e["starts"].append(L.sim(c, p, a0, m, 0, z)[0])
        else:
            e["h2"] = e["h2_lag1"] = np.nan
        e["after"], bx, sx = L.sim(c, p, m, n, 0, z)
        e["prox_after"] = A.prox(d, bx, sx, m, n)
        if lag:
            e["after_lag1"] = L.sim(c, p, m, n, 1, z)[0]
        e["full"], bx, sx = L.sim(c, p, 0, n, 0, z)
        e["prox_full"] = A.prox(d, bx, sx)
        out[k] = e
    return out


def cmp(R, Ref, keys=SEL, parts=("h2", "h2_lag1", "after", "after_lag1", "full")):
    s = {}
    for p in parts:
        dd = {k: A.rel(R[k][p], Ref[k][p]) for k in keys if p in R[k] and p in Ref[k] and np.isfinite(Ref[k][p]) and np.isfinite(R[k][p])}
        v = np.array(list(dd.values()))
        if len(v) == 0:
            continue
        s[p] = {"ok": int((v >= -0.5).sum()), "n": len(v), "med": float(np.median(v)), "worst": float(v.min()),
                "logsum": float(np.log1p(v / 100).sum() * 100), "by": dd}
    st = np.array([A.rel(a, b) for k in keys if "starts" in R[k] for a, b in zip(R[k]["starts"], Ref[k]["starts"])])
    if len(st):
        s["starts"] = {"share": float((st >= -0.5).mean() * 100), "med": float(np.median(st)), "n": len(st)}
    return s


def sel_ok(s, min_ok=7, min_sum=4.0, min_worst=-3.0, min_share=70.0):
    b = s["h2"]
    why = []
    if b["ok"] < min_ok:
        why.append(f"не хуже лишь {b['ok']}/8")
    if b["worst"] < min_worst:
        why.append(f"худший {b['worst']:+.1f}")
    if b["logsum"] < min_sum:
        why.append(f"сумма {b['logsum']:+.1f}")
    if "h2_lag1" in s and s["h2_lag1"]["logsum"] < 0:
        why.append(f"сдвиг {s['h2_lag1']['logsum']:+.1f}")
    if "starts" in s and s["starts"]["share"] < min_share:
        why.append(f"старты {s['starts']['share']:.0f}%")
    return not why, "; ".join(why)


def veto_ok(s):
    """Вето 1999–2026 против R3: медиана ≥ 0, не хуже на ≥ 5 из 8, худший ≥ −10%."""
    a = s["after"]
    why = []
    if a["med"] < 0:
        why.append(f"медиана {a['med']:+.1f}")
    if a["ok"] < 5:
        why.append(f"не хуже лишь {a['ok']}/8")
    if a["worst"] < -10:
        why.append(f"худший {a['worst']:+.1f}")
    return not why, "; ".join(why)


def agg(R, keys=SEL, which="prox_h2"):
    def mean(f):
        v = [R[k][which][f] for k in keys if which in R[k] and np.isfinite(R[k][which][f])]
        return float(np.mean(v)) if v else np.nan
    ks = [k for k in keys if which in R[k]]
    return {"above": mean("above"), "zone": mean("zone"), "sell_top": mean("sell_top"),
            "bots": sum(R[k][which]["bots"] for k in ks), "b1": sum(R[k][which]["b1"] for k in ks), "b2": sum(R[k][which]["b2"] for k in ks),
            "tops": sum(R[k][which]["tops"] for k in ks), "miss": sum(R[k][which]["miss"] for k in ks)}


def fprox(a):
    return A.fprox(a)


def fs(s):
    """Строка отбора (1982–98) — без цифр после 1999."""
    b = s["h2"]
    out = f"1982–98: не хуже {b['ok']}/8, мед. {b['med']:+.1f}, худш. {b['worst']:+.1f}, сумма {b['logsum']:+.1f}"
    if "h2_lag1" in s:
        out += f" | сдвиг {s['h2_lag1']['logsum']:+.1f}"
    if "starts" in s:
        out += f" | старты не хуже {s['starts']['share']:.0f}%"
    return out


def fv(s):
    a, f = s["after"], s["full"]
    lag = s.get("after_lag1")
    return (f"1999–2026: не хуже {a['ok']}/8, мед. {a['med']:+.1f}, худш. {a['worst']:+.1f}, сумма {a['logsum']:+.1f}"
            + (f" (сдвиг {lag['logsum']:+.1f})" if lag else "") + f" | вся: не хуже {f['ok']}/8, мед. {f['med']:+.1f}, худш. {f['worst']:+.1f}")


def bym(s, part):
    return ", ".join(f"{NAME[k][:4]} {v:+.1f}" for k, v in s[part]["by"].items())


def line(R, keys, parts=("h2", "after", "full")):
    return ", ".join(f"{NAME[k]} " + "/".join("—" if not np.isfinite(R[k].get(p, np.nan)) else f"{R[k][p]:+.0f}" for p in parts) for k in keys)


def study(D, cands, Ref, show=12, quiet=False):
    """cands: имя → planfn или (D_вариант, planfn). Печатает ТОЛЬКО 1982–98."""
    rows = []
    for name, fn in cands.items():
        DD, f = fn if isinstance(fn, tuple) else (D, fn)
        R = run(DD, f)
        s = cmp(R, Ref)
        ok, why = sel_ok(s)
        rows.append({"name": name, "R": R, "s": s, "ok": ok, "why": why, "a": agg(R)})
    if not quiet:
        for r in sorted(rows, key=lambda r: -r["s"]["h2"]["logsum"])[:show]:
            a = r["a"]
            print(f"  {'✓' if r['ok'] else '·'} {r['name']}\n      {fs(r['s'])}{'' if r['ok'] else '  ← ' + r['why']}\n"
                  f"      1982–98: доньев ≥2 мес. {a['b2']}/{a['bots']}, в зоне {a['zone']:.0f}% | продажи {a['sell_top']:.0f}%, пропущено {a['miss']}/{a['tops']}")
        print(f"  прошли критерий: {sum(r['ok'] for r in rows)} из {len(rows)}")
    return rows


def pick(rows, meta, axes, extra=None):
    by = {meta[r["name"]]: r for r in rows}
    good = []
    for r in rows:
        key = meta[r["name"]]
        r["plateau"] = A.plateau(by, key, axes(key) if callable(axes) else axes)
        if r["ok"] and r["plateau"] and (extra is None or extra(r)):
            good.append(r)
    good.sort(key=lambda r: -r["s"]["h2"]["logsum"])
    return good, by


def veto(r, R3, Base=None):
    s = cmp(r["R"], R3)
    ok, why = veto_ok(s)
    print(f"  ВЕТО {r['name']} (к R3): {fv(s)} → {'проходит' if ok else 'ОТКЛОНЁН: ' + why}")
    print(f"      по металлам 1982–98 / 1999–2026 (к R3): {bym(s, 'h2')} | {bym(s, 'after')}")
    if Base is not None:
        sb = cmp(r["R"], Base)
        print(f"      к текущей основе: {fs(sb)}\n      {fv(sb)}")
    return ok


def exam(R, Ref):
    return "; ".join(f"{NAME[k]} " + "/".join(("—" if not np.isfinite(R[k].get(p, np.nan)) or not np.isfinite(Ref[k].get(p, np.nan))
                                                else f"{A.rel(R[k][p], Ref[k][p]):+.1f}") for p in PER3) for k in EXAM)


def heat(d, a, b):
    return (np.nan_to_num(A.feat(d, P3)) > a) & (np.nan_to_num(A.feat(d, Y1)) > b)
