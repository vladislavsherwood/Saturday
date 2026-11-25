"""Круг 6 mbx: ценовой маркер металла в счётчике дна — замена «цены к средней 3 лет» (H6a) или девятый маркер (H6b). Запуск: python3 app/mbx_r6.py"""
import numpy as np

import mbx_lib as X
import metals_agent2_lib as A
from metals_agent3_loop5 import cool

FEATS = [("retr", 0.62), ("retr", 0.8), ("ma48", 0.85), ("ma48", 0.75), ("rsi", 35), ("ddath", 0.5)]


def counted(nm, thr, mode, D):
    thr3 = D["_thr3"]

    def base(dd):
        p3 = np.nan_to_num(A.feat(dd, A.P3), nan=9) < thr3[(A.P3, "lo")]
        fx = X.mcond(dd, nm, thr)
        if mode == "replace":
            bn = dd["bn3"] - p3.astype(int) + fx.astype(int)
            return A.r3(dd, hot2=0.5, bn=bn, nb=dd["nb"])
        bn = dd["bn3"] + fx.astype(int)
        return A.r3(dd, hot2=0.5, bn=bn, nb=dd["nb"] + 1, k_on=4)

    q = cool(base, 0.2, 24)

    def f(d):
        p0 = X.Q2M(d)
        p = q(d)
        return np.where(p0 < 0, p0, p)        # продажи mb1 не трогаем
    return f


def main():
    X.tee("r6.txt")
    D, DD, MM = X.load()
    Bn = X.Bench(D, DD, MM)
    mref = X.mwrap(X.Q2M, DD)
    for mode in ("replace", "ninth"):
        for nm, thr in FEATS:
            fn = counted(nm, thr, mode, D)
            o = X.dcheck3(Bn, fn)
            ok, why = X.dok3(o)
            om = X.mcheck3(D, X.mwrap(fn, DD), mref)
            okm, whym = X.mok3(om)
            nser = sum(int(((fn(D[k]) > 1) & (D[k]["t"] >= "2005-01-01") & (D[k]["t"] < X.CUT)).sum() - ((X.Q2M(D[k]) > 1) & (D[k]["t"] >= "2005-01-01") & (D[k]["t"] < X.CUT)).sum()) for k in X.MSEL)
            print(f"{'H6a замена' if mode == 'replace' else 'H6b девятый'} {nm} {thr}: месяцев серии 2005–25 (8 мет.) {nser:+d}")
            print(f"  дневная: {X.dfmt3(o)} → {'ПРОХОДИТ' if ok else 'нет: ' + why}")
            print(f"  месячная: {X.mfmt3(om)} → {'да' if okm else 'нет: ' + whym}")
            print(f"  после решения: {X.dafter(o)}; месячная 2005–2026.10 {om['y26_sum']:+.1f}")


if __name__ == "__main__":
    main()
