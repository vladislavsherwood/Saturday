"""Круг 3 mop: «акции боятся сильнее металла» — своя вол − VIX, контроль VIX / реализованной вол. Запуск: python3 app/mop_r3.py (лог scratchpad/mop/r3.txt)"""
import numpy as np
import pandas as pd

import mop_lib as P
from mop_r2 import own_iv

PREC = ("gold", "silver", "platinum", "palladium")
_F = {}


def feats(X):
    if X.k in _F:
        return _F[X.k]
    V = P.vol()
    iv, sma, pc = own_iv(X)
    vix = P.on(V["^VIX"], X)
    gvz = P.on(V["^GVZ"], X)
    spx = P.on(V["^GSPC"], X)          # S&P на дни металла (для реализованной вол — ряд S&P по своим дням)
    s = V["^GSPC"]
    rvs = pd.Series(P.rvol(s.values), index=s.index)
    rvspx = P.on(rvs, X)
    rv = P.rvol(X.c)
    _F[X.k] = dict(own_vix=iv - vix, gvz_vix=gvz - vix, gvz_r=gvz / vix, vix=vix, rv_spx=rv - rvspx, rv_vix=rv - vix, spx=spx)
    return _F[X.k]


def mini(cond, g=0.5, only=None):
    gd = 1 - (1 - g) ** (1 / 21)

    def f(X):
        p = P.mb1(X)
        if only is not None and X.k not in only:
            return p
        F = feats(X)
        with np.errstate(invalid="ignore"):
            m = np.nan_to_num(cond(F)).astype(bool) & (p >= 0) & (p <= 1.0)
        q = p.copy()
        q[m] = 1.0 + gd
        return q
    return f


def pre08(MM, fn, keys=P.DSEL):
    """Вторичная: 2000-09…2008-05, старт с нуля, к mb1."""
    out = {}
    for k in keys:
        X = MM[k]
        e = P._ix(X.t, P.C08)
        out[k] = P.rel(P.run(X, fn(X), (0, e)), P.run(X, P.mb1(X), (0, e)))
    return out


def grid(MM, title, mk, ys, gs=(0.33, 0.5, 0.8), pre=False):
    print(f"\n=== {title} ===")
    res = {}
    for g in gs:
        for y in ys:
            fn = mk(y, g)
            o = P.check(MM, fn, None, P.DSEL, P.END25)
            k, why = P.ok(o)
            of = P.check(MM, fn, None, P.DSEL, None, starts=False)
            res[(g, y)] = (k, o["sum"], of["sum"])
            s = f"  g {g:.0%} y {y:<5} дн.{o['nd']:5d} | ≤2025: {P.fmt(o)} → {'✓' if k else '✗ ' + why[:120]} | весь Σ {of['sum']:+.1f}"
            if pre:
                pr = pre08(MM, fn)
                s += " | 2000–08: " + " ".join(f"{P.NAME[q][:3]} {v:+.1f}" for q, v in pr.items()) + f" Σ {P.lsum(list(pr.values())):+.1f}"
            print(s)
    print("  плато (✓ при g, y):", {g: [y for y in ys if res[(g, y)][0]] for g in gs})
    return res


def main():
    P.tee("r3.txt")
    D, DD, MM = P.load()
    R = {}
    R["own"] = grid(MM, "H3a своя вол − VIX < −y (медь — OVX)", lambda y, g: mini(lambda F: F["own_vix"] < -y, g), (6, 8, 10, 12, 14, 16))
    R["vix"] = grid(MM, "H3b VIX > x", lambda y, g: mini(lambda F: F["vix"] > y, g), (25, 30, 35, 40))
    R["ratio"] = grid(MM, "H3b GVZ / VIX < r", lambda y, g: mini(lambda F: F["gvz_r"] < y, g), (0.6, 0.7, 0.8))
    R["rv_spx"] = grid(MM, "H3c реализ. вол металла − реализ. вол S&P < −y", lambda y, g: mini(lambda F: F["rv_spx"] < -y, g), (5, 10, 15, 20), pre=True)
    R["rv_vix"] = grid(MM, "H3c реализ. вол металла − VIX < −y", lambda y, g: mini(lambda F: F["rv_vix"] < -y, g), (6, 8, 10, 12, 14, 16), pre=True)
    R["prec"] = grid(MM, "справка: GVZ − VIX < −y только драгметаллы (подобрано после круга 2)", lambda y, g: mini(lambda F: F["gvz_vix"] < -y, g, PREC), (6, 8, 10, 12, 14, 16))
    print("\nЛучшие (✓, до 2025):")
    for nm, r in R.items():
        best = sorted([(v[1], k) for k, v in r.items() if v[0]], reverse=True)[:3]
        print(f"  {nm}: " + ", ".join(f"g {k[0]:.0%} y {k[1]} Σ {s:+.1f}" for s, k in best))


if __name__ == "__main__":
    main()
