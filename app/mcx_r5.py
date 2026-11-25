"""Круг 5 mcx: тактическая копилка (доля взноса) → выпуск на панике рынка: VIX > V, падение открытого интереса CFTC, маржин-коллы. Запуск: python3 app/mcx_r5.py"""
import json
import os

import numpy as np
import pandas as pd

import mcx_lib as C

COT = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/mbx/cot"
CODE = {"gold": "088691", "silver": "084691", "platinum": "076651", "palladium": "075651", "copper": "085692"}


def oi_daily(X):
    raw = json.load(open(os.path.join(COT, f"legacy_{CODE[X.k]}.json")))
    t = pd.to_datetime([r["report_date_as_yyyy_mm_dd"][:10] for r in raw]) + pd.Timedelta(days=6)   # отчёт за вторник известен с понедельника
    oi = pd.Series([float(r["open_interest_all"]) for r in raw], index=t)
    oi = oi[~oi.index.duplicated(keep="last")].sort_index()
    dd = oi / oi.rolling(5, min_periods=3).max() - 1
    return C.on_days(dd, X.t)


def piggy(DD, q, trig, b):
    def fn(X):
        f = C.feats(X, DD)
        n = X.n
        tk = np.full(n, q)
        s = np.asarray(trig(X, f), bool)
        tb = np.where(s, b, 0.0)
        tk = np.where(s, 0.0, tk)
        return np.zeros(n), tb, tk
    return fn


def t_vix(V):
    return lambda X, f: np.nan_to_num(f["vix"]) > V


def t_oi(D):
    return lambda X, f: np.nan_to_num(oi_daily(X)) < -D


def t_wave():
    def g(X, f):
        sd = f["sd250"]
        r3 = np.r_[np.nan, np.nan, np.nan, np.log(X.c[3:] / X.c[:-3])]
        wave = np.nan_to_num(r3) < -3 * np.nan_to_num(sd, nan=1) * np.sqrt(3)
        w20 = pd.Series(wave).rolling(20, min_periods=1).max().values.astype(bool)
        return w20 & (np.log(X.c / C.rmin(X.c, 20)) > np.nan_to_num(sd) * np.sqrt(5)) & ~wave
    return g


def t_cal(P=126):
    return lambda X, f: (np.arange(X.n) % P) == 0


def t_none():
    return lambda X, f: np.zeros(X.n, bool)


def main():
    C.tee("r5.txt")
    D, DD, MM, base = C.load()
    # частота триггеров 2005–25 (золото)
    for k in C.DSEL:
        X = MM[k]
        f = C.feats(X, DD)
        a, b = C.ix(X.t, C.A0), C.ix(X.t, C.CUT)
        dd = oi_daily(X)
        d = np.asarray(X.t, "datetime64[D]").astype(np.int64)
        print(f"{C.NAME[k]}: дней VIX>25/30/35 — " + "/".join(str(int((np.nan_to_num(f['vix'][a:b]) > v).sum())) for v in (25, 30, 35)) +
              "; OI ниже макс. 5 отчётов на 10/15/20% — " + "/".join(f"{int((np.nan_to_num(dd[a:b]) < -x).sum())} дн. ({C._clusters(np.nan_to_num(dd[a:b]) < -x, d[a:b], 10)} эп.)" for x in (0.1, 0.15, 0.2)))
    print()
    for q in (0.25, 0.5):
        for cap in (0.1, 0.2):
            print(f"\n=== копилка q {q:.0%}, предел {cap:.0%} капитала ===")
            C.report("контроль: без выпуска", C.Layer(piggy(DD, q, t_none(), 0), capf=cap), prec=False)
            C.report("контроль: календарь 126 дн., b 100%", C.Layer(piggy(DD, q, t_cal(), 1.0), capf=cap), prec=False)
            for V in (25, 30, 35):
                for b in (0.25, 1.0):
                    o = C.report(f"VIX > {V}, b {b:.0%}", C.Layer(piggy(DD, q, t_vix(V), b), capf=cap))
                    print("    " + C.fafter(o))
            for Dd in (0.10, 0.15, 0.20):
                for b in (0.25, 1.0):
                    o = C.report(f"OI −{Dd:.0%}, b {b:.0%}", C.Layer(piggy(DD, q, t_oi(Dd), b), capf=cap))
                    print("    " + C.fafter(o))
            for b in (0.25, 1.0):
                o = C.report(f"после маржин-коллов, b {b:.0%}", C.Layer(piggy(DD, q, t_wave(), b), capf=cap))
                print("    " + C.fafter(o))


if __name__ == "__main__":
    main()
