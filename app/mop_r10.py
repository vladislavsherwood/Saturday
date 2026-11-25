"""Круг 10 mop: проверка определения О1-AuAg (откуда сигнал серебра), маржа, «что сейчас» (лог scratchpad/mop/r10.txt, r10.json). Запуск: python3 app/mop_r10.py"""
import json
import os

import numpy as np
import pandas as pd

import mb_lib as B
import mop_lib as P
from mop_r2 import own_iv
from mop_r4 import o1
from mop_r8 import only

ALL = P.DSEL + P.DEXAM
NOWK = ["gold", "silver", "platinum", "palladium", "copper"]


def strict_vxslv(y=10.0, g=0.5):
    """О1-AuAg, где серебро — строго по VXSLV (в разрыве 2022-03…2025-05 и до 2011-03 правила нет)."""
    gd = 1 - (1 - g) ** (1 / 21)
    V = P.vol()

    def f(X):
        p = P.mb1(X)
        if X.k not in ("gold", "silver"):
            return p
        s = V["^GVZ"] if X.k == "gold" else V["VXSLV"]
        iv = P.on(s, X)
        last = P.on(pd.Series(s.index, index=s.index), X)
        age = (X.t.values - pd.to_datetime(last).values) / np.timedelta64(1, "D")
        iv = np.where(age <= 10, iv, np.nan)
        with np.errstate(invalid="ignore"):
            m = np.nan_to_num(iv - P.on(V["^VIX"], X) < -y).astype(bool) & (p >= 0) & (p <= 1.0)
        q = p.copy()
        q[m] = 1.0 + gd
        return q
    return f


