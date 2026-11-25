"""Круг 2 mcx: диагностика дневных аналогов семей combo7 на металлах — избыток будущего роста 21/63/126 дн. после сигнала
(в обеих половинах 2005–15 / 2016–25, 4 металла отбора + палладий справочно). Запуск: python3 app/mcx_r2.py"""
import numpy as np
import pandas as pd

import mcx_lib as C


def signals(MM, DD, k):
    X = MM[k]
    f = C.feats(X, DD)
    sd = f["sd250"]
    S = {}
    S["капитуляция fg<10"] = f["fg"] < 10
    S["капитуляция fg<5"] = f["fg"] < 5
    S["страх fg<40"] = f["fg"] < 40
    S["страх fg<25"] = f["fg"] < 25
    S["жадность fg>65"] = f["fg"] > 65
    S["жадность fg>90"] = f["fg"] > 90
    # разворот от дна: за 21 день +1,5σ√21, а минимум 30 дней назад был ≥ 2σ√126 ниже максимума 126 дн.
    deep = pd.Series(np.log(1 + f["dd126"]) <= -2 * sd * np.sqrt(126)).rolling(30, min_periods=1).max().values.astype(bool)
    S["разворот +1,5σ после −2σ"] = (f["z21"] > 1.5) & deep
    S["разворот +1σ после −2σ"] = (f["z21"] > 1.0) & deep
    # волна «маржин-коллов»: 3 дня суммарно ниже −3σ (дневной σ за 250 дн.)
    r3 = np.r_[np.nan, np.nan, np.nan, np.log(X.c[3:] / X.c[:-3])]
    wave = r3 < -3 * sd * np.sqrt(3)
    S["волна −3σ за 3 дня"] = wave
    w20 = pd.Series(wave).rolling(20, min_periods=1).max().values.astype(bool)
    lo20 = C.rmin(X.c, 20)
    S["после волны: +1σ от мин. 20 дн."] = w20 & (np.log(X.c / lo20) > sd * np.sqrt(5)) & ~wave
    # бегство в доллар: DXY за 21 день > +3% и у 10-дн. максимума
    S["бегство в доллар (DXY +3%/21д)"] = (f["dxy_r21"] > 0.03) & (f["dxy_mx10"] > 0.995)
    S["доллар развернулся (−1% от 10-дн. пика после +3%)"] = (pd.Series(f["dxy_r21"] > 0.03).rolling(15, min_periods=1).max().values.astype(bool)) & (f["dxy_mx10"] < 0.99)
    # VIX-страх (аналог «страх рынка»)
    S["VIX > 30"] = f["vix"] > 30
    # перегрев: цена к SMA200 > 1 + 3σ√200 (своя вол) — «перегретый фандинг»
    S["перегрев: к SMA200 > 3σ"] = np.log(f["ma200"]) > 3 * sd * np.sqrt(50)
    # памп в медвежьем рынке: ниже максимума 250 дн. на ≥ 2σ√250, а от минимума 63 дн. +2σ√63
    S["памп в медвежьем"] = (np.log(1 + f["dd250"]) < -2 * sd * np.sqrt(250) / 2) & (np.log(1 + f["up63"]) > 2 * sd * np.sqrt(63))
    # тихая вершина: золото у рекорда (≤ 3% от максимума 250 дн.), а отношение золото/серебро за 21 день упало ≥ 5% (деньги в серебро)
    gs = C.cross(MM, k, "silver") if k != "silver" else C.cross(MM, "silver", "gold") ** -1
    gold_c = pd.Series(MM["gold"].c, index=MM["gold"].t)
    g = C.on_days(gold_c, X.t)
    gdd = g / C.rmax(g, 250) - 1
    gs = g / C.on_days(pd.Series(MM["silver"].c, index=MM["silver"].t), X.t)
    gsr = np.r_[np.full(21, np.nan), gs[21:] / gs[:-21] - 1]
    S["тихая вершина (золото у макс., з/с −5%)"] = (gdd > -0.03) & (gsr < -0.05)
    S["альтсезон (з/с −8% за 21д, fg>65)"] = (gsr < -0.08) & (f["fg"] > 65)
    return X, f, S


def fwd(c, h):
    return np.r_[np.log(c[h:] / c[:-h]), np.full(h, np.nan)]


def main():
    C.tee("r2.txt")
    D, DD, MM, base = C.load()
    keys = C.DSEL + ["palladium"]
    res = {}
    names = None
    for k in keys:
        X, f, S = signals(MM, DD, k)
        names = list(S)
        d = np.asarray(X.t, "datetime64[D]").astype(np.int64)
        for h in (21, 63, 126):
            fr = fwd(X.c, h)
            for half, (a, b) in C.segs(X).items():
                w = np.zeros(X.n, bool)
                w[a:b] = True
                w &= np.isfinite(fr)
                mu = fr[w].mean()
                for nm, s in S.items():
                    m = w & np.asarray(s, bool)
                    n_ep = C._clusters(m, d, 10)
                    ex = (fr[m].mean() - mu) * 100 if m.sum() else np.nan
                    res[(k, h, half, nm)] = (ex, int(m.sum()), n_ep)
    for nm in names:
        print(f"\n{nm}")
        for h in (21, 63, 126):
            row = []
            for k in keys:
                a = res[(k, h, "A", nm)]
                b = res[(k, h, "B", nm)]
                row.append(f"{C.NAME[k][:3]} {a[0]:+.1f}[{a[2]}]/{b[0]:+.1f}[{b[2]}]")
            # знак в обеих половинах на 4 металлах отбора
            pos = sum(1 for k in C.DSEL if np.nan_to_num(res[(k, h, 'A', nm)][0]) > 0 and np.nan_to_num(res[(k, h, 'B', nm)][0]) > 0)
            neg = sum(1 for k in C.DSEL if np.nan_to_num(res[(k, h, 'A', nm)][0], nan=1) < 0 and np.nan_to_num(res[(k, h, 'B', nm)][0], nan=1) < 0)
            print(f"  {h:>3} дн.: " + "  ".join(row) + f"  | обе половины «+» у {pos}/4, «−» у {neg}/4")
    import pickle
    pickle.dump(res, open(C.LOGDIR + "/r2.pkl", "wb"))


if __name__ == "__main__":
    main()
