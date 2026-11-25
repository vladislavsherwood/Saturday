"""Круг 4 mcx: бегство в доллар → копить взносы; разворот доллара → весь тактический резерв + m макро-резерва («×2»). Запуск: python3 app/mcx_r4.py"""
import numpy as np

import mcx_lib as C


def flight(DD, T=0.03, r=0.01, m=0.0, gap=10, peak=0.995):
    def fn(X):
        f = C.feats(X, DD)
        n = X.n
        fl = (np.nan_to_num(f["dxy_r21"]) > T) & (np.nan_to_num(f["dxy_mx10"]) >= peak)
        rv = np.nan_to_num(f["dxy_mx10"], nan=1.0) < 1 - r
        ts, tb, tk, tm = np.zeros(n), np.zeros(n), np.zeros(n), np.zeros(n)
        on, last = False, -10 ** 6
        for i in range(n):
            if fl[i]:
                on, last = True, i
                tk[i] = 1.0
                continue
            if on:
                if rv[i]:
                    tb[i], tm[i] = 1.0, m
                    on = False
                elif i - last >= gap:
                    tb[i] = 1.0
                    on = False
        return ts, tb, tk, tm
    return fn


def main():
    C.tee("r4.txt")
    D, DD, MM, base = C.load()
    res = {}
    for m in (0.0, 0.10, 0.25):
        print(f"\n=== надбавка из макро-резерва m = {m:.0%} ===")
        for T in (0.02, 0.03, 0.04):
            for r in (0.005, 0.01, 0.015):
                o = C.report(f"T {T:.0%} r {r:.1%} m {m:.0%}", C.Layer(flight(DD, T, r, m)))
                print("    " + C.fafter(o))
                res[(m, T, r)] = o
    # сколько эпизодов
    X = MM["gold"]
    ts, tb, tk, tm = C.Layer(flight(DD, 0.03, 0.01, 0.1)).arrays(X)
    a, b = C.ix(X.t, C.A0), C.ix(X.t, C.CUT)
    print(f"\nT 3% r 1%: дней «копить» 2005–25 {int(tk[a:b].sum())}, выпусков {int((tb[a:b] > 0).sum())}, из них на развороте {int((tm[a:b] > 0).sum())}")
    print("выпуски на развороте:", [str(X.t[i])[:10] for i in np.where(tm > 0)[0] if a <= i < b])


if __name__ == "__main__":
    main()
