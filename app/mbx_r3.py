"""Круг 3 mbx: «малая серия» по ценовому признаку металла (g резерва в месяц) и разовая лестница по глубине падения. Запуск: python3 app/mbx_r3.py"""
import numpy as np

import mbx_lib as X

FEATS = [("retr", 0.62), ("retr", 0.8), ("ddath", 0.5), ("ddath", 0.6), ("ma48", 0.85), ("ma48", 0.75), ("rsi", 35), ("rsi", 30), ("dd36", 0.4), ("dd36", 0.5)]


def small(nm, thr, g, cool=True):
    def f(d):
        p0 = X.Q2M(d)
        m = X.mcond(d, nm, thr)
        ok = (p0 == 1.0) | ((p0 == 0.0) if cool else False)
        return np.where(ok & m, 1.0 + g, p0)
    f.__name__ = f"small_{nm}{thr}_{g}_{cool}"
    return f


def ladder(fr, levels=(0.4, 0.5, 0.6)):
    def f(d):
        p0 = X.Q2M(d)
        dd = X.pfeat(d)["dd36"]
        c = d["c"]
        mx = X.rolling_max(c, 36)
        p = p0.copy()
        done = set()
        for i in range(len(p)):
            if c[i] >= mx[i] - 1e-12:
                done = set()
            for L_ in levels:
                if dd[i] <= -L_ and L_ not in done:
                    done.add(L_)
                    if p0[i] in (0.0, 1.0):
                        p[i] = 1.0 + fr
        return p
    return f


def main():
    X.tee("r3.txt")
    D, DD, MM = X.load()
    Bn = X.Bench(D, DD, MM)
    mref = X.mwrap(X.Q2M, DD)
    C = {}
    for nm, thr in FEATS:
        for g in (0.1, 0.2):
            for cool in (True, False):
                C[f"H3a{'′' if not cool else ''} {nm} {thr} g {g:.0%}"] = small(nm, thr, g, cool)
    for fr in (0.15, 0.25):
        C[f"H3b лестница −40/−50/−60% от макс. 36 мес., по {fr:.0%}"] = ladder(fr)
    passed = []
    rows = []
    for nm, fn in C.items():
        o = X.dcheck3(Bn, fn)
        ok, why = X.dok3(o)
        om = X.mcheck3(D, X.mwrap(fn, DD), mref)
        okm, whym = X.mok3(om)
        rows.append((nm, o, om, ok and okm))
        print(f"\n{nm}\n  дневная: {X.dfmt3(o)} → {'ПРОХОДИТ' if ok else 'нет: ' + why}")
        print(f"  месячная: {X.mfmt3(om)} → {'да' if okm else 'нет: ' + whym}")
        print(f"  после решения (2026): {X.dafter(o)}; месячная 2005–2026.10 {om['y26_sum']:+.1f}")
        if ok and okm:
            passed.append(nm)
    print("\nСВОДКА (дневная сумма / месячная сумма / втор. 82 / втор. 65 / вся история):")
    for nm, o, om, ok in rows:
        print(f"  {nm:45s} {o['sum']:+6.1f} (A {o['A']:+.1f} B {o['B']:+.1f}, {o['ok']}/8) | {om['sum']:+6.1f} ({om['ok']}/16) | {om['sec82_sum']:+6.1f} | {om['sec65_sum']:+6.1f} | {om['all_sum']:+6.1f}{'  ✓' if ok else ''}")
    print("прошли оба протокола: " + (", ".join(passed) if passed else "нет"))


if __name__ == "__main__":
    main()
