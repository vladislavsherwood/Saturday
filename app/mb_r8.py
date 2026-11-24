"""Круг 8 mb: H8a — выкуп после пузыря (цена ≤ (1 − dd) × средней цены продаж ≥ 50%); H8b — фильтр «подожди» после стресса BTC;
H8c — резерв золота в 2016–26. Запуск: python3 app/mb_r8.py"""
import itertools

import numpy as np
import pandas as pd

import mb_lib as B
import metals_agent_lib as L


def buyback(dd, g, W=60):
    def f(d):
        p = B.Q2M(d).copy()
        c = d["c"]
        n = len(p)
        S = np.nan
        last = -10 ** 6
        sp = []
        for i in range(n):
            if p[i] <= -0.5 + 1e-9:
                if i - last > 6:
                    sp = []
                sp.append(c[i])
                S = float(np.mean(sp))
                last = i
                continue
            if p[i] > 1.0:
                last = -10 ** 6
                continue
            if 0 < i - last <= W and np.isfinite(S) and c[i] <= (1 - dd) * S and p[i] >= 0:
                p[i] = 1 + g
        return p
    return f


def btc_wait(DD, base_fn, T=0.25, W=60):
    btc = DD["x"]["btc"]

    def f(X):
        p = base_fn(X)
        b = B.M.on_days(btc, X.t)
        r30 = b / B.M.on_days(btc.shift(1, freq="30D"), X.t) - 1
        ev = np.nan_to_num(r30) <= -T
        since = L.since(ev)
        wait = (since <= W)
        g = np.where(p > 1.0, p - 1.0, 0.0)
        ser = p > 1.0
        falling = wait
        gd = np.where(ser, g, 0.0)
        out = np.zeros(len(p))
        cr = 1.0
        for i in range(len(p)):
            if not ser[i]:
                cr = 1.0
                continue
            if falling[i]:
                cr *= (1 - gd[i])
                out[i] = 0.0
            else:
                out[i] = 1 - cr * (1 - gd[i])
                cr = 1.0
        return B.reshape(p, out), int((ser & wait).sum())
    return f


def main():
    B.tee("r8.txt")
    D, DD, MM = B.load()
    ref = lambda X: B.q2d(D, X)  # noqa: E731
    print("=== H8a: выкуп после пузыря ===")
    ok, rows = {}, {}
    for dd, g in itertools.product((0.4, 0.5, 0.6), (0.25, 0.5)):
        fm = buyback(dd, g)
        fd = lambda X, fm=fm: B.q2d(D, X, fm)  # noqa: E731
        om = B.mcheck2(D, fm, B.Q2M)
        od = B.dcheck2(MM, fd, ref)
        okm, wm = B.mok2(om)
        okd, wd = B.dok2(od)
        sec, gross, ws = B.msec(om)
        acts = {k: [str(t)[:7] for t, a, b in zip(D[k]["t"], fm(D[k]), B.Q2M(D[k])) if a != b] for k in B.ALLM}
        ok[(dd, g)] = okm and okd and not gross and od["epsum"]["2025–26"] >= 0 and od["epsum"]["2011–15"] >= 0
        rows[(dd, g)] = fm
        print(f"  dd {dd:.0%}, g {g:.0%}:\n    месячная: {B.mfmt2(om)} → {'✓' if okm else '✗ ' + wm}{'' if sec else ' [втор.: ' + ws + ']'}"
              f"\n    дневная: {B.dfmt2(od)} → {'✓' if okd else '✗ ' + wd}\n    без эпизода: " + ", ".join(f"{a} {b:+.1f}" for a, b in od["epsum"].items())
              + "\n    месяцы выкупа: " + "; ".join(f"{B.NAME[k][:3]} {v[0]}…{v[-1]} ({len(v)})" for k, v in acts.items() if v))
    print("  прошли: " + str([k for k, v in ok.items() if v]))
    print("\n=== H8b: фильтр «подожди» после стресса BTC (−25% за 30 дн., окно 60 дн.) поверх Q2д ===")
    for T, W in ((0.25, 60), (0.20, 60), (0.25, 30), (0.25, 90)):
        fw = btc_wait(DD, ref, T, W)
        fd = lambda X, fw=fw: fw(X)[0]  # noqa: E731
        nd = sum(fw(MM[k])[1] for k in B.DSEL)
        od = B.dcheck2(MM, fd, ref)
        okd, wd = B.dok2(od)
        print(f"  T {T:.0%}, окно {W}: дней серии под фильтром (4 металла) {nd}; {B.dfmt2(od)} → {'✓' if okd else '✗ ' + wd}")
    print("\n=== H8c: резерв золота у Q2д (доля капитала в деньгах), 2005–26, старт с нуля в 2005 ===")
    for k in B.DSEL:
        X = MM[k]
        p = ref(X)
        a0 = B._ix(X.t, B.A0)
        cash = units = 0.0
        sh = []
        for i in range(a0, X.n):
            j = i - 1
            a = p[j] if j >= a0 else 1.0
            before = cash
            cash += 10
            if a < 0:
                v = -a * units * X.c[i]; units += a * units; cash += v * 0.999
            elif a > 0:
                v = min(cash, 10 * min(a, 1) + max(a - 1, 0) * before); units += v * 0.999 / X.c[i]; cash -= v
            sh.append(cash / (cash + units * X.c[i]))
        sh = pd.Series(sh, index=X.t[a0:])
        b = sh.loc["2016-01-01":]
        print(f"  {B.NAME[k]}: доля резерва 2016–26 медиана {b.median() * 100:.1f}%, ≤ 5% в {(b <= 0.05).mean() * 100:.0f}% дней; макс. {b.max() * 100:.0f}% ({str(b.idxmax())[:10]}); сейчас {sh.iloc[-1] * 100:.0f}%")


if __name__ == "__main__":
    main()
