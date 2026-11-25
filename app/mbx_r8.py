"""Круг 8 mbx: всплеск VIX → разовая покупка доли резерва, если металл уже откатил и не было пузыря. Запуск: python3 app/mbx_r8.py"""
import numpy as np
import pandas as pd

import mbx_lib as X
import metals_agent_lib as L
from mbx_r7 import hot


def vix_buy(DD, V, f, R=0.5, H=60, cool=True):
    vm = DD["x"]["vix"].resample("ME").max()

    def fn(d):
        p0 = X.Q2M(d)
        v = vm.reindex(pd.DatetimeIndex(d["t"])).values
        spike = np.nan_to_num(v) >= V
        cond = spike & (X.mcond(d, "retr", R) if R else True) & (L.since(hot(d)) > H)
        ok = (p0 == 1.0) | ((p0 == 0.0) if cool else False)
        p = p0.copy()
        last = -100
        for i in range(len(p)):
            if cond[i] and ok[i] and i - last >= 6:
                p[i] = 1.0 + f
                last = i
        return p
    return fn


def old_part(D, fn, ref):
    s = []
    for k in X.MSEL:
        d = D[k]
        t = d["t"]
        a0, e = X.ix(t, "1990-01-01"), X.ix(t, "2005-01-01")
        s.append(X.rel(X.mrun(d, fn(d), (a0, e)), X.mrun(d, ref(d), (a0, e))))
    return X.lsum(s)


def main():
    X.tee("r8.txt")
    D, DD, MM = X.load()
    Bn = X.Bench(D, DD, MM)
    mref = X.mwrap(X.Q2M, DD)
    for V in (35, 45):
        for f in (0.2, 0.33):
            for R in (0.5, None):
                fn = vix_buy(DD, V, f, R)
                o = X.dcheck3(Bn, fn)
                ok, why = X.dok3(o)
                mfn = X.mwrap(fn, DD)
                om = X.mcheck3(D, mfn, mref)
                okm, whym = X.mok3(om)
                oo = old_part(D, mfn, mref)
                print(f"VIX ≥ {V}, f {f:.0%}, откат {'≥ 50%' if R else '—'}: дн. {X.dfmt3(o)} → {'ПРОХОДИТ' if ok else 'нет: ' + why}")
                print(f"   мес. {om['sum']:+.1f} ({om['ok']}/16, сдвиг {om['l1']:+.1f}); 1990–2004 {oo:+.1f}; после решения {X.dafter(o)}")


if __name__ == "__main__":
    main()
