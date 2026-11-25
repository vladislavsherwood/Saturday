"""Круг 8 mlt: месячный аналог HY3 на 1965–2004 и дневной 2000–04. Запуск: python3 app/mlt_r8.py"""
import numpy as np
import pandas as pd

import mb_lib as B
import mlt_lib as L
from mb_r9 import mb1_monthly

NM = L.NAME
MKEYS = B.MSEL
MEX = ["palladium", "tin"]
EPOCHS = {"1965–81": ("1965-01-01", "1982-01-01"), "1982–98": ("1982-01-01", "1999-01-01"), "1999–2004": ("1999-01-01", "2005-01-01"),
          "2005–15": ("2005-01-01", "2016-01-01"), "2016–25": ("2016-01-01", "2026-01-01")}


def hy3_m(c, z=1.25, k=2.0):
    s = pd.Series(c)
    lr = np.log(s).diff()
    sd = lr.rolling(60, min_periods=24).std().values
    s3, s10 = s.rolling(3).mean().values, s.rolling(10).mean().values
    up = L.b(c > s10) & L.b(s3 > s10)
    s_dn = L.b(lr.values > z * sd) & ~up
    s_up = L.b(np.log(c / s3) > k * sd) & up
    prev = np.r_[np.nan, c[:-1]]
    bb = np.where(up, L.b(c < s3), L.b(c <= prev))
    return L.hyst(s_dn | s_up, bb, 6)


def main():
    L.tee("r8.txt")
    D, DD, MM, base = L.load()
    fm = mb1_monthly(DD)
    print("Круг 8. Месячный аналог HY3 (f = 30%), прибавка смеси к ядру, % (старт с нуля в начале эпохи)\n")
    for core in ("mb1", "dca"):
        print(f"--- ядро {core} ---")
        print("металл | " + " | ".join(EPOCHS) + " | сделок/год 1965–2004")
        sums = {e: [] for e in EPOCHS}
        for k in MKEYS + MEX:
            d = D[k]
            c = np.asarray(d["c"], float)
            t = pd.DatetimeIndex(d["t"])
            pm = np.asarray(fm(d), float) if core == "mb1" else np.ones(len(c))
            e = hy3_m(c)
            rt = np.nan_to_num(np.asarray(d["tb3"], float), nan=4.0) / 100 / 12
            r0 = np.zeros(len(c))
            row = []
            for nm, (a, b_) in EPOCHS.items():
                a0, a1 = int(np.searchsorted(t, np.datetime64(a))), int(np.searchsorted(t, np.datetime64(b_)))
                if a1 - a0 < 36:
                    row.append("—")
                    continue
                rc = L.simsw(c, pm, np.ones(len(c)), a0, a1, 0, r0, rt, 0.001)[0]
                rtr = L.simsw(c, pm, e, a0, a1, 0, r0, rt, 0.001)[0]
                v = L.rel(L.combo(rc, rtr, L.F0), rc)
                row.append(f"{v:+.1f}")
                if k in MKEYS:
                    sums[nm].append(v)
            a0, a1 = int(np.searchsorted(t, np.datetime64("1965-01-01"))), int(np.searchsorted(t, np.datetime64("2005-01-01")))
            yrs = (a1 - a0) / 12
            tp = (np.abs(np.diff(e[a0:a1])) > 0).sum() / yrs
            print(f"{NM[k]} | " + " | ".join(row) + f" | {tp:.1f}")
        print("Σ 8 металлов отбора | " + " | ".join(f"{L.lsum(v):+.1f} (худш. {min(v):+.1f})" if v else "—" for v in sums.values()))
        print()

    print("Дневной HY3, 2000-09…2004-12 (старт с нуля, вне отбора), ядро mb1 / DCA:")
    h = L.HY3()
    for core in ("mb1", "dca"):
        v = []
        for k in L.DSEL + ["palladium"]:
            X = MM[k]
            seg = (0, L.ix(X.t, "2005-01-01"))
            rc = L.R(X, None, seg, core)
            v.append(L.rel(L.combo(rc, L.R(X, h.e(X), seg, core), L.F0), rc))
        print(f"  {core}: " + " ".join(f"{NM[k][:3]} {x:+.1f}" for k, x in zip(L.DSEL + ['palladium'], v)) + f" | Σ 4 отбора {L.lsum(v[:4]):+.1f}")


if __name__ == "__main__":
    main()
