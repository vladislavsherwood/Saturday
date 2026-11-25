"""Круг 2 mop: «малая серия» вне макро-серии на опционной капитуляции. Запуск: python3 app/mop_r2.py (лог scratchpad/mop/r2.txt)"""
import numpy as np
import pandas as pd

import mop_lib as P

OWN = {"gold": "^GVZ", "silver": "VXSLV", "platinum": "^GVZ", "copper": "^OVX", "palladium": "^GVZ", "aluminum": "^OVX"}


def own_iv(X, fresh=10):
    """Своя подразумеваемая вол (серебро: VXSLV, в разрыве — GVZ), её SMA50 и перцентиль за год по дням металла."""
    V = P.vol()
    s = V[OWN[X.k]]
    iv, sma, pc = P.on(s, X), P.on(s.rolling(50, min_periods=40).mean(), X), P.on(P.pctl(s), X)
    last = P.on(pd.Series(s.index, index=s.index), X)
    age = (X.t.values - pd.to_datetime(last).values) / np.timedelta64(1, "D")
    bad = ~(age <= fresh)
    if X.k == "silver":
        g = V["^GVZ"]
        iv = np.where(bad, P.on(g, X), iv)
        sma = np.where(bad, P.on(g.rolling(50, min_periods=40).mean(), X), sma)
        pc = np.where(bad, P.on(P.pctl(g), X), pc)
    else:
        iv, sma, pc = (np.where(bad, np.nan, a) for a in (iv, sma, pc))
    return iv, sma, pc


_F = {}


def feats(X):
    if X.k in _F:
        return _F[X.k]
    D, DD, MM = P.load()
    V = P.vol()
    iv, sma, pc = own_iv(X)
    hi = pd.Series(X.c).rolling(252, min_periods=200).max().values
    dd = (X.c / hi - 1) * 100
    vix, vix3, gvz = P.on(V["^VIX"], X), P.on(V["^VIX3M"], X), P.on(V["^GVZ"], X)
    bn = P.M.monthly_on_days(pd.Series(D[X.k]["bn3"], index=pd.DatetimeIndex(D[X.k]["t"])), X.t)
    _F[X.k] = dict(spike=iv / sma, pc=pc, dd=dd, inv=vix / vix3, gmv=gvz - vix, bn=bn)
    return _F[X.k]


def mini(cond, g=0.5, m0=0):
    gd = 1 - (1 - g) ** (1 / 21)

    def f(X):
        p = P.mb1(X)
        F = feats(X)
        m = np.nan_to_num(cond(F)).astype(bool) & (p >= 0) & (p <= 1.0)
        if m0 > 0:
            m &= np.nan_to_num(F["bn"]) >= m0
        q = p.copy()
        q[m] = 1.0 + gd
        return q
    return f


CONDS = {
    "C1 вол/SMA50 > 1,2": lambda F: F["spike"] > 1.2,
    "C1 вол/SMA50 > 1,3": lambda F: F["spike"] > 1.3,
    "C1 вол/SMA50 > 1,5": lambda F: F["spike"] > 1.5,
    "C2 пц > 0,9 и цена ≤ −15% от макс.": lambda F: (F["pc"] > 0.9) & (F["dd"] <= -15),
    "C2 пц > 0,9 и цена ≤ −25% от макс.": lambda F: (F["pc"] > 0.9) & (F["dd"] <= -25),
    "C3 VIX/VIX3M > 1,0": lambda F: F["inv"] > 1.0,
    "C3 VIX/VIX3M > 1,05": lambda F: F["inv"] > 1.05,
    "C3 VIX/VIX3M > 1,1": lambda F: F["inv"] > 1.1,
    "C4 GVZ − VIX < −5": lambda F: F["gmv"] < -5,
    "C4 GVZ − VIX < −8": lambda F: F["gmv"] < -8,
    "C4 GVZ − VIX < −12": lambda F: F["gmv"] < -12,
    "C5 VIX/VIX3M > 1 и вол/SMA50 > 1,3": lambda F: (F["inv"] > 1.0) & (F["spike"] > 1.3),
}


def where(MM, fn, keys=P.DSEL):
    """Где правило тратит резерв: металл → годы (сумма докупок резерва, $, до 2025-12, старт 2005)."""
    out = []
    for k in keys:
        X = MM[k]
        p, p0 = fn(X), P.mb1(X)
        sg, e = P.segs(X, P.END25)
        r = P.M.dsim(X.c, p, sg["full"][0], e, 0, X.rate0, 0.001)
        r0 = P.M.dsim(X.c, p0, sg["full"][0], e, 0, X.rate0, 0.001)
        d = r[1] - r0[1]
        yrs = pd.Series(d, index=X.t).groupby(X.t.year).sum()
        yrs = yrs[yrs.abs() > 50]
        out.append(f"{P.NAME[k][:3]}: " + ",".join(f"{y}:{v:+.0f}" for y, v in yrs.items()))
    return "; ".join(out)


def main():
    P.tee("r2.txt")
    D, DD, MM = P.load()
    passed = []
    for g in (0.5, 0.8):
        for m0 in (0, 2):
            print(f"\n=== g = {g:.0%}/мес., макро-маркеров дна ≥ {m0} ===")
            for nm, cond in CONDS.items():
                fn = mini(cond, g, m0)
                k25, o25, of = P.both(MM, fn, nm)
                if g == 0.5 and m0 == 0:
                    print(f"  {'':<46}          | где (докупки резерва к mb1, $): {where(MM, fn)}")
                if k25:
                    passed.append((g, m0, nm, o25["sum"]))
    print("\nПрошли (до 2025-12):", passed if passed else "нет")


if __name__ == "__main__":
    main()
