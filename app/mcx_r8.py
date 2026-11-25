"""Круг 8 mcx: фитили в масштабе σ металла — W1 (лимитное исполнение доли серии mb1), W2 (редкий глубокий фитиль вне серии). Запуск: python3 app/mcx_r8.py"""
import numpy as np
from numba import njit

import mcx_lib as C


@njit(cache=True)
def simw(c, low, pm, kd, maxwait, w2k, w2f, mask, lo, hi, lag, rate, fee):
    """mb1 + W1 (kd > 0: лимит доли серии на kd·(вчерашнее закрытие) ниже, ждать maxwait дней) + W2 (w2k > 0: лимит вне серии на w2k ниже → w2f макро-резерва).
    kd, w2k — массивы долей (уже в σ); mask — дни, где правило выключено (исполнение как у mb1)."""
    n = len(c)
    cash = 0.0; units = 0.0; du = 0.0
    pend = 0.0; age = 0
    bx = np.zeros(n)
    for i in range(lo, hi):
        p = c[i]
        lw = min(low[i], p) if low[i] > 0 else p
        j = i - 1 - lag
        a = pm[j] if j >= lo else 1.0
        off = mask[j] if j >= lo else True
        cash *= 1 + rate[i]
        before = cash
        cash += 10.0
        du += 10.0 * (1 - fee) / p
        if a < 0:
            v = -a * units * p
            if v > 0:
                units += a * units
                cash += v * (1 - fee)
            if pend > 0:
                pend = 0.0
            continue
        ser = a > 1.0
        # взнос
        v = min(cash, 10.0 * min(a, 1.0))
        units += v * (1 - fee) / p
        cash -= v
        if ser:
            want = (a - 1.0) * before
            if kd[j] > 0 and not off:
                pend += want
            else:
                v = min(cash, want)
                units += v * (1 - fee) / p
                cash -= v
                bx[i] += v
        if pend > 0:
            lim = c[j] * (1 - kd[j]) if j >= lo else p
            if lw <= lim and kd[j] > 0:
                v = min(cash, pend)
                units += v * (1 - fee) / lim
                cash -= v
                bx[i] += v
                pend = 0.0
                age = 0
            else:
                age += 1
                if age >= maxwait or not ser:
                    v = min(cash, pend)
                    units += v * (1 - fee) / p
                    cash -= v
                    bx[i] += v
                    pend = 0.0
                    age = 0
        if (not ser) and w2k[j] > 0 and not off and cash > 0 and j >= lo:
            lim = c[j] * (1 - w2k[j])
            if lw <= lim:
                v = w2f * cash
                units += v * (1 - fee) / lim
                cash -= v
                bx[i] += v
    fin = units * c[hi - 1] + cash
    return (fin / (du * c[hi - 1]) - 1) * 100, bx


def runner(k1=0.0, N=10, k2=0.0, f2=0.25):
    D, DD, MM, base = C.load()

    def R(X, seg, lag, mask, fee, rt):
        f = C.feats(X, DD)
        sd = np.nan_to_num(f["sd250"], nan=0.01)
        low = np.nan_to_num(X.l, nan=0.0)
        kd = np.full(X.n, 0.0) if k1 <= 0 else k1 * sd
        w2 = np.full(X.n, 0.0) if k2 <= 0 else k2 * sd
        m = np.zeros(X.n, np.bool_) if mask is None else np.asarray(mask, np.bool_)
        return simw(X.c, low, base[X.k], kd, N, w2, f2, m, seg[0], seg[1], lag, rt, fee)[0]
    return R


def main():
    C.tee("r8.txt")
    D, DD, MM, base = C.load()
    # проверка: без правил = mb1
    R0 = runner()
    for k in C.DSEL:
        X = MM[k]
        sg = C.segs(X)["A"]
        assert abs(R0(X, sg, 0, None, 0.001, X.rate0) - C.run(X, base, C.NULL, sg)[0]) < 1e-6
    print("simw без правил = mb1\n")
    # частота глубоких фитилей (минимум дня ниже вчерашнего закрытия на kσ), 2009–25
    for k in C.ALL5:
        X = MM[k]
        f = C.feats(X, DD)
        a, b = C.ix(X.t, "2009-01-01"), C.ix(X.t, C.CUT)
        lw = np.minimum(np.nan_to_num(X.l, nan=np.inf), X.c)
        dz = (1 - lw[1:] / X.c[:-1]) / f["sd250"][:-1]
        dz = dz[a:b - 1]
        yrs = (b - a) / 252
        print(f"{C.NAME[k]}: фитилей ≥ 3/4/5/6/7σ в год (2009–25): " + "/".join(f"{(np.nan_to_num(dz) >= q).sum() / yrs:.2f}" for q in (3, 4, 5, 6, 7)))
    print("\n=== W1: лимитное исполнение доли серии (k·σ ниже вчерашнего закрытия, ждать N дней) ===")
    for k1 in (0.5, 1.0, 1.5):
        for N in (5, 10, 21):
            o = C.check_runner(runner(k1, N))
            good, why = C.ok(o)
            print(f"k {k1}σ N {N}: {C.fmt(o)} → {'✓' if good else '✗ ' + why}")
            print("    " + C.fafter(o))
    print("\n=== W2: глубокий фитиль вне серии (k·σ ниже вчерашнего закрытия → f макро-резерва) ===")
    for k2 in (5, 6, 7):
        for f2 in (0.15, 0.25, 0.35):
            o = C.check_runner(runner(0, 10, k2 / 1.0, f2))
            good, why = C.ok(o)
            print(f"k {k2}σ f {f2:.0%}: {C.fmt(o)} → {'✓' if good else '✗ ' + why}")
            print("    " + C.fafter(o))


if __name__ == "__main__":
    main()
