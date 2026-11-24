"""Круг 4: крипта как ведущий индикатор металлов (диагностика 90 дней; пауза взносов после стресса BTC; не продавать в эйфорию BTC).
Запуск: python3 app/mt4_r4.py"""
import itertools

import numpy as np

import mt4_lib as M


def btc_feats(DD, X):
    b = DD["x"]["btc"]
    r30 = (b / b.shift(30) - 1) * 100                     # календарные дни BTC (торгуется 24/7)
    ath = (b >= b.cummax() * 0.999)
    r30d = M.on_days(r30, X.t)
    athd = M.on_days(ath.astype(float), X.t)
    # события на днях металла: был ли за прошедшие сутки(и) (с прошлого торгового дня) стресс / рекорд
    bb = b.reindex(b.index.union(X.t)).ffill()
    stress_cal = (r30 <= -25)
    return r30, ath, r30d, athd


def ev_days(series_bool, X):
    """Событие календарного ряда BTC → день металла (было ли событие с предыдущего торгового дня металла по текущий)."""
    s = series_bool.astype(int)
    cs = s.cumsum()
    v = M.on_days(cs, X.t)
    v = np.nan_to_num(v)
    return np.r_[v[0] > 0, np.diff(v) > 0]


def main():
    M.tee("r4.txt")
    D = M.mload()
    DD = M.dload()
    MM = M.dmetals(DD, M.DSEL + M.DEXAM)
    BP = {k: M.mmap(M.VERS["Q2"](D[k]), D[k]["t"], MM[k].t, True) for k in MM}
    b = DD["x"]["btc"]
    r30 = (b / b.shift(30) - 1) * 100
    ath = b >= b.cummax() * 0.999
    print("H4a: избыток роста металла за 90 торговых дней после события BTC к обычному (среднее по всем дням эры BTC), %; [половины 2014-10…2020-09 / 2020-10…]:")
    for nm, evc in (("стресс BTC −25% за 30 дн.", r30 <= -25), ("стресс BTC −20%", r30 <= -20), ("рекорд BTC", ath), ("BTC +50% за 30 дн.", r30 >= 50)):
        row = []
        for k in M.DSEL + M.DEXAM:
            X = MM[k]
            ev = ev_days(evc, X)
            f = np.r_[X.c[90:] / X.c[:-90] - 1, np.full(90, np.nan)] * 100
            sg = M.segs_btc(X)
            outs = []
            for a, bnd in [(sg["b1"][0], X.n), sg["b1"], sg["b2"]]:
                w = np.zeros(X.n, bool); w[a:bnd] = True
                w &= np.isfinite(f)
                # события не чаще раза в 30 дней
                e = ev & w
                idx = np.where(e)[0]
                keep = []
                for i in idx:
                    if not keep or i - keep[-1] >= 30:
                        keep.append(i)
                outs.append((np.nanmean(f[keep]) - np.nanmean(f[w]) if keep else np.nan, len(keep)))
            row.append(f"{M.NAME[k][:4]} {outs[0][0]:+.1f} (n{outs[0][1]}) [{outs[1][0]:+.1f}/{outs[2][0]:+.1f}]")
        print(f"  {nm}: " + "; ".join(row))
    base = lambda X: BP[X.k]  # noqa: E731
    print("\nH4b: пауза взносов W дней после стресса BTC (−T% за 30 дн.), отложенное покупается в первый день после окна — к Q2д:")
    by, res = {}, {}
    TS, WS = [20, 25, 30], [30, 60, 90]
    for T, W in itertools.product(TS, WS):
        def f(X, T=T, W=W):
            ev = ev_days(r30 <= -T, X)
            df, rl = M.window_rule(ev, W)
            return BP[X.k], df, rl
        o = M.gstat(MM, f, base, btc=True)
        ok, why = M.gok(o)
        by[(T, W)] = ok; res[(T, W)] = (o, ok, why)
    for key, (o, ok, why) in sorted(res.items(), key=lambda kv: -kv[1][0]["sum"]):
        pl = M.dplateau(by, key, [TS, WS])
        print(f"  {'✓' if ok and pl else '·'} T {key[0]}% W {key[1]}: {M.gfmt(o)}{'' if ok else '  ← ' + why}")
    print("\nH4c: не продавать, если BTC обновлял рекорд за E дней — к Q2д:")
    by, res = {}, {}
    ES = [30, 60, 90]
    for E in ES:
        def f(X, E=E):
            ev = ev_days(ath, X)
            hot = M.L.since(ev) <= E
            p = BP[X.k].copy()
            p[hot & (p < 0)] = 1.0
            return p
        o = M.gstat(MM, f, base, btc=True)
        ok, why = M.gok(o)
        by[(E,)] = ok; res[(E,)] = (o, ok, why)
    for key, (o, ok, why) in res.items():
        pl = M.dplateau(by, key, [ES])
        print(f"  {'✓' if ok and pl else '·'} E {key[0]}: {M.gfmt(o)}{'' if ok else '  ← ' + why}")


if __name__ == "__main__":
    main()
