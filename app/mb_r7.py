"""Круг 7 mb: H7a — копить взносы при «почти дне» (маркеров дна ≥ b0 вне серии) и выпускать в серию / по окончании / через N мес.;
H7b — лестница уровней внутри серии. Запуск: python3 app/mb_r7.py"""
import itertools

import numpy as np
import pandas as pd

import mb_lib as B
import mt4_lib as M


def prep_m(d, b0, N):
    """Месячные (plan, defer, release) для H7a."""
    p = B.Q2M(d).copy()
    ser = p > 1.0
    cond = (d["bn3"] >= b0) & ~ser & (p == 1.0)
    n = len(p)
    defer = np.zeros(n, bool)
    release = np.zeros(n, bool)
    run = 0
    for i in range(n):
        if cond[i] and run < N:
            defer[i] = True
            run += 1
        else:
            if run > 0:
                release[i] = True
            run = 0 if not cond[i] else run
    return p, defer, release


def to_days(D, X, arrs):
    """Месячные defer/release → дни следующего месяца (defer — все дни; release — первый торговый день)."""
    d = D[X.k]
    p, df, rl = arrs
    pd_ = M.mmap(p, d["t"], X.t, True)
    per = X.t.to_period("M")
    sm = pd.Series(df, index=pd.DatetimeIndex(d["t"]).to_period("M"))
    sr = pd.Series(rl, index=pd.DatetimeIndex(d["t"]).to_period("M"))
    dfd = sm.reindex(per - 1).fillna(False).values.astype(bool)
    first = np.r_[True, per[1:] != per[:-1]]
    rld = sr.reindex(per - 1).fillna(False).values.astype(bool) & first
    return pd_, dfd, rld


def gcheck(MM, fn, ref, keys=B.DSEL):
    """Как B.dcheck2, но fn может вернуть (план, defer, release)."""
    o = {"cells": {}, "lag1": [], "lag2": [], "ep": {}, "starts": []}
    for k in keys:
        X = MM[k]
        r, r0 = M._norm(fn(X), X.n), M._norm(ref(X), X.n)
        sg = B.dsegs(X)
        for h, seg in sg.items():
            o["cells"][(k, h)] = B.rel(M.grun(X, r, seg), M.grun(X, r0, seg))
            o["lag1"].append(B.rel(M.grun(X, r, seg, 1), M.grun(X, r0, seg, 1)))
            o["lag2"].append(B.rel(M.grun(X, r, seg, 2), M.grun(X, r0, seg, 2)))
            for nm, (a, b) in B.EPIS2.items():
                w = (X.t >= a) & (X.t <= b)
                pe = np.where(w, r0[0], r[0]); de = np.where(w, r0[1], r[1])
                fst = np.r_[w[:1], w[1:] & ~w[:-1]]
                re = np.where(w, r0[2], r[2]) | fst
                o["ep"].setdefault(nm, []).append(B.rel(M.grun(X, (pe, de, re), seg), M.grun(X, r0, seg)))
        for y in range(2005, 2021):
            a0 = B._ix(X.t, f"{y}-01-01")
            o["starts"].append(B.rel(M.grun(X, r, (a0, X.n)), M.grun(X, r0, (a0, X.n))))
    v = np.array(list(o["cells"].values()))
    o.update({"n": len(v), "ok": int((v >= -0.5).sum()), "worst": float(v.min()), "sum": B.lsum(v),
              "A": B.lsum([o["cells"][(k, "A")] for k in keys]), "B": B.lsum([o["cells"][(k, "B")] for k in keys]),
              "l1": B.lsum(o["lag1"]), "l2": B.lsum(o["lag2"]), "epsum": {nm: B.lsum(v) for nm, v in o["ep"].items()},
              "share": float((np.array(o["starts"]) >= -0.5).mean() * 100)})
    return o


