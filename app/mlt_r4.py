"""Круг 4 mlt: формы тренда против пилы. Запуск: python3 app/mlt_r4.py"""
import numpy as np
import pandas as pd

import mlt_lib as L


def band(n, k, back):
    def fn(X):
        f = L.F(X)
        d = np.log(X.c / L.sma(X.c, n)) / (f["sd250"] * np.sqrt(50))
        return L.hyst3(L.b(d < -k), L.b(d > (0 if back == 0 else k / 2)))
    return L.Rule(fn, f"F1 полоса SMA{n} −{k}σ√50, откуп {'> SMA' if back == 0 else f'> +{k / 2}σ√50'}")


def confirm(N, n=200):
    def fn(X):
        c = X.c
        below = pd.Series((c < L.sma(c, n)).astype(float))
        dn = below.rolling(N).sum().values >= N
        up = (1 - below).rolling(N).sum().values >= N
        return L.hyst3(L.b(dn), L.b(up))
    return L.Rule(fn, f"F2 подтверждение {N} дн. к SMA{n}")


def ens_mom():
    def fn(X):
        s = sum((L.ret(X.c, n) > 0).astype(float) for n in (21, 63, 126, 250))
        return s / 4
    return L.Rule(fn, "F3 ансамбль импульса 21/63/126/250 (ступени 0,25)")


def ens_sma():
    def fn(X):
        return sum((X.c > L.sma(X.c, n)).astype(float) for n in (50, 100, 200)) / 3
    return L.Rule(fn, "F3 ансамбль цены к SMA50/100/200 (ступени 1/3)")


def ens_band():
    def fn(X):
        return sum(band(n, 1.0, 0).fn(X) for n in (50, 100, 200)) / 3
    return L.Rule(fn, "F3 ансамбль полос −1σ к SMA50/100/200")


def voltgt(step=0.25):
    def fn(X):
        f = L.F(X)
        v = f["sd20"]
        tgt = pd.Series(v).rolling(750, min_periods=250).median().values
        e = np.minimum(1.0, tgt / v)
        return np.floor(np.nan_to_num(e, nan=1.0) / step) * step
    return L.Rule(fn, f"F4 масштаб по вол (ступени {step})")


def main():
    L.tee("r4.txt")
    print("Круг 4. Формы тренда, ядро mb1, f = 30%\n")
    rules = [band(n, k, bk) for n in (100, 200) for k in (0.5, 1.0, 1.5) for bk in (0, 1)]
    rules += [confirm(N) for N in (5, 10, 20)]
    rules += [ens_mom(), ens_sma(), ens_band(), voltgt(0.25), voltgt(0.5)]
    res = L.scan(rules)
    print("\nСводка: прошли", sum(1 for z in res if z[2]), "из", len(res))
    print("\nЛучшие 3 — ядро DCA, после решения, точность:")
    for r, o, g, why in L.best(res, 3):
        od = L.check(r, core="dca", starts=False, epis=False)
        print(f"  {r.name}: DCA-ядро {L.fmt(od, short=True)} | 2005–25 {od['fsum']:+.1f}")
        print(f"     {L.fafter(o)}")
        print(f"     точность: {L.pfmt(L.precision(r))}")


if __name__ == "__main__":
    main()
