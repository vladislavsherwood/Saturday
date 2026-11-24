"""Круг 6 mb: «малая серия» вне макро-серии — маркеров дна ≥ m0 и современное условие C (глубокая коррекция / ФРС мягче нейтральной /
реальная ставка снизилась / зима крипты) → взнос + 50% резерва. Запуск: python3 app/mb_r6.py"""
import itertools

import numpy as np
import pandas as pd

import mb_lib as B
import mt5_neutral as N5

RR = "Реальная доходность 10 лет (минус инфляция), %"


def conds(D, DD):
    """Признаки по месяцам для каждого металла: {имя: {k: bool-массив по порогу}} — функции от порога."""
    btc = DD["x"]["btc"].resample("ME").mean()
    bdd = (btc / btc.rolling(12, min_periods=6).max() - 1) * 100

    def C1(d, th):
        c = pd.Series(d["c"])
        dd = (c / c.rolling(12, min_periods=6).max() - 1) * 100
        return (dd <= -th).values

    def C2(d, th):
        g = pd.Series(N5.gap(d))
        return (g - g.shift(12) <= -th).fillna(False).values

    def C3(d, th):
        r = pd.Series(d["F"][RR].values)
        return (r - r.shift(12) <= -th).fillna(False).values

    def C4(d, th):
        x = bdd.reindex(pd.DatetimeIndex(d["t"]), method="ffill")
        return np.nan_to_num(x.values, nan=0) <= -th
    return {"C1 коррекция ≥": (C1, (30, 40)), "C2 разрыв к нейтр. ↓ ≥": (C2, (1.0, 2.0)), "C3 реальн. 10 л ↓ ≥": (C3, (1.0, 1.5)), "C4 BTC от макс. ≥": (C4, (50, 65))}


def mini(fc, th, m0):
    def f(d):
        p = B.Q2M(d).copy()
        hit = (d["bn3"] >= m0) & fc(d, th) & (p >= 0.0) & (p <= 1.0)
        p[hit] = 1.5
        return p
    return f


def main():
    B.tee("r6.txt")
    D, DD, MM = B.load()
    ref_d = lambda X: B.q2d(D, X)  # noqa: E731
    C = conds(D, DD)
    # диагностика: признаки у современных доньев
    print("=== признаки у доньев 2018–2024 (месяц минимума; маркеров дна; C1 просадка от макс. 12 мес.; C2 Δразрыв; C3 Δреальн.; C4 BTC) ===")
    btc = DD["x"]["btc"].resample("ME").mean()
    for k, m in (("gold", "2018-08"), ("gold", "2022-09"), ("silver", "2020-03"), ("silver", "2022-08"), ("platinum", "2020-03"), ("platinum", "2022-08"),
                 ("copper", "2020-03"), ("copper", "2022-07"), ("aluminum", "2023-08"), ("zinc", "2024-02"), ("silver", "2015-12"), ("gold", "2008-11")):
        d = D[k]
        i = int(np.where(pd.DatetimeIndex(d["t"]).strftime("%Y-%m") == m)[0][0])
        c = pd.Series(d["c"])
        dd = (c / c.rolling(12, min_periods=6).max() - 1).values[i] * 100
        g = pd.Series(N5.gap(d)); dg = (g - g.shift(12)).values[i]
        r = pd.Series(d["F"][RR].values); dr = (r - r.shift(12)).values[i]
        b = btc.reindex(pd.DatetimeIndex(d["t"]), method="ffill")
        bd = ((b / b.rolling(12, min_periods=6).max() - 1) * 100).values[i]
        print(f"  {B.NAME[k]} {m}: маркеров дна {d['bn3'][i]}, C1 {dd:+.0f}%, C2 {dg:+.2f}, C3 {dr:+.2f}, C4 {bd:+.0f}%")
    res = {}
    for nm, (fc, ths) in C.items():
        print(f"\n=== {nm} ===")
        for m0, th in itertools.product((2, 3), ths):
            fm = mini(fc, th, m0)
            fd = lambda X, fm=fm: B.q2d(D, X, fm)  # noqa: E731
            om = B.mcheck2(D, fm, B.Q2M)
            od = B.dcheck2(MM, fd, ref_d)
            okm, wm = B.mok2(om)
            okd, wd = B.dok2(od)
            sec, gross, ws = B.msec(om)
            nmon = sum(int(((np.asarray(fm(D[k])) > 1) & ~(B.Q2M(D[k]) > 1))[B._ix(D[k]["t"], B.A0):].sum()) for k in B.A.SEL)
            res[(nm, m0, th)] = okm and okd and not gross
            print(f"  m0 {m0}, порог {th}: новых месяцев «малой серии» 2005–26 по 8 металлам {nmon}\n    месячная: {B.mfmt2(om)} → {'✓' if okm else '✗ ' + wm}"
                  f"{'' if sec else ' [втор.: ' + ws + ']'}\n    дневная: {B.dfmt2(od)} → {'✓' if okd else '✗ ' + wd}"
                  f"\n    без эпизода (дневная): " + ", ".join(f"{a} {b:+.1f}" for a, b in od["epsum"].items()))
    print("\nпрошли: " + str([k for k, v in res.items() if v]))


if __name__ == "__main__":
    main()