def mcheck_g(D, fn, keys=B.MSEL):
    """Месячный протокол для (план, defer, release) через dsim2 на месячных ценах; против Q2 и вторичная."""
    o = {"cells": {}, "lag1": [], "sec82": {}, "sec65": {}}
    for k in keys:
        d = D[k]
        c = d["c"].astype(np.float64)
        r = fn(d)
        p0 = B.Q2M(d)
        z = np.zeros(len(c), bool)
        rt = np.zeros(len(c))
        sg = B.msegs(d)
        run = lambda rr, seg, lag=0: M.dsim2(c, np.asarray(rr[0], np.float64), rr[1], rr[2], seg[0], seg[1], lag, rt, 0.001)  # noqa: E731
        for h in ("A", "B"):
            o["cells"][(k, h)] = B.rel(run(r, sg[h]), run((p0, z, z), sg[h]))
            o["lag1"].append(B.rel(run(r, sg[h], 1), run((p0, z, z), sg[h], 1)))
        for key, h in (("sec82", "82"), ("sec65", "65")):
            if sg[h][1] - sg[h][0] > 24:
                o[key][k] = B.rel(run(r, sg[h]), run((p0, z, z), sg[h]))
    v = np.array(list(o["cells"].values()))
    o.update({"n": len(v), "ok": int((v >= -0.5).sum()), "worst": float(v.min()), "sum": B.lsum(v),
              "A": B.lsum([o["cells"][(k, "A")] for k in keys]), "B": B.lsum([o["cells"][(k, "B")] for k in keys]), "l1": B.lsum(o["lag1"])})
    for key in ("sec82", "sec65"):
        vv = np.array(list(o[key].values()))
        o[key + "_sum"] = B.lsum(vv)
        o[key + "_worst"] = float(vv.min())
    return o


def ladder(D, s, f):
    def fn(X):
        p = B.q2d(D, X)
        ser = p > 1.0
        g = np.where(ser, B.gday(0.25), 0.0)
        for a, b in B.runs_of(ser):
            p0 = X.c[a]
            done = set()
            for i in range(a, b + 1):
                for lvl in range(1, 5):
                    if lvl not in done and X.c[i] <= p0 * (1 - s * lvl):
                        done.add(lvl)
                        g[i] = 1 - (1 - g[i]) * (1 - f)
            g[b] = 0.999
        return B.reshape(p, g)
    return fn


def main():
    B.tee("r7.txt")
    D, DD, MM = B.load()
    ref = lambda X: B.q2d(D, X)  # noqa: E731
    print("=== H7a: копить взносы при «почти дне» ===")
    ok = {}
    for b0, N in itertools.product((3, 4), (6, 12)):
        fm = lambda d, b0=b0, N=N: prep_m(d, b0, N)  # noqa: E731
        fd = lambda X, fm=fm: to_days(D, X, fm(D[X.k]))  # noqa: E731
        od = gcheck(MM, fd, ref)
        okd, wd = B.dok2(od)
        om = mcheck_g(D, fm)
        okm, wm = B.mok2(om)
        sec, gross, ws = B.msec(om)
        nmon = sum(int(fm(D[k])[1][B._ix(D[k]["t"], B.A0):].sum()) for k in B.MSEL)
        ok[(b0, N)] = okd and okm and not gross
        print(f"  b0 {b0}, N {N}: месяцев «копить» 2005–26 по 8 металлам {nmon}\n    дневная: {B.dfmt2(od)} → {'✓' if okd else '✗ ' + wd}"
              f"\n    месячная: {B.mfmt2(om)} → {'✓' if okm else '✗ ' + wm}{'' if sec else ' [втор.: ' + ws + ']'}")
    print("  прошли: " + str([k for k, v in ok.items() if v]))
    print("\n=== H7b: лестница в серии (25%/мес. + докупка f на каждом шаге s ниже цены начала серии; конец серии — всё) ===")
    for s, f in itertools.product((0.05, 0.10), (0.2, 0.33)):
        fd = ladder(D, s, f)
        od = B.dcheck2(MM, fd, ref)
        okd, wd = B.dok2(od)
        ep = B.ep_sum(B.ep_all_daily(MM, fd, ref))
        print(f"  s {s:.0%}, f {f:.0%}: {B.dfmt2(od)} | эп.: {B.fep(ep)} → {'✓' if okd and ep['share'] >= 60 else '✗ ' + wd}")
        print(f"    точность 2005–26: {B.fprec2(B.dprec2(MM, fd))}")


if __name__ == "__main__":
    main()
