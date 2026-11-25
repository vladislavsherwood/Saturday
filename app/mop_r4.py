"""Круг 4 mop: О1 = mb1 + «малая серия», пока своя вол металла − VIX < −10. Разбор и варианты. Запуск: python3 app/mop_r4.py"""
import numpy as np
import pandas as pd

import mop_lib as P
from mop_r2 import own_iv

Y, G = 10.0, 0.5


def o1(y=Y, g=G, silver_gvz=False, base="^VIX", no_cool=False, cap=None, off=None):
    """О1 с вариантами. off — (начало, конец) окна, где правило выключено."""
    gd = 1 - (1 - g) ** (1 / 21)
    V = P.vol()

    def f(X):
        p = P.mb1(X)
        iv, _, _ = own_iv(X)
        if silver_gvz and X.k == "silver":
            iv = P.on(V["^GVZ"], X)
        ref = P.on(V[base], X)
        with np.errstate(invalid="ignore"):
            m = np.nan_to_num(iv - ref < -y).astype(bool) & (p >= 0) & (p <= 1.0)
        if no_cool:
            m &= p > 0
        if off is not None:
            m &= ~((X.t >= off[0]) & (X.t <= off[1]))
        if cap is not None:                      # эпизод: подряд идущие дни (разрыв ≤ 30 дн.); за эпизод не больше cap резерва
            out = m.copy()
            spent = 1.0
            last = -10 ** 6
            for i in range(len(m)):
                if m[i]:
                    if i - last > 30:
                        spent = 1.0
                    last = i
                    if 1 - spent * (1 - gd) > cap:
                        out[i] = False
                    else:
                        spent *= (1 - gd)
            m = out
        q = p.copy()
        q[m] = 1.0 + gd
        return q
    return f


def main():
    P.tee("r4.txt")
    D, DD, MM = P.load()
    base = o1()
    o = P.check(MM, base, None, P.DSEL, P.END25)
    print(f"О1 (y 10, g 50%): {P.fmt(o)} → {P.ok(o)}")
    print("\nH4a вклад по годам (правило выключено в одном году; сумма до 2025-12 и потеря):")
    tot = o["sum"]
    rows = []
    for yr in range(2008, 2026):
        oy = P.check(MM, o1(off=(f"{yr}-01-01", f"{yr}-12-31")), None, P.DSEL, P.END25, starts=False, eps=False, extra=False)
        if abs(tot - oy["sum"]) > 0.05:
            rows.append((yr, tot - oy["sum"]))
    for yr, d in rows:
        print(f"  {yr}: вклад {d:+.1f} ({d / tot * 100:.0f}% суммы)")
    top = max(rows, key=lambda r: r[1])
    print(f"  крупнейший год {top[0]}: {top[1] / tot * 100:.0f}% → H4a {'да' if top[1] / tot < 0.5 else 'нет'}")

    print("\nДокупки О1 сверх mb1 по эпизодам (2005–2025, старт 2005; $ докупок резерва, средняя цена, цена через 126/252 дн., минимум следующих 252 дн.):")
    for k in P.DSEL + ["palladium", "aluminum"]:
        X = MM[k]
        p, p0 = base(X), P.mb1(X)
        sg, e = P.segs(X, P.END25)
        a0 = sg["full"][0] if k != "aluminum" else 0
        r, r0 = P.M.dsim(X.c, p, a0, e, 0, X.rate0, 0.001), P.M.dsim(X.c, p0, a0, e, 0, X.rate0, 0.001)
        extra = (p > 1) & (p0 <= 1)
        bx = np.where(extra, r[1], 0.0)
        for a, b in P.B.episodes(bx > 0, 30):
            m = bx[a:b + 1]
            cc = X.c[a:b + 1]
            avg = m.sum() / (m / cc).sum()
            i126, i252 = min(len(X.c) - 1, b + 126), min(len(X.c) - 1, b + 252)
            fmin = X.c[a:min(len(X.c), b + 253)].min()
            print(f"  {P.NAME[k]:<9} {str(X.t[a])[:10]}…{str(X.t[b])[:10]}: ${m.sum():7.0f}, средняя {avg:9.2f}, через 126/252 дн. {X.c[i126] / avg * 100 - 100:+5.0f}% / {X.c[i252] / avg * 100 - 100:+5.0f}%, выше мин. 252 дн. {avg / fmin * 100 - 100:+4.0f}%")

    print("\nH4b варианты:")
    var = {"серебро по GVZ": o1(silver_gvz=True), "VIX3M вместо VIX": o1(base="^VIX3M"), "без месяцев остывания": o1(no_cool=True),
           "≤ 50% резерва за эпизод": o1(cap=0.5), "≤ 33% резерва за эпизод": o1(cap=0.33)}
    for nm, fn in var.items():
        P.both(MM, fn, nm)
    print("\nH4c экзамен (палладий — GVZ, алюминий — OVX):")
    for end in (P.END25, None):
        ex = P.check(MM, base, None, ["palladium", "aluminum"], end, starts=False)
        print(f"  до {end or '2026-11'}: " + ", ".join(f"{P.NAME[k]} {ex['cells'].get((k, 'A'), np.nan):+.1f}/{ex['cells'].get((k, 'B'), np.nan):+.1f}" for k in ("palladium", "aluminum"))
              + f", сумма {ex['sum']:+.1f}, с 2008 {ex['c08_sum']:+.1f}")
    print("\nH4d точность докупок резерва 2005–2025 (рано / к DCA резерва, взвешено; mb1 → О1):")
    for nm, fn in (("mb1", P.mb1), ("О1", base)):
        Pm = {}
        for k in P.DSEL:
            X = MM[k]
            sg, e = P.segs(X, P.END25)
            r = P.M.dsim(X.c, fn(X), sg["full"][0], e, 0, X.rate0, 0.001)
            Pm[k] = P.B.precision(X.c, r[1], X.t, sg["full"][0], e, 252, 504, 63)
        print(f"  {nm}: {P.B.fprec2(Pm)}")


if __name__ == "__main__":
    main()
