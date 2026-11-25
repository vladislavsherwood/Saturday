"""Круг 8 mvd: устойчивость лучшей шкалы без долга (реальная ставка «≤ 0,3 ×2 / ≥ 0,9 ×0,5», предел 126) — плато, векселя, комиссия, экзамен;
месячный аналог 1965–2025 по эпохам (8 металлов + экзамен) вместе с ценовой шкалой и «постоянным авансом». Запуск: python3 app/mvd_r8.py"""
import numpy as np
import pandas as pd

import mvd_lib as V

SEL8 = ["gold", "silver", "platinum", "copper", "aluminum", "nickel", "lead", "zinc"]
EXM = ["palladium", "tin"]
EPOCHS = {"1965–81": ("1965-01-01", "1982-01-01"), "1982–98": ("1982-01-01", "1999-01-01"), "1999–2004": ("1999-01-01", "2005-01-01"),
          "2005–15": ("2005-01-01", "2016-01-01"), "2016–25": ("2016-01-01", "2026-01-01")}


def near(q1=0.3, q2=0.9, mhi=2.0, mlo=0.5, W=1260, cap=126, **kw):
    return V.Scale(V.U("rr", W), V.steps(q1, q2, mhi, mlo), cap=cap * 10.0, name=f"реальн. ≤{q1} ×{mhi} / ≥{q2} ×{mlo}, окно {W}, предел {cap}", **kw)


# ---------------- месячный аналог ----------------
def m_rr(D):
    Xm = D["_X"]
    rr = Xm["y10"] - (Xm["cpi"] / Xm["cpi"].shift(12) - 1) * 100
    return -(rr - rr.rolling(36, min_periods=24).mean())        # больше = дороже


def m_u(series, t, W=60):
    s = series.reindex(pd.DatetimeIndex(t), method="ffill")
    return s.rolling(W, min_periods=24).rank(pct=True).values


def m_run(d, u, mapf, cap_m, a0, a1, adv_m=0.0, ff=None):
    c = np.asarray(d["c"], float)
    n = len(c)
    m = np.asarray(mapf(np.where(np.isfinite(u), u, 0.5)), float)
    dr = np.zeros(n) if ff is None else (np.nan_to_num(ff, nan=5.0) + 2.0) / 100 / 12
    return V.simv(c, np.ones(n), m, a0, a1, 0, np.zeros(n), 0.001, cap_m * 10.0, 0, 0, 0.0, 0, 0.0, 3.0, -1.0, adv_m * 10.0, dr)[0]


def monthly(D):
    rr = m_rr(D)
    out = {}
    for k in SEL8 + EXM:
        d = D[k]
        t = pd.DatetimeIndex(d["t"])
        lc = np.log(np.asarray(d["c"], float))
        z = pd.Series(lc)
        z3 = ((z - z.rolling(36, min_periods=24).mean()) / z.rolling(36, min_periods=24).std()).values
        ff = D["_X"]["ff"].reindex(t, method="ffill").values
        U = {"реальн.": m_u(rr, t), "z3y": pd.Series(z3).rolling(60, min_periods=24).rank(pct=True).values}
        for e, (a, b) in EPOCHS.items():
            a0, a1 = int(np.searchsorted(t.values, np.datetime64(a))), int(np.searchsorted(t.values, np.datetime64(b)))
            if a1 - a0 < 36:
                continue
            out[(k, e, "реальн.")] = m_run(d, U["реальн."], V.steps(0.3, 0.9, 2.0, 0.5), 6, a0, a1)
            out[(k, e, "z3y")] = m_run(d, U["z3y"], V.steps(0.3, 0.9, 2.0, 0.5), 6, a0, a1)
            out[(k, e, "аванс 3 мес.")] = m_run(d, U["реальн."], lambda u: np.full_like(u, 1.5), 0, a0, a1, adv_m=3, ff=ff)
    return out


def main():
    V.tee("r8.txt")
    D, DD, MM, _ = V.load()
    N0 = near()
    o = V.check(N0)
    good, why = V.ok(o)
    print(f"КАНДИДАТ-БЛИЖАЙШИЙ {N0.name}: {V.fmt(o)} | {'✓' if good else '✗ ' + why}")
    print(f"   {V.fafter(o)}")
    print("\n=== плато (сумма 8 ячеек к DCA, A / B, не хуже) ===")
    grid = {"q1": (0.2, 0.3, 0.4), "q2": (0.8, 0.9, 0.95), "mhi": (1.5, 2.0, 3.0), "mlo": (0.0, 0.5, 0.75), "W": (756, 1260, 2520), "cap": (63, 126, 252)}
    for p, vals in grid.items():
        line = []
        for v in vals:
            S = near(**{p: v})
            oo = V.check(S, starts=False, epis=False, after=False)
            line.append(f"{v}: {oo['sum']:+.1f} (A {oo['A']:+.1f} B {oo['B']:+.1f}, {oo['ok']}/8)")
        print(f"  {p}: " + " | ".join(line))
    print("\n=== векселя, комиссия 0,5%, экзамен ===")
    ot = V.check(N0, rate="tb", starts=False, epis=False)
    print(f"  копилка в векселях: {V.fmt(ot)}")
    of = V.check(N0, fee=0.005, starts=False, epis=False)
    print(f"  комиссия 0,5%: {V.fmt(of)}")
    ox = V.check(N0, keys=["palladium", "aluminum"], starts=False, epis=False)
    print(f"  экзамен палладий / алюминий: " + " ".join(f"{V.NAME[k]} {ox['cells'].get((k, 'A'), np.nan):+.1f}/{ox['cells'].get((k, 'B'), np.nan):+.1f}" for k in ("palladium", "aluminum"))
          + f"; 2005–25 палладий {ox['full']['palladium']:+.1f}; после решения палладий 2005–26 {ox['full26']['palladium']:+.1f}")
    print("\n=== МЕСЯЧНЫЙ АНАЛОГ к месячному DCA по эпохам (старт с нуля в каждой; взнос раз в месяц; предел копилки 6 взносов) ===")
    R = monthly(D)
    for sc in ("реальн.", "z3y", "аванс 3 мес."):
        print(f"  {sc}:")
        for e in EPOCHS:
            v = [R[(k, e, sc)] for k in SEL8 if (k, e, sc) in R]
            ex = " ".join(f"{V.NAME[k][:4]} {R[(k, e, sc)]:+.1f}" for k in EXM if (k, e, sc) in R)
            print(f"    {e}: сумма 8 металлов {V.lsum(v):+.1f}, не хуже {sum(1 for x in v if x >= -0.5)}/{len(v)}, худший {min(v):+.1f} | "
                  + " ".join(f"{V.NAME[k][:4]} {R[(k, e, sc)]:+.1f}" for k in SEL8 if (k, e, sc) in R) + f" | экз. {ex}")
        tot = [R[(k, e, sc)] for k in SEL8 for e in ("1965–81", "1982–98", "1999–2004") if (k, e, sc) in R]
        print(f"    вторичная 1965–2004: сумма {V.lsum(tot):+.1f}")


if __name__ == "__main__":
    main()
