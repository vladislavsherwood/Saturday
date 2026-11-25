"""Круг 5 mbx: капитуляция добытчиков — диагностика и «малая серия». Запуск: python3 app/mbx_r5.py"""
import numpy as np

import mbx_lib as X
from mbx_r1 import BOTS, fwd

SYM = {"gold": "^XAU", "silver": "^XAU", "platinum": "^XAU", "palladium": "^XAU", "copper": "COPX"}
ALT = {"gold": "GDX", "silver": "SIL"}
SIG = [("ridx", 0.1), ("ridx", 0.2), ("mdd", -0.5), ("mdd", -0.6), ("rdd", -0.4)]
EPO = [("1984–98", "1984-01-01", "1999-01-01"), ("1999–04", "1999-01-01", "2005-01-01"), ("2005–15", "2005-01-01", "2016-01-01"),
       ("2016–23", "2016-01-01", "2024-01-01")]


def mcon(d, k, nm, thr, alt=False):
    sym = (ALT if alt else SYM).get(k)
    if sym is None:
        return np.zeros(len(d["c"]), bool)
    v = X.miners_monthly(d, sym)[nm]
    return np.nan_to_num(v, nan=9.0) <= thr


def small_mn(nm, thr, g, cool=True, retr=None):
    def f(d):
        p0 = X.Q2M(d)
        m = mcon(d, d["key"], nm, thr)
        if retr is not None:
            m = m & X.mcond(d, "retr", retr)
        ok = (p0 == 1.0) | ((p0 == 0.0) if cool else False)
        return np.where(ok & m, 1.0 + g, p0)
    return f


def main():
    X.tee("r5.txt")
    D, DD, MM = X.load()
    for k in D:
        if not k.startswith("_"):
            D[k]["key"] = k
    print("=== H5a: избыток роста металла за 24 мес. (12 мес.) после сигнала добытчиков, п.п. [месяцев]; XAU для драгметаллов, COPX для меди ===")
    for alt in (False, True):
        for nm, thr in SIG:
            row = []
            for ep, a, b in EPO:
                e24, e12, cnt = [], [], 0
                for k in (ALT if alt else SYM):
                    d = D[k]
                    c, t = d["c"], d["t"]
                    w = (t >= a) & (t < b) & np.isfinite(X.miners_monthly(d, (ALT if alt else SYM)[k])["ridx"])
                    m = mcon(d, k, nm, thr, alt) & w
                    for h, acc in ((24, e24), (12, e12)):
                        f = fwd(c, t, h)
                        v = f[m]
                        acc.extend(list(v[np.isfinite(v)] - np.nanmean(f[w])) if w.any() else [])
                    cnt += int(m.sum())
                row.append((ep, np.mean(e24) if e24 else np.nan, np.mean(e12) if e12 else np.nan, cnt))
            r = {ep: x for ep, *x in row}
            ok = r["2005–15"][0] > 5 and r["2016–23"][0] > 5 and (np.isnan(r["1984–98"][0]) or r["1984–98"][0] >= 0)
            print(f"  {'GDX/SIL' if alt else 'XAU/COPX'} {nm} ≤ {thr}: " + " | ".join(f"{ep} {a:+6.1f} ({b:+5.1f}) [{n}]" for ep, a, b, n in row) + ("  ✓" if ok else ""))
    print("\n=== на доньях и на спуске 2013-01…2015-06 ===")
    hit = {s: 0 for s in SIG}
    npair = 0
    for k in SYM:
        d = D[k]
        c, t = d["c"], d["t"]
        o = X.miners_monthly(d, SYM[k])
        row = []
        for bn, (a, b) in BOTS.items():
            w = np.where((t >= a) & (t <= b))[0]
            j = w[int(np.argmin(c[w]))]
            if not np.isfinite(o["ridx"][j]):
                continue
            npair += 1
            for s in SIG:
                if mcon(d, k, *s)[max(0, j - 3): j + 4].any():
                    hit[s] += 1
            row.append(f"{bn}: ridx {o['ridx'][j]:.2f}, rdd {o['rdd'][j]*100:+.0f}%, mdd {o['mdd'][j]*100:+.0f}%")
        w = (t >= "2013-01-01") & (t <= "2015-06-30")
        pre = {f"{s[0]}≤{s[1]}": int((mcon(d, k, *s) & w).sum()) for s in SIG}
        print(f"  {X.NAME[k]:8s} " + "; ".join(row))
        print(f"           спуск 2013-01…2015-06 (30 мес.): {pre}; сейчас ridx {o['ridx'][-1]:.2f}, rdd {o['rdd'][-1]*100:+.0f}%, mdd {o['mdd'][-1]*100:+.0f}%")
    print("  доля доньев (±3 мес.): " + ", ".join(f"{s[0]}≤{s[1]} {hit[s]}/{npair}" for s in SIG))

    print("\n=== H5b: «малая серия» по добытчикам (g 10%) ===")
    Bn = X.Bench(D, DD, MM)
    mref = X.mwrap(X.Q2M, DD)
    for nm, thr in SIG:
        for cool in (True, False):
            for rt in (None, 0.5):
                name = f"добытчики {nm}≤{thr}{'' if cool else ' ′'}{' + откат≥50%' if rt else ''}"
                fn = small_mn(nm, thr, 0.1, cool, rt)
                o = X.dcheck3(Bn, fn)
                ok, why = X.dok3(o)
                om = X.mcheck3(D, X.mwrap(fn, DD), mref)
                okm, whym = X.mok3(om)
                print(f"  {name:36s} дн. {o['sum']:+6.1f} (A {o['A']:+.1f} B {o['B']:+.1f}, {o['ok']}/8) | мес. {om['sum']:+6.1f} ({om['ok']}/16) | "
                      f"82 {om['sec82_sum']:+6.1f} | вся {om['all_sum']:+6.1f} | после реш. {o['f26sum']:+6.1f} | "
                      + " ".join(f"{X.NAME[k][:3]} {o['cells'][(k, 'A')]:+.1f}/{o['cells'][(k, 'B')]:+.1f}" for k in X.DSEL)
                      + (" ✓" if ok and okm else f" ✗ {why}"[:90]))


if __name__ == "__main__":
    main()
