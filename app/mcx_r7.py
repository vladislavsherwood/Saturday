"""Круг 7 mcx: устойчивость «перегрева по σ» (S1): плато, формы откупа, hv2, экзамен, комиссия, без каждой вершины. Запуск: python3 app/mcx_r7.py"""
import numpy as np

import mcx_lib as C

TOPS = {"2006": ("2006-01-01", "2006-12-31"), "2008": ("2007-06-01", "2008-07-31"), "2011": ("2010-10-01", "2011-09-30"),
        "2020": ("2020-07-01", "2020-09-30"), "2024–25": ("2024-01-01", "2025-12-31")}


def heat(DD, z=3.5, s=0.05, back="B1", hv=None):
    def fn(X):
        f = C.feats(X, DD)
        n = X.n
        sd = np.nan_to_num(f["sd250"], nan=1.0)
        sv = np.log(np.nan_to_num(f["ma200"], nan=1.0)) > z * sd * np.sqrt(50)
        ss = s
        if hv is not None:
            ss = np.where(np.nan_to_num(f["hv"]) > 30, min(s * hv, 1.0), s)
        ts = np.where(sv, ss, 0.0)
        fear = np.nan_to_num(f["fg"], nan=50) < 25
        hi = X.c >= C.rmax(X.c, 126)
        below = np.nan_to_num(f["ma50"], nan=1.0) < 1.0
        if back == "B1":
            tb = np.where(~sv & fear, 0.10, np.where(~sv & hi, 0.05, 0.0))
        elif back == "B3":
            tb = np.where(~sv & below, 0.05, 0.0)
        elif back == "B4":
            tb = np.where(~sv & fear, 0.10, np.where(~sv & (hi | below), 0.05, 0.0))
        else:
            tb = np.zeros(n)
        return ts, tb, np.zeros(n)
    return fn


def mk(DD, **kw):
    back = kw.get("back", "B1")
    return C.Layer(heat(DD, **kw), tomac=1 if back == "B2" else 0)


def extra(L, keys=C.DSEL):
    """комиссия 0,5%, векселя, без каждой вершины."""
    D, DD, MM, base = C.load()
    out = {}
    for nm, kw in (("комиссия 0,5%", dict(fee=0.005)), ("векселя", dict(rate="tb"))):
        v = []
        for k in keys:
            X = MM[k]
            rt = X.ratetb if kw.get("rate") == "tb" else X.rate0
            fee = kw.get("fee", 0.001)
            for seg in C.segs(X).values():
                v.append(C.rel(C.run(X, base, L, seg, 0, rt, fee)[0], C.run(X, base, C.NULL, seg, 0, rt, fee)[0]))
        out[nm] = C.lsum(v)
    for nm, (a, b) in TOPS.items():
        v = []
        for k in keys:
            X = MM[k]
            w = (X.t >= a) & (X.t <= b)
            for seg in C.segs(X).values():
                v.append(C.rel(C.run(X, base, L, seg, mask=w)[0], C.run(X, base, C.NULL, seg)[0]))
        out["без " + nm] = C.lsum(v)
    return out


def main():
    C.tee("r7.txt")
    D, DD, MM, base = C.load()
    print("=== (а) плато z × s (откуп B1) ===")
    for z in (3.25, 3.5, 3.75, 4.0):
        for s in (0.03, 0.05, 0.08):
            o = C.report(f"z {z} s {s:.0%}", mk(DD, z=z, s=s), prec=False)
    print("\n=== (б) формы откупа (z 3,5, s 5%) и (в) hv2 ===")
    for back in ("B1", "B2", "B3", "B4"):
        for hv in (None, 1.5):
            L = mk(DD, z=3.5, s=0.05, back=back, hv=hv)
            o = C.report(f"откуп {back}{' + hv2 ×1,5' if hv else ''}", L)
            ex = C.check(L, ["palladium"], starts=False)
            e = extra(L)
            print(f"    экзамен палладий: A {ex['cells'].get(('palladium', 'A'), np.nan):+.1f}, B {ex['cells'].get(('palladium', 'B'), np.nan):+.1f}; "
                  + "; ".join(f"{k} {v:+.1f}" for k, v in e.items()))
            print("    " + C.fafter(o) + f"; палладий после решения {ex['full26']['palladium']:+.1f}")
    # где продавал (z 3,5, s 5%)
    print("\nЭпизоды продаж (z 3,5): первый–последний день, цена, максимум следующих 120 дн., минимум следующих 250 дн.")
    for k in C.DSEL + ["palladium"]:
        X = MM[k]
        ts, tb, tk, tm = mk(DD, z=3.5, s=0.05).arrays(X)
        d = np.asarray(X.t, "datetime64[D]").astype(np.int64)
        idx = np.where(ts > 0)[0]
        if not len(idx):
            continue
        br = np.r_[0, np.where(np.diff(d[idx]) > 10)[0] + 1, len(idx)]
        rows = []
        for a, b in zip(br[:-1], br[1:]):
            i0, i1 = idx[a], idx[b - 1]
            mx = X.c[i0: min(X.n, i1 + 121)].max()
            mn = X.c[i1: min(X.n, i1 + 251)].min()
            rows.append(f"{str(X.t[i0])[:10]}…{str(X.t[i1])[:10]} ({b - a} дн.) {X.c[i0]:.4g}→ макс. {mx:.4g}, мин. {mn:.4g}")
        print(f"  {C.NAME[k]}: " + "; ".join(rows))


if __name__ == "__main__":
    main()
