"""Круг 6 mop: вол растёт с ценой → продавать; переход перегрева 20 → 50% по вол. Запуск: python3 app/mop_r6.py (лог scratchpad/mop/r6.txt)"""
import numpy as np
import pandas as pd

import metals_agent2_lib as A
import metals_agent_lib as L
import mop_lib as P
from metals_agent3_loop5 import cool
from mop_r2 import own_iv


def s4(x, y, s):
    fd = None

    def f(X):
        p = P.mb1(X)
        iv, _, _ = own_iv(X)
        ivs = pd.Series(iv)
        d63 = (ivs / ivs.shift(63) - 1).values * 100
        r63 = P.M.ret(X.c, 63)
        hi = pd.Series(X.c).rolling(252, min_periods=200).max().values
        with np.errstate(invalid="ignore"):
            m = np.nan_to_num((d63 >= x) & (r63 >= y) & (X.c >= 0.95 * hi)).astype(bool) & (p >= 0) & (p <= 1.0)
        fdd = 1 - (1 - s) ** (1 / 21)
        q = p.copy()
        q[m] = -fdd
        return q
    return f


_MV = {}


def mvol(MM):
    """Средний за месяц перцентиль своей вол → {металл: pd.Series по периодам}."""
    if not _MV:
        for k in P.DSEL + P.DEXAM:
            X = MM[k]
            _, _, pc = own_iv(X)
            s = pd.Series(pc, index=X.t).dropna()
            m = s.resample("ME").mean()
            m.index = m.index.to_period("M")
            _MV[k] = m
    return _MV


def s5(MM, p_hi=None, p_lo=None):
    mv = mvol(MM)

    def r3v(d):
        p = A.r3(d, hot2=0.5)
        hot = (np.nan_to_num(A.feat(d, A.P3)) > 1.81) & (np.nan_to_num(A.feat(d, A.Y1)) > 86.0)
        v = mv.get(d["key"])
        if v is None:
            return p
        vm = v.reindex(pd.DatetimeIndex(d["t"]).to_period("M")).values
        rn = L.runs(hot)
        if p_hi is not None:
            p = np.where(hot & (rn == 1) & (np.nan_to_num(vm) > p_hi), np.minimum(p, -0.5), p)
        if p_lo is not None:
            top = d["tn3"] >= d["nt"] - 1
            p = np.where(hot & (rn >= 2) & np.isfinite(vm) & (vm < p_lo) & ~top, np.maximum(p, -0.2), p)
        return p.astype(np.float64)
    return P.mbm(cool(r3v, 0.2, 24))


def main():
    P.tee("r6.txt")
    D, DD, MM = P.load()
    print("=== S4 вол за 63 дн. ≥ +x%, цена ≥ +y%, у максимума → продавать s/мес. ===")
    for s in (0.1, 0.2):
        for y in (10, 20):
            for x in (20, 30, 40):
                P.both(MM, s4(x, y, s), f"x {x}%, y {y}%, s {s:.0%}")
    print("\n=== S5 первый месяц перегрева при перцентиле вол > p → сразу 50% ===")
    for ph in (0.6, 0.7, 0.8):
        P.both(MM, s5(MM, p_hi=ph), f"p > {ph}")
    print("\n=== S5b перегрев 2+ мес. при перцентиле вол < p → остаться на 20% ===")
    for pl in (0.3, 0.4):
        P.both(MM, s5(MM, p_lo=pl), f"p < {pl}")
    for k in ("silver", "palladium"):
        print(f"  {P.NAME[k]}: перцентиль вол по месяцам перегрева: " + ", ".join(f"{str(i)}: {v:.2f}" for i, v in mvol(MM)[k].items()
                                                                       if str(i) in ("2010-11", "2010-12", "2011-02", "2011-03", "2011-04", "2011-05", "2011-06", "2011-07", "2011-08", "2025-12", "2026-01", "2026-02", "2026-03")))


if __name__ == "__main__":
    main()
