"""Круг 5: доллар (DXY), реальная ставка (^TNX минус инфляция), VIX-шоки — диагностика и правила поверх Q2д. Запуск: python3 app/mt4_r5.py"""
import itertools

import numpy as np
import pandas as pd

import mt4_lib as M


@M.njit(cache=True)
def buy_events(cond, gap):
    out = np.zeros(len(cond), np.bool_)
    last = -10 ** 6
    for i in range(len(cond)):
        if cond[i] and i - last >= gap:
            out[i] = True
            last = i
    return out


def feats(DD, X):
    dxy = M.on_days(DD["x"]["dxy"], X.t)
    tnx = M.on_days(DD["x"]["tnx"], X.t)
    vix = M.on_days(DD["x"]["vix"], X.t)
    cpi = DD["monthly"]["cpi"].dropna()
    infl = (cpi / cpi.shift(12) - 1) * 100
    inf_d = M.monthly_on_days(infl, X.t, lag_days=14)            # публикация ~ через 2 недели после месяца
    real = tnx - inf_d
    return {"dxy90": M.ret(dxy, 63), "real90": real - pd.Series(real).shift(63).values, "vix": vix}


def fwd(X, h=63):
    return np.r_[X.c[h:] / X.c[:-h] - 1, np.full(h, np.nan)] * 100


def main():
    M.tee("r5.txt")
    D = M.mload()
    DD = M.dload()
    MM = M.dmetals(DD, M.DSEL + M.DEXAM)
    BP = {k: M.mmap(M.VERS["Q2"](D[k]), D[k]["t"], MM[k].t, True) for k in MM}
    F = {k: feats(DD, MM[k]) for k in MM}
    print("H5a: избыток роста за 63 торговых дня (≈90 календарных) к обычному, %, [H1 / H2] (события не чаще раза в 30 дней):")
    evs = {"DXY за 90 дн. ≤ −4%": lambda f: f["dxy90"] <= -4, "DXY за 90 дн. ≥ +4%": lambda f: f["dxy90"] >= 4,
           "реальная ставка +0,5 п.п. за 90 дн.": lambda f: f["real90"] >= 0.5, "реальная ставка −0,5 п.п.": lambda f: f["real90"] <= -0.5,
           "VIX ≥ 30": lambda f: f["vix"] >= 30, "VIX ≥ 40": lambda f: f["vix"] >= 40}
    for nm, fn in evs.items():
        row = []
        for k in M.DSEL + M.DEXAM:
            X = MM[k]
            fw = fwd(X)
            e = buy_events(np.nan_to_num(fn(F[k])).astype(bool), 30)
            parts = []
            for a, b in ((0, X.n), (0, X.hs), (X.hs, X.n)):
                w = np.zeros(X.n, bool); w[a:b] = True
                w &= np.isfinite(fw)
                parts.append((np.nanmean(fw[e & w]) - np.nanmean(fw[w]) if (e & w).any() else np.nan, int((e & w).sum())))
            row.append(f"{M.NAME[k][:4]} {parts[0][0]:+.1f} n{parts[0][1]} [{parts[1][0]:+.1f}/{parts[2][0]:+.1f}]")
        print(f"  {nm}: " + "; ".join(row))
    base = lambda X: BP[X.k]  # noqa: E731
    print("\nH5b: VIX ≥ V → купить на долю g резерва (не чаще раза в 30 дней) — к Q2д:")
    VS, GS = [30, 35, 40], [0.1, 0.2, 0.3]
    by, res = {}, {}
    for V, g in itertools.product(VS, GS):
        def f(X, V=V, g=g):
            e = buy_events(np.nan_to_num(F[X.k]["vix"]) >= V, 30)
            p = BP[X.k].copy()
            p[e & (p >= 0)] = 1 + g
            return p
        o = M.gstat(MM, f, base)
        ok, why = M.gok(o)
        by[(V, g)] = ok; res[(V, g)] = (o, ok, why)
    for key, (o, ok, why) in sorted(res.items(), key=lambda kv: -kv[1][0]["sum"]):
        pl = M.dplateau(by, key, [VS, GS])
        print(f"  {'✓' if ok and pl else '·'} V {key[0]} g {key[1]:.0%}: {M.gfmt(o)}{'' if ok else '  ← ' + why}")
    print("\nH5c: DXY за 90 дн. ≥ +D% → пауза взносов (выпуск при окончании или через 120 дн.) — к Q2д:")
    DS = [3, 4, 5]
    by, res = {}, {}
    for Dd in DS:
        def f(X, Dd=Dd):
            c = np.nan_to_num(F[X.k]["dxy90"]) >= Dd
            df = np.zeros(X.n, bool); rl = np.zeros(X.n, bool)
            run = 0
            for i in range(X.n):
                if c[i] and run < 120:
                    df[i] = True; run += 1
                else:
                    if run > 0:
                        rl[i] = True
                    run = 0 if not c[i] else run
            return BP[X.k], df, rl
        o = M.gstat(MM, f, base)
        ok, why = M.gok(o)
        by[(Dd,)] = ok; res[(Dd,)] = (o, ok, why)
    for key, (o, ok, why) in res.items():
        pl = M.dplateau(by, key, [DS])
        print(f"  {'✓' if ok and pl else '·'} D {key[0]}%: {M.gfmt(o)}{'' if ok else '  ← ' + why}")


if __name__ == "__main__":
    main()
