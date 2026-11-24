"""Круг 9 mb: кандидат mb1 = Q2д + пауза докупок серии 90 дней после стресса BTC (−25% за 30 дней); устойчивость. Запуск: python3 app/mb_r9.py"""
import numpy as np
import pandas as pd

import mb_lib as B
import mt4_lib as M
from mb_r8 import btc_wait


def mb1(D, DD):
    ref = lambda X: B.q2d(D, X)  # noqa: E731
    fw = btc_wait(DD, ref, 0.25, 90)
    return lambda X: fw(X)[0]


def mb1_monthly(DD):
    btc = DD["x"]["btc"]
    r30 = btc / btc.shift(1, freq="30D").reindex(btc.index, method="ffill") - 1
    ev = (r30 <= -0.25).resample("ME").max().fillna(False)
    win = ev.rolling(3, min_periods=1).max().astype(bool)    # стресс в этом месяце или в 2 предыдущих

    def f(d):
        p = B.Q2M(d).copy()
        w = win.reindex(pd.DatetimeIndex(d["t"])).fillna(False).values.astype(bool)
        ser = p > 1.0
        g = np.where(ser, 0.5, 0.0)
        out = B._defer(ser, w, ~w, 0.5, 1.0, False, 0)
        return B.reshape(p, out)
    return f


def main():
    B.tee("r9.txt")
    D, DD, MM = B.load()
    ref = lambda X: B.q2d(D, X)  # noqa: E731
    cand = mb1(D, DD)
    ok = True
    o = B.dcheck2(MM, cand, ref)
    print(f"(1) новый протокол 2005–26: {B.dfmt2(o)}")
    o2 = M.gstat(MM, cand, ref)
    print(f"    старый протокол mt4 (2000–13 / 2013–26): {M.gfmt(o2)}")
    ok &= o["A"] >= 0 and o["B"] >= 0 and o2["h1"] >= 0 and o2["h2"] >= 0
    print("(2) сдвиг / комиссия (сумма по 4 металлам, обе половины 2005–26):")
    for lag, fee in ((0, 0.001), (1, 0.001), (2, 0.001), (0, 0.005)):
        s = 0.0
        for k in B.DSEL:
            X = MM[k]
            p, p0 = cand(X), ref(X)
            for seg in B.dsegs(X).values():
                s += np.log1p(B.rel(X.run(p, seg, lag, fee=fee)[0], X.run(p0, seg, lag, fee=fee)[0]) / 100) * 100
        ok &= s >= 0
        print(f"    сдвиг {lag}, комиссия {fee:.1%}: {s:+.1f}")
    o3 = B.dcheck2(MM, cand, ref, rate="tb")
    print(f"(3) резерв в векселях: {B.dfmt2(o3)}")
    ok &= o3["sum"] >= 0
    ex = B.dcheck2(MM, cand, ref, keys=["palladium", "aluminum"], starts=False)
    print(f"(4) экзамен: {B.dfmt2(ex, ['palladium', 'aluminum'])}")
    ok &= ex["sum"] >= 0
    fm = mb1_monthly(DD)
    om = B.mcheck2(D, fm, B.Q2M)
    print(f"(5) месячный аналог: {B.mfmt2(om)}")
    oe = B.mcheck2(D, fm, B.Q2M, keys=["palladium", "tin"])
    print(f"    экзамен месячный (палладий, олово 2005–26): " + ", ".join(f"{B.NAME[k]} {oe['cells'][(k, 'A')]:+.1f}/{oe['cells'][(k, 'B')]:+.1f}" for k in ("palladium", "tin")))
    ok &= om["ok"] >= 13
    print(f"\nH9: {'подтверждена' if ok else 'не подтверждена'}")
    print("\nИТОГ К ДНЕВНОМУ DCA, % (2005–15 / 2016–26 / 2005–26), без дохода резерва [с векселями]:")
    for nm, fn in (("Q2д", ref), ("mb1", cand)):
        row = []
        for k in B.DSEL + B.DEXAM:
            X = MM[k]
            p = fn(X)
            sg = B.dsegs(X)
            segs = [sg["A"], sg["B"], (sg["A"][0], X.n)]
            v = [X.run(p, s)[0] for s in segs]
            vt = [X.run(p, s, rate=X.ratetb)[0] for s in segs]
            row.append(f"{B.NAME[k]} " + "/".join("—" if not np.isfinite(x) else f"{x:+.0f}" for x in v) + " [" + "/".join("—" if not np.isfinite(x) else f"{x:+.0f}" for x in vt) + "]")
        print(f"  {nm}: " + "; ".join(row))
    print("\nТОЧНОСТЬ ПОКУПОК 2005–26 (дневная; рано / к DCA резерва, по металлам):")
    for nm, fn in (("Q2д", ref), ("mb1", cand)):
        P = B.dprec2(MM, fn, B.DSEL + ["palladium"])
        print(f"  {nm}: {B.fprec2(P)}")
        for k in B.DSEL:
            for e in P[k]["eps"]:
                print(f"     {B.NAME[k]} {str(e['start'])[:10]}–{str(e['end'])[:10]}: средняя {e['avg']:.2f}, минимум {e['low']:.2f} ({str(e['low_t'])[:10]}), выше мин. {e['above_low']:+.0f}%, к DCA рез. {e['vsdca']:+.0f}%, до мин. {e['before_low']:.0f}% денег")


if __name__ == "__main__":
    main()