def main():
    P.tee("r10.txt")
    D, DD, MM = P.load()
    cand = only(o1())
    out = {}
    print("=== Проверка определения: откуда сигнал серебра ===")
    V = P.vol()
    for nm, fn in (("О1-AuAg (серебро: VXSLV, в разрыве — GVZ)", cand), ("серебро строго по VXSLV", strict_vxslv()),
                   ("серебро всегда по GVZ", only(o1(silver_gvz=True))), ("только золото", only(o1(), ("gold",)))):
        o = P.check(MM, fn, None, P.DSEL, P.END25)
        k, why = P.ok(o)
        print(f"  {nm:<44} {P.fmt(o, short=True)} | сер {o['cells'][('silver', 'A')]:+.1f}/{o['cells'][('silver', 'B')]:+.1f} → {'✓' if k else '✗ ' + why[:90]}")
    d = pd.DataFrame({"s": V["VXSLV"], "g": V["^GVZ"]}).dropna()
    print(f"  VXSLV − GVZ: медиана {(d.s - d.g).median():+.1f}, минимум {(d.s - d.g).min():+.1f} (VXSLV всегда выше GVZ)")
    print("=== H10a МАРЖА: заём 0,5× докупки резерва при ФРС < 3% (О1-AuAg) ===")
    tot = liq = 0
    worst = 1e9
    relm = {}
    for k in ALL:
        X = MM[k]
        p = cand(X)
        lev = np.where((p > 1.0) & (np.nan_to_num(X.ff, nan=5) < 3.0), 0.5, 0.0)
        low = np.where(np.isfinite(X.l) & (X.l > 0.8 * X.c), X.l, X.c * 0.97)
        ff = np.nan_to_num(X.ff, nan=5.0)
        sg, _ = P.segs(X)
        segs = {"A": sg["A"], "B": sg["B"], "2005–26": sg["full"], "2000–26": sg["all"], "2008–26": sg["08"]}
        for y in range(2001, 2021):
            segs[f"с {y}"] = (P._ix(X.t, f"{y}-01-01"), X.n)
        relm[k] = {}
        for nm, (a0, a1) in segs.items():
            if a1 - a0 < 250:
                continue
            e0 = P.M.dsim(X.c, p, a0, a1, 0, X.rate0, 0.001)[0]
            for st in (1.0, 0.8, 0.7):
                for lag in (0, 1):
                    e, lq, w = P.M.dsim_margin(X.c, low, p, lev, ff, a0, a1, lag, st, 2.0, 1.1, 0.001)
                    tot += 1
                    liq += lq
                    if st == 1.0:
                        worst = min(worst, w)
                    if st == 1.0 and lag == 0 and nm in ("A", "B", "2005–26"):
                        relm[k][nm] = P.rel(e, e0)
        print(f"  {P.NAME[k]}: к О1-AuAg без займа A / B / 2005–26: " + " / ".join(f"{relm[k].get(s, np.nan):+.1f}" for s in ("A", "B", "2005–26")))
    print(f"  прогонов {tot}, ликвидаций {liq}, мин. обеспечение без стресса {worst:.2f}")
    out["margin"] = {"runs": tot, "liquidations": int(liq), "min_cover": float(worst), "rel_to_O1_no_margin": relm}

    print("\n=== H10b ЧТО СЕЙЧАС ===")
    V = P.vol()
    snap = {}
    for s in ("^GVZ", "VXSLV", "VXGDX", "^OVX", "^VIX", "^VIX3M", "^MOVE"):
        x = V[s]
        snap[s] = {"last": float(x.iloc[-1]), "date": str(x.index[-1])[:10], "pctl_1y": float(P.pctl(x).iloc[-1]),
                   "max_30d": float(x.iloc[-22:].max())}
        print(f"  {s}: {x.iloc[-1]:.2f} ({str(x.index[-1])[:10]}), перцентиль года {snap[s]['pctl_1y']:.2f}, макс. 30 дн. {snap[s]['max_30d']:.2f}")
    vix = V["^VIX"]
    for s, nm in (("^GVZ", "gold"), ("VXSLV", "silver")):
        d = (V[s] - vix).dropna()
        snap[f"{nm}_ownvol_minus_vix"] = {"last": float(d.iloc[-1]), "min_30d": float(d.iloc[-22:].min()), "date": str(d.index[-1])[:10],
                                         "last_trigger": str(d[d < -10].index[-1])[:10] if (d < -10).any() else None}
        print(f"  {P.NAME[nm]}: своя вол − VIX = {d.iloc[-1]:+.1f} (мин. за 30 дн. {d.iloc[-22:].min():+.1f}; порог О1 < −10; последний раз < −10: {snap[f'{nm}_ownvol_minus_vix']['last_trigger']})")
    inv = (vix / V["^VIX3M"]).dropna()
    snap["vix_vix3m"] = float(inv.iloc[-1])
    print(f"  VIX/VIX3M = {inv.iloc[-1]:.2f} (инверсия > 1 — фон, не правило: круг 1 — металлы за 126 дн. в среднем лучше на +2…+13 п.п.)")
    out["vol_now"] = snap
    btc = DD["x"]["btc"]
    r30s = btc / btc.shift(1, freq="30D").reindex(btc.index, method="ffill") - 1
    ev = r30s[r30s <= -0.25]
    last_ev = ev.index[-1] if len(ev) else None
    out["btc_pause"] = {"r30_pct": float(r30s.iloc[-1] * 100), "last_stress_day": str(last_ev)[:10] if last_ev is not None else None}
    print(f"  BTC за 30 дн. {r30s.iloc[-1] * 100:+.1f}%, последний день стресса {str(last_ev)[:10]} (пауза докупок серии mb1 ~90 торговых дней)")
    now = {}
    for k in NOWK:
        d = D[k]
        p = B.Q2M(d)
        since = P.L.since(p <= -0.2 + 1e-9)[-1]
        cool_left = max(0, 24 - int(since)) if since < 10 ** 5 else 0
        last = p[-1]
        act = ("серия докупок" if last > 1 else (f"продажа {-last:.0%}" if last < 0 else ("копить взносы (остывание)" if last == 0 else "обычный взнос")))
        X = MM[k]
        pd_ = cand(X)
        sg, _ = P.segs(X)
        r = P.M.dsim(X.c, pd_, sg["full"][0], X.n, 0, X.rate0, 0.001)
        res_share = r[3] / (r[3] + r[4] * X.c[-1]) * 100
        r0 = P.M.dsim(X.c, P.mb1(X), sg["full"][0], X.n, 0, X.rate0, 0.001)
        res0 = r0[3] / (r0[3] + r0[4] * X.c[-1]) * 100
        iv, _, pc = own_iv(X)
        o1_on = k in ("gold", "silver") and np.isfinite(iv[-1]) and iv[-1] - P.on(V["^VIX"], X)[-1] < -10
        now[k] = {"mb1_plan_by_2026_10": act, "bottom_markers": int(d["bn3"][-1]), "top_markers": int(d["tn3"][-1]), "of_top": int(d["nt"]),
                  "cooldown_months_left_from_2026_10": cool_left, "reserve_share_pct_2005_start": {"mb1": round(float(res0), 1), "O1_AuAg": round(float(res_share), 1)},
                  "price_last": float(X.c[-1]), "date": str(X.t[-1])[:10], "from_ath_pct": float((X.c[-1] / X.c.max() - 1) * 100),
                  "own_vol_pctl_1y": None if not np.isfinite(pc[-1]) else float(pc[-1]), "O1_now": bool(o1_on)}
        print(f"  {P.NAME[k]}: план mb1 (по 10.2026) — {act}; дна {int(d['bn3'][-1])}/8, вершины {int(d['tn3'][-1])}/{int(d['nt'])}; остывание ещё {cool_left} мес.; "
              f"цена {X.c[-1]:.2f} ({now[k]['from_ath_pct']:+.0f}% от рекорда); резерв (старт 2005) mb1 {res0:.0f}% / О1-AuAg {res_share:.0f}%; "
              f"перцентиль своей вол {now[k]['own_vol_pctl_1y'] if now[k]['own_vol_pctl_1y'] is None else round(now[k]['own_vol_pctl_1y'], 2)}; О1 сейчас: {'ДА' if o1_on else 'нет'}")
    out["now"] = now
    json.dump(P.B.clean(out), open(os.path.join(P.LOGDIR, "r10.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
