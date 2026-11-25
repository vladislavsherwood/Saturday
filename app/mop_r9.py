"""Круг 9 mop: устойчивость опции О1-AuAg. Запуск: python3 app/mop_r9.py (лог scratchpad/mop/r9.txt)"""
import numpy as np
import pandas as pd

import mb_lib as B
import mop_lib as P
from mop_r2 import own_iv
from mop_r4 import o1
from mop_r8 import only

AUAG = ("gold", "silver")


def o1w(y=10.0, g=0.5):
    """Недельное исполнение: если в любой торговый день прошлой недели своя вол − VIX < −y (и не было продаж / серии в день решения) —
    в первый торговый день недели доля резерва 1 − (1 − g)^(1/4,33)."""
    gw = 1 - (1 - g) ** (1 / 4.33)
    V = P.vol()

    def f(X):
        p = P.mb1(X)
        if X.k not in AUAG:
            return p
        iv, _, _ = own_iv(X)
        with np.errstate(invalid="ignore"):
            c = np.nan_to_num(iv - P.on(V["^VIX"], X) < -y).astype(bool)
        wk = pd.DatetimeIndex(X.t).to_period("W")
        first = np.r_[True, wk[1:] != wk[:-1]]
        cw = pd.Series(c).groupby(np.asarray(wk.astype(str))).transform("max").values.astype(bool)
        q = p.copy()
        idx = np.where(first)[0]
        for j, i in enumerate(idx):
            if j == 0:
                continue
            prev = idx[j - 1]
            if cw[prev] and 0 <= p[i - 1] <= 1.0 and 0 <= p[i] <= 1.0:
                q[i - 1] = 1.0 + gw            # план дня i−1 исполняется в день i (первый день недели)
        return q
    return f


def main():
    P.tee("r9.txt")
    D, DD, MM = P.load()
    cand = only(o1())
    okall = True
    o = P.check(MM, cand, None, P.DSEL, P.END25)
    print(f"База: {P.fmt(o)}")
    # (a) векселя
    s = []
    for k in P.DSEL:
        X = MM[k]
        sg, e = P.segs(X, P.END25)
        for h in ("A", "B"):
            s.append(P.rel(P.run(X, cand(X), sg[h], rate=X.ratetb), P.run(X, P.mb1(X), sg[h], rate=X.ratetb)))
    a = P.lsum(s)
    print(f"(a) резерв в векселях, до 2025-12: Σ {a:+.1f} → {'да' if a >= 4 else 'нет'}")
    okall &= a >= 4
    # (b) старый протокол mt4
    o2 = P.M.gstat(MM, cand, P.mb1)
    print(f"(b) старый протокол mt4 (2000–13 / 2013–26): {P.M.gfmt(o2)} → {'да' if o2['h1'] >= 0 and o2['h2'] >= 0 else 'нет'}")
    okall &= o2["h1"] >= 0 and o2["h2"] >= 0
    # (c) недельное
    ow = P.check(MM, o1w(), None, P.DSEL, P.END25)
    kw, why = P.ok(ow)
    print(f"(c) недельное исполнение: {P.fmt(ow)} → {'да' if kw else 'нет: ' + why}")
    okall &= kw
    # (d) к Q2д
    q2d = lambda X: B.q2d(D, X)  # noqa: E731
    r = {}
    for nm, fn in (("mb1", P.mb1), ("О1-AuAg", cand)):
        oq = P.check(MM, fn, q2d, P.DSEL, P.END25, starts=False, eps=False)
        r[nm] = oq["sum"]
        print(f"(d) {nm} к Q2д до 2025-12: {P.fmt(oq, short=True)}")
    print(f"    монотонно: {'да' if r['О1-AuAg'] > r['mb1'] > 0 else 'нет'}")
    okall &= r["О1-AuAg"] > r["mb1"] > 0
    # (e) точность
    for nm, fn in (("mb1", P.mb1), ("О1-AuAg", cand)):
        Pm = {}
        for k in AUAG:
            X = MM[k]
            sg, e = P.segs(X, P.END25)
            rr = P.M.dsim(X.c, fn(X), sg["full"][0], e, 0, X.rate0, 0.001)
            Pm[k] = B.precision(X.c, rr[1], X.t, sg["full"][0], e, 252, 504, 63)
        ag = B.agg_prec(Pm)
        print(f"(e) {nm}: {B.fprec2(Pm)}")
    okall &= ag["vsdca"] <= -10
    print(f"\nH9: {'подтверждена — О1-AuAg как опция' if okall else 'не подтверждена'}")
    print("\nИТОГ К ДНЕВНОМУ DCA, % (2005–15 / 2016–25 / 2005–25 | весь ряд: 2016–26 / 2005–26 / 2008-06–26 / 2000–26):")
    for nm, fn in (("Q2д", q2d), ("mb1", P.mb1), ("О1-AuAg", cand)):
        row = []
        for k in P.DSEL + P.DEXAM:
            X = MM[k]
            sg, e = P.segs(X, P.END25)
            sf, _ = P.segs(X)
            p = fn(X)
            v = [P.run(X, p, sg["A"]), P.run(X, p, sg["B"]), P.run(X, p, sg["full"]), P.run(X, p, sf["B"]), P.run(X, p, sf["full"]), P.run(X, p, sf["08"]), P.run(X, p, sf["all"])]
            row.append(f"{P.NAME[k][:3]} " + "/".join("—" if not np.isfinite(x) else f"{x:+.0f}" for x in v[:3]) + " | " + "/".join("—" if not np.isfinite(x) else f"{x:+.0f}" for x in v[3:]))
        print(f"  {nm}: " + "; ".join(row))


if __name__ == "__main__":
    main()
