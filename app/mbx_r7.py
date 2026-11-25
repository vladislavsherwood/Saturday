"""Круг 7 mbx: «малая серия» по признаку металла вне послепузырного режима (не было перегрева H мес.). Запуск: python3 app/mbx_r7.py"""
import numpy as np

import mbx_lib as X
import metals_agent2_lib as A
import metals_agent_lib as L
from mbx_r3 import small

FEATS = [("retr", 0.62), ("retr", 0.5), ("retr", 0.8), ("ddath", 0.5), ("ddath", 0.4), ("ddath", 0.6), ("ma48", 0.85), ("rsi", 35)]


def hot(d):
    return (np.nan_to_num(A.feat(d, A.P3)) > A.DEF["hot3"]) & (np.nan_to_num(A.feat(d, A.Y1)) > A.DEF["hot1"])


def small_nb(nm, thr, g, H, cool=True):
    def f(d):
        p0 = X.Q2M(d)
        m = X.mcond(d, nm, thr) & (L.since(hot(d)) > H)
        ok = (p0 == 1.0) | ((p0 == 0.0) if cool else False)
        return np.where(ok & m, 1.0 + g, p0)
    return f


def old_check(D, fn, ref):
    """1965–2004, месячная модель, старты 1965 и 1982 (до 2004-12), 8 металлов + палладий/олово справочно: сумма лог-разниц."""
    s = []
    for k in X.MSEL:
        d = D[k]
        t = d["t"]
        p, p0 = np.asarray(fn(d)), np.asarray(ref(d))
        e = X.ix(t, "2005-01-01")
        for a in ("1965-01-01", "1982-01-01"):
            a0 = X.ix(t, a)
            if e - a0 > 60:
                s.append(X.rel(X.mrun(d, p, (a0, e)), X.mrun(d, p0, (a0, e))))
    return X.lsum(s)


def main():
    X.tee("r7.txt")
    D, DD, MM = X.load()
    Bn = X.Bench(D, DD, MM)
    mref = X.mwrap(X.Q2M, DD)
    print("перегрев (Q2) в 2005–2026 по месяцам: " + "; ".join(f"{X.NAME[k][:3]} " + ",".join(str(t)[:7] for t in D[k]["t"][hot(D[k]) & (D[k]["t"] >= "2005-01-01")]) for k in X.MSEL + ["palladium"]))
    rows = []
    for nm, thr in FEATS:
        for cool in (True, False):
            base = small(nm, thr, 0.1, cool)
            ob = old_check(D, X.mwrap(base, DD), mref)
            for H in (36, 60):
                fn = small_nb(nm, thr, 0.1, H, cool)
                o = X.dcheck3(Bn, fn)
                ok, why = X.dok3(o)
                om = X.mcheck3(D, X.mwrap(fn, DD), mref)
                okm, whym = X.mok3(om)
                oo = old_check(D, X.mwrap(fn, DD), mref)
                okold = (oo - ob > 0) and oo >= -10
                name = f"{nm} {thr} H{H}{'' if cool else ' ′'}"
                rows.append((name, o, om, oo, ob, ok and okm and okold))
                print(f"\n{name}\n  дневная: {X.dfmt3(o)} → {'ПРОХОДИТ' if ok else 'нет: ' + why}")
                print(f"  месячная: {X.mfmt3(om)} → {'да' if okm else 'нет: ' + whym}")
                print(f"  1965–2004: с фильтром {oo:+.1f}, без фильтра {ob:+.1f} → {'да' if okold else 'нет'}")
                print(f"  после решения: {X.dafter(o)}; месячная 2005–2026.10 {om['y26_sum']:+.1f}")
    print("\nСВОДКА (дневная A/B, не хуже / (а) 2005–25 / без эпиз. мин / месячная / 1965–2004 с фильтром [без] / после решения дн. 2005–26):")
    for name, o, om, oo, ob, ok in rows:
        print(f"  {name:22s} {o['sum']:+6.1f} (A {o['A']:+.1f} B {o['B']:+.1f}, {o['ok']}/8) | {o['fsum']:+6.1f} | {min(o['epsum'].values()):+5.1f} | {om['sum']:+6.1f} ({om['ok']}/16) | "
              f"{oo:+6.1f} [{ob:+6.1f}] | {o['f26sum']:+6.1f} | " + " ".join(f"{X.NAME[k][:3]} {o['cells'][(k, 'A')]:+.1f}/{o['cells'][(k, 'B')]:+.1f}" for k in X.DSEL) + ("  ✓" if ok else ""))


if __name__ == "__main__":
    main()
