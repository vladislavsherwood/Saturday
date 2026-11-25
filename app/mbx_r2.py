"""Круг 2 mbx: мягкое остывание — досрочный конец по цене продажи / по ценовому признаку, частичное накопление, длина. Запуск: python3 app/mbx_r2.py"""
import numpy as np

import mbx_lib as X
import mt4_lib as M


def early_end(cond_fn):
    """Остывание (план 0) кончается досрочно в месяц, когда cond_fn(d, p0, sp) истинно: дальше до конца окна — обычный взнос."""
    def f(d):
        p0 = X.Q2M(d)
        since, sp = X.sale_info(p0, d["c"])
        cond = cond_fn(d, p0, sp)
        p = p0.copy()
        ended = False
        for i in range(len(p)):
            if p0[i] < 0:
                ended = False
                continue
            if p0[i] == 0.0:
                if cond[i]:
                    ended = True
                if ended:
                    p[i] = 1.0
        return p
    return f


def by_sale(x):
    return early_end(lambda d, p0, sp: np.nan_to_num(d["c"] / sp, nan=9) <= 1 - x)


def by_feat(nm, thr):
    return early_end(lambda d, p0, sp: X.mcond(d, nm, thr))


def partial(a):
    def f(d):
        p0 = X.Q2M(d)
        return np.where(p0 == 0.0, 1 - a, p0)
    return f


def length(N):
    return M.q2plan(N=N)


def main():
    X.tee("r2.txt")
    D, DD, MM = X.load()
    Bn = X.Bench(D, DD, MM)
    mref = X.mwrap(X.Q2M, DD)
    C = {}
    for x in (0.3, 0.4, 0.5):
        C[f"H2a конец остывания при цене ≤ {1 - x:.0%} цены продаж"] = by_sale(x)
    for nm, thr in (("retr", 0.62), ("retr", 0.8), ("ma48", 0.85), ("ma48", 0.75), ("rsi", 35), ("rsi", 30)):
        C[f"H2b конец остывания по признаку {nm} {thr}"] = by_feat(nm, thr)
    for a in (0.5, 0.75):
        C[f"H2c копить {a:.0%} взноса в остывание"] = partial(a)
    for N in (12, 18, 30, 36):
        C[f"H2d длина остывания {N} мес."] = length(N)
    for nm, fn in C.items():
        o = X.dcheck3(Bn, fn)
        ok, why = X.dok3(o)
        om = X.mcheck3(D, X.mwrap(fn, DD), mref)
        okm, whym = X.mok3(om)
        print(f"\n{nm}\n  дневная: {X.dfmt3(o)} → {'ПРОХОДИТ' if ok else 'нет: ' + why}")
        print(f"  месячная: {X.mfmt3(om)} → {'да' if okm else 'нет: ' + whym}")
        print(f"  после решения (2026): {X.dafter(o)}; месячная 2005–2026.10 {om['y26_sum']:+.1f}")


if __name__ == "__main__":
    main()
