"""Круг 6 mcx: продажи на вершинах (перегрев σ, толпа CFTC, эйфория доллара, тихая вершина) → тактический резерв → откуп. Запуск: python3 app/mcx_r6.py"""
import json
import os

import numpy as np
import pandas as pd

import mcx_lib as C
from mcx_r5 import COT, CODE


def cot_pct(X):
    raw = json.load(open(os.path.join(COT, f"legacy_{CODE[X.k]}.json")))
    t = pd.to_datetime([r["report_date_as_yyyy_mm_dd"][:10] for r in raw]) + pd.Timedelta(days=6)
    g = lambda key: np.array([float(r.get(key, "nan")) for r in raw])  # noqa: E731
    net = pd.Series((g("noncomm_positions_long_all") - g("noncomm_positions_short_all")) / g("open_interest_all"), index=t)
    net = net[~net.index.duplicated(keep="last")].sort_index()
    pct = net.rolling(260, min_periods=104).apply(lambda x: (x[:-1] < x[-1]).mean(), raw=True)
    return C.on_days(pct, X.t)


def sells(MM, DD, kind, par):
    def g(X, f):
        sd = np.nan_to_num(f["sd250"], nan=1.0)
        if kind == "heat":
            return np.log(np.nan_to_num(f["ma200"], nan=1.0)) > par * sd * np.sqrt(50)
        if kind == "cot":
            return np.nan_to_num(cot_pct(X)) > par
        if kind == "euph":
            return (np.nan_to_num(f["dxy_ma200"], nan=1.0) < 0.95) & (np.nan_to_num(f["fg"]) > 65)
        if kind == "quiet":
            gold = C.on_days(pd.Series(MM["gold"].c, index=MM["gold"].t), X.t)
            silv = C.on_days(pd.Series(MM["silver"].c, index=MM["silver"].t), X.t)
            gs = gold / silv
            gsr = np.r_[np.full(21, np.nan), gs[21:] / gs[:-21] - 1]
            return (gold / C.rmax(gold, 250) - 1 > -0.03) & (np.nan_to_num(gsr) < -0.05)
        raise KeyError(kind)
    return g


def layer(MM, DD, sig, s, back_fear=0.10, back_trend=0.05):
    def fn(X):
        f = C.feats(X, DD)
        n = X.n
        sv = np.asarray(sig(X, f), bool)
        ts = np.where(sv, s, 0.0)
        hi = X.c >= C.rmax(X.c, 126)
        tb = np.where(~sv & (np.nan_to_num(f["fg"], nan=50) < 25), back_fear, np.where(~sv & hi, back_trend, 0.0))
        return ts, tb, np.zeros(n)
    return fn


def main():
    C.tee("r6.txt")
    D, DD, MM, base = C.load()
    for kind, pars in (("heat", (2.5, 3.0, 3.5)), ("cot", (0.90, 0.95)), ("euph", (0,)), ("quiet", (0,))):
        for par in pars:
            X = MM["gold"]
            f = C.feats(X, DD)
            a, b = C.ix(X.t, C.A0), C.ix(X.t, C.CUT)
            cnt = []
            for k in C.DSEL:
                Y = MM[k]
                fy = C.feats(Y, DD)
                m = np.asarray(sells(MM, DD, kind, par)(Y, fy), bool)
                aa, bb = C.ix(Y.t, C.A0), C.ix(Y.t, C.CUT)
                d = np.asarray(Y.t, "datetime64[D]").astype(np.int64)
                cnt.append(f"{C.NAME[k][:3]} {int(m[aa:bb].sum())} дн./{C._clusters(m[aa:bb], d[aa:bb], 10)} эп.")
            print(f"\n--- {kind} {par}: " + ", ".join(cnt))
            for s in (0.02, 0.05):
                o = C.report(f"{kind} {par} s {s:.0%}", C.Layer(layer(MM, DD, sells(MM, DD, kind, par), s)))
                print("    " + C.fafter(o))
            o = C.report(f"{kind} {par} s 2%, откуп только на страхе", C.Layer(layer(MM, DD, sells(MM, DD, kind, par), 0.02, back_trend=0.0)))
            print("    " + C.fafter(o))


if __name__ == "__main__":
    main()
