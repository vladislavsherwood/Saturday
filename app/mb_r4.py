"""Круг 4 mb: H4a — отложенная трата до разворота цены внутри серии (panicx); H4b — ускорение на панике внутри серии; месячный аналог H4a.
Запуск: python3 app/mb_r4.py"""
import itertools

import numpy as np
import pandas as pd

import mb_lib as B

NS, XS, MS = (20, 50, 100), (0.03, 0.05, 0.08), (1.0, 2.0)
YS, KS = (0.05, 0.10, 0.15), (2.0, 3.0)


def defer_daily(D, N, x, m):
    def f(X):
        p = B.q2d(D, X)
        mn = pd.Series(X.c).rolling(N, min_periods=1).min().values
        falling = X.c <= mn * (1 + x)
        g = B._defer(p > 1.0, falling, ~falling, B.gday(0.5), m, True, 0)
        return B.reshape(p, g)
    return f


def panic_daily(D, y, k):
    def f(X):
        p = B.q2d(D, X)
        r20 = X.c / np.r_[np.full(20, np.nan), X.c[:-20]] - 1
        pan = np.nan_to_num(r20) <= -y
        g = np.where(pan, 1 - (1 - B.gday(0.5)) ** k, B.gday(0.5))
        return B.reshape(p, g)
    return f


def defer_monthly(K, x, m):
    def f(d):
        p = B.Q2M(d).copy()
        c = d["c"]
        mn = pd.Series(c).rolling(K, min_periods=1).min().values
        falling = c <= mn * (1 + x)
        g = B._defer(p > 1.0, falling, ~falling, 0.5, m, True, 0)
        return B.reshape(p, g)
    return f


def main():
    B.tee("r4.txt")
    D, DD, MM = B.load()
    ref = lambda X: B.q2d(D, X)  # noqa: E731
    print("=== H4a: отложенная трата до разворота (дневная) ===")
    okmap, rows = {}, {}
    for N, x, m in itertools.product(NS, XS, MS):
        fd = defer_daily(D, N, x, m)
        o = B.dcheck2(MM, fd, ref)
        ok, why = B.dok2(o)
        ep = B.ep_sum(B.ep_all_daily(MM, fd, ref))
        ok2 = ok and ep["share"] >= 60 and ep["med"] >= 0
        okmap[(N, x, m)] = ok2
        rows[(N, x, m)] = (o, ep, fd)
        print(f"  N {N}, x {x:.0%}, m {m:.0f}: {B.dfmt2(o)} | эп.: {ep['share']:.0f}%, мед. {ep['med']:+.1f} → {'✓' if ok2 else '✗ ' + why}")
    good = []
    for key, ok in okmap.items():
        if not ok:
            continue
        N, x, m = key
        nb = [(NS[i], x, m) for i in (NS.index(N) - 1, NS.index(N) + 1) if 0 <= i < 3] + [(N, XS[i], m) for i in (XS.index(x) - 1, XS.index(x) + 1) if 0 <= i < 3]
        if all(okmap[k] for k in nb):
            good.append(key)
    print("  прошли с плато: " + (", ".join(map(str, good)) or "нет"))
    best = max(okmap, key=lambda k: rows[k][0]["sum"])
    o, ep, fd = rows[best]
    print(f"  лучший по сумме {best}: точность 2005–26 {B.fprec2(B.dprec2(MM, fd))}; Q2д: {B.fprec2(B.dprec2(MM, ref))}")
    for r in B.ep_all_daily(MM, fd, ref):
        print(f"     эпизод {B.NAME[r[0]]} {r[1]}: {r[2]:+.1f} (потрачено к 24 мес. {r[3]:.0%} / Q2д {r[4]:.0%})")

    print("\n=== H4b: ускорение на панике внутри серии (дневная) ===")
    for y, k in itertools.product(YS, KS):
        fd = panic_daily(D, y, k)
        o = B.dcheck2(MM, fd, ref)
        ok, why = B.dok2(o)
        ep = B.ep_sum(B.ep_all_daily(MM, fd, ref))
        print(f"  y {y:.0%}, ×{k:.0f}: {B.dfmt2(o)} | эп.: {ep['share']:.0f}%, мед. {ep['med']:+.1f} → {'✓' if ok else '✗ ' + why}")

    print("\n=== месячный аналог H4a (к Q2; 2005–26 + вторичная; эпизодный тест 68 серий) ===")
    for K, x, m in itertools.product((3, 6), XS, MS):
        fm = defer_monthly(K, x, m)
        o = B.mcheck2(D, fm, B.Q2M)
        ok, why = B.mok2(o)
        ep = B.ep_sum(B.ep_all_monthly(D, fm, B.Q2M))
        print(f"  K {K}, x {x:.0%}, m {m:.0f}: {B.mfmt2(o)} | эп.: {ep['share']:.0f}%, мед. {ep['med']:+.1f} → {'✓' if ok else '✗ ' + why}")


if __name__ == "__main__":
    main()
