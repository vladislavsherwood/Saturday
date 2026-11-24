"""Круг 10 mb: маржа mb1, итог, «что сейчас» (маркеры дна и уровни), сохраняет found/mb-best.json. Запуск: python3 app/mb_r10.py"""
import json
import os

import numpy as np
import pandas as pd

import mb_lib as B
import mt4_lib as M
from mb_r9 import mb1

ALL = B.DSEL + B.DEXAM


def main():
    B.tee("r10.txt")
    D, DD, MM = B.load()
    ref = lambda X: B.q2d(D, X)  # noqa: E731
    cand = mb1(D, DD)
    out = {}
    print("=== H10a МАРЖА: заём 0,5× докупки при ФРС < 3% ===")
    tot = liq = 0
    worst = 1e9
    rel = {}
    for k in ALL:
        X = MM[k]
        p = cand(X)
        lev = np.where((p > 1.0) & (np.nan_to_num(X.ff, nan=5) < 3.0), 0.5, 0.0)
        low = np.where(np.isfinite(X.l) & (X.l > 0.8 * X.c), X.l, X.c * 0.97)
        ff = np.nan_to_num(X.ff, nan=5.0)
        sg = B.dsegs(X)
        segs = {"A": sg["A"], "B": sg["B"], "2005–26": (sg["A"][0], X.n), "2000–26": (0, X.n)}
        for y in range(2001, 2021):
            segs[f"с {y}"] = (B._ix(X.t, f"{y}-01-01"), X.n)
        rel[k] = {}
        for nm, (a0, a1) in segs.items():
            if a1 - a0 < 250:
                continue
            e0 = M.dsim(X.c, p, a0, a1, 0, X.rate0, 0.001)[0]
            for st in (1.0, 0.8, 0.7):
                for lag in (0, 1):
                    e, lq, w = M.dsim_margin(X.c, low, p, lev, ff, a0, a1, lag, st, 2.0, 1.1, 0.001)
                    tot += 1
                    liq += lq
                    if st == 1.0:
                        worst = min(worst, w)
                    if st == 1.0 and lag == 0 and nm in ("A", "B", "2005–26"):
                        rel[k][nm] = B.rel(e, e0)
        print(f"  {B.NAME[k]}: к mb1 без займа A / B / 2005–26: " + " / ".join(f"{rel[k].get(s, np.nan):+.1f}" for s in ("A", "B", "2005–26")))
    print(f"  прогонов {tot}, ликвидаций {liq}, мин. обеспечение без стресса {worst:.2f} → H10a {'подтверждена' if liq == 0 and worst >= 1.5 else 'НЕ подтверждена'}")
    out["margin"] = {"runs": tot, "liquidations": liq, "min_cover": worst, "rel_to_mb1": rel}

    print("\n=== H10b ЧТО СЕЙЧАС (решение по 2026-10; цены — последний день 2026-11-23) ===")
    thr = D["_thr3"]
    now = {}
    btc = DD["x"]["btc"]
    r30 = float(btc.iloc[-1] / btc.loc[:btc.index[-1] - pd.Timedelta(days=30)].iloc[-1] - 1) * 100
    r30s = btc / btc.shift(1, freq="30D").reindex(btc.index, method="ffill") - 1
    ev = r30s[r30s <= -0.25]
    last_ev = str(ev.index[-1])[:10] if len(ev) else None
    print(f"  BTC за 30 дней {r30:+.1f}%; последний день со стрессом (≤ −25%): {last_ev}")
    for k in ["gold", "silver", "platinum", "copper", "palladium", "aluminum", "nickel", "lead", "zinc", "tin"]:
        d = D[k]
        p = B.Q2M(d)
        F = d["F"]
        rows = []
        for f, dr in d["bot"]:
            v = float(F[f].values[-1])
            t = thr[(f, dr)]
            on = (v > t) if dr == "hi" else (v < t)
            rows.append({"marker": f, "value": round(v, 3), "threshold": round(t, 3), "dir": ">" if dr == "hi" else "<", "on": bool(on)})
        p3 = float(F[B.A.P3].values[-1])
        lvl = d["c"][-1] / p3 * thr[(B.A.P3, "lo")]
        since = M.L.since(p <= -0.2 + 1e-9)[-1]
        cool_left = max(0, 24 - int(since)) if since < 10 ** 5 else 0
        last = p[-1]
        act = "докупка резерва 50%/мес." if last > 1 else ("продажа " + f"{-last:.0%}" if last < 0 else ("копить взносы (остывание)" if last == 0 else "обычный взнос"))
        nb = int(d["bn3"][-1])
        now[k] = {"plan_now": act, "bottom_markers": nb, "of": 8, "need": 5, "markers": rows, "price_month": float(d["c"][-1]),
                  "price_marker_level": float(lvl), "cooldown_months_left": cool_left}
        print(f"  {B.NAME[k]}: {act}; маркеров дна {nb}/8 (нужно ≥ 5); остывание ещё {cool_left} мес.; средняя 10.2026 {d['c'][-1]:.1f}, "
              f"маркер «цена к средней 3 лет < 0,854» загорится ниже ≈ {lvl:.1f} (сейчас {p3:.2f})")
        print("     " + "; ".join(f"{r['marker'][:28]} {r['value']:+.2f} ({r['dir']}{r['threshold']:.2f}) {'ДА' if r['on'] else 'нет'}" for r in rows))
    out["now"] = now
    out["btc"] = {"r30": r30, "last_stress_day": last_ev}
    # цены дневные сейчас
    for k in B.DSEL:
        X = MM[k]
        print(f"  {B.NAME[k]} {str(X.t[-1])[:10]}: {X.c[-1]:.2f} ({(X.c[-1] / X.c.max() - 1) * 100:+.0f}% от рекорда)")
        out["now"][k]["price_last"] = float(X.c[-1])
        out["now"][k]["from_ath"] = float((X.c[-1] / X.c.max() - 1) * 100)
    G, S = MM["gold"], MM["silver"]
    print(f"  золото/серебро {G.c[-1] / S.c[-1]:.1f}")
    out["gold_silver"] = float(G.c[-1] / S.c[-1])
    json.dump(B.clean(out), open(os.path.join(B.LOGDIR, "r10.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
