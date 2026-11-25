"""Круг 9 mbx: разовая покупка вне пузыря (откат ≥ 62% / от рекорда ≥ 50%, нет перегрева 60 мес.) и устойчивость опции. Запуск: python3 app/mbx_r9.py"""
import numpy as np

import mbx_lib as X
import metals_agent_lib as L
from mbx_r7 import hot, old_check, small_nb


def once(nm, thr, f, H=60, cool=False):
    def fn(d):
        p0 = X.Q2M(d)
        m = X.mcond(d, nm, thr) & (L.since(hot(d)) > H)
        reset = X.pfeat(d)["retr"] <= 1e-9
        ok = (p0 == 1.0) | ((p0 == 0.0) if cool else False)
        p = p0.copy()
        armed = True
        for i in range(len(p)):
            if reset[i]:
                armed = True
            if armed and m[i] and ok[i]:
                p[i] = 1.0 + f
                armed = False
        return p
    return fn


def robust(D, DD, MM, Bn, fn, name):
    print(f"\n--- устойчивость: {name} ---")
    for lag, fee in ((0, 0.005), (1, 0.001), (2, 0.001)):
        s = []
        for k in X.DSEL:
            Xk = MM[k]
            p, p0 = Bn.dplan(fn, Xk), Bn.ref(Xk)
            for seg in X.dsegs3(Xk).values():
                s.append(X.rel(Xk.run(p, seg, lag, fee=fee)[0], Xk.run(p0, seg, lag, fee=fee)[0]))
        print(f"  сдвиг {lag}, комиссия {fee:.1%}: {X.lsum(s):+.1f}")
    o = X.dcheck3(Bn, fn, keys=X.DSEL + X.DEXAM, starts=False)
    print("  с экзаменом (палладий, алюминий): " + " ".join(f"{X.NAME[k][:3]} {o['cells'].get((k, 'A'), np.nan):+.1f}/{o['cells'].get((k, 'B'), np.nan):+.1f}" for k in X.DSEL + X.DEXAM)
          + f"; 2005–25 по металлу: " + " ".join(f"{X.NAME[k][:3]} {o['full'][k]:+.1f}" for k in X.DSEL + X.DEXAM))
    for drop in ("platinum", "silver"):
        keys = [k for k in X.DSEL if k != drop]
        od = X.dcheck3(Bn, fn, keys=keys, starts=False, epis=False)
        print(f"  без {X.NAME[drop]}: сумма {od['sum']:+.1f} (A {od['A']:+.1f}, B {od['B']:+.1f})")
    om = X.mcheck3(D, X.mwrap(fn, DD), X.mwrap(X.Q2M, DD), keys=X.MSEL + ["palladium", "tin"])
    print("  месячная, вся история до 2025-12 по металлам: " + " ".join(f"{X.NAME[k][:3]} {v:+.1f}" for k, v in om["all"].items()))
    print("  месячная, 2005–2026-10 (после решения): " + " ".join(f"{X.NAME[k][:3]} {v:+.1f}" for k, v in om["y26"].items()))
    print(f"  после решения (дневная): {X.dafter(o, X.DSEL + X.DEXAM)}")


def main():
    X.tee("r9.txt")
    D, DD, MM = X.load()
    Bn = X.Bench(D, DD, MM)
    mref = X.mwrap(X.Q2M, DD)
    rows = []
    for nm, thr in (("retr", 0.62), ("ddath", 0.5)):
        base7 = old_check(D, X.mwrap(small_nb(nm, thr, 0.1, 60, False), DD), mref)
        for f in (0.25, 0.5):
            for cool in (False, True):
                fn = once(nm, thr, f, 60, cool)
                o = X.dcheck3(Bn, fn)
                ok, why = X.dok3(o)
                om = X.mcheck3(D, X.mwrap(fn, DD), mref)
                okm, whym = X.mok3(om)
                oo = old_check(D, X.mwrap(fn, DD), mref)
                okold = oo >= -10 and oo >= base7
                name = f"разово {nm} {thr}, f {f:.0%}{'' if cool else ' ′'}"
                rows.append((name, fn, ok and okm and okold))
                print(f"\n{name}\n  дневная: {X.dfmt3(o)} → {'ПРОХОДИТ' if ok else 'нет: ' + why}")
                print(f"  месячная: {X.mfmt3(om)} → {'да' if okm else 'нет: ' + whym}")
                print(f"  1965–2004: {oo:+.1f} (малая серия круга 7: {base7:+.1f}) → {'да' if okold else 'нет'}; после решения: {X.dafter(o)}")
    print("\nПрошли всё: " + (", ".join(r[0] for r in rows if r[2]) or "нет"))
    robust(D, DD, MM, Bn, small_nb("retr", 0.62, 0.1, 60, False), "опция О1: малая серия 10%, откат ≥ 62%, нет перегрева 60 мес., не в остывание")
    robust(D, DD, MM, Bn, small_nb("ddath", 0.5, 0.1, 60, False), "опция О2: малая серия 10%, от рекорда ≥ 50%, нет перегрева 60 мес., не в остывание")


if __name__ == "__main__":
    main()
