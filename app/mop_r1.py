"""Круг 1 mop: диагностика опционных режимов металлов (до 2025-12) и сделок mb1. Запуск: python3 app/mop_r1.py (лог scratchpad/mop/r1.txt)"""
import numpy as np
import pandas as pd

import mop_lib as P

END = pd.Timestamp(P.END25)
HALF = pd.Timestamp("2016-01-01")


def feats(X):
    """Признаки по дням металла X (только прошлое)."""
    V = P.vol()
    own = {"gold": "^GVZ", "silver": "VXSLV", "platinum": "^GVZ", "copper": "^OVX", "palladium": "^GVZ", "aluminum": "^OVX"}[X.k]
    iv_s = V[own]
    iv = P.on(iv_s, X)
    # для VXSLV в разрыве 2022–25 ряд не продлеваем: значение старше 10 дней → nan
    last = P.on(pd.Series(iv_s.index, index=iv_s.index), X)
    age = (X.t.values - pd.to_datetime(last).values) / np.timedelta64(1, "D")
    iv = np.where(age <= 10, iv, np.nan)
    pc = P.on(P.pctl(iv_s), X)
    pc = np.where(age <= 10, pc, np.nan)
    sma = P.on(iv_s.rolling(50, min_periods=40).mean(), X)
    rv = P.rvol(X.c)
    c = X.c
    hi = pd.Series(c).rolling(252, min_periods=200).max().values
    r63 = P.M.ret(c, 63)
    iv63 = P.on(iv_s / iv_s.shift(63) - 1, X) * 100
    vix = P.on(V["^VIX"], X)
    vix3 = P.on(V["^VIX3M"], X)
    gvz = P.on(V["^GVZ"], X)
    ovx_p = P.on(P.pctl(V["^OVX"]), X)
    F = {
        "страх: перцентиль > 0,9": pc > 0.9,
        "всплеск: вол/SMA50 > 1,3": iv / sma > 1.3,
        "IV/RV < 1 (реализ. выше)": iv / rv < 1.0,
        "IV/RV > 1,6 (дорогая)": iv / rv > 1.6,
        "дёшево: перцентиль < 0,2": pc < 0.2,
        "дёшево у макс.: пц < 0,2, цена ≥ 95% макс.": (pc < 0.2) & (c >= 0.95 * hi),
        "вол с ценой: вол 63д ≥ +20%, цена ≥ +10%, у макс.": (iv63 >= 20) & (r63 >= 10) & (c >= 0.95 * hi),
        "инверсия VIX/VIX3M > 1": vix / vix3 > 1.0,
        "GVZ − VIX > 0": gvz - vix > 0,
        "GVZ − VIX < −8": gvz - vix < -8,
        "OVX перцентиль > 0,9": ovx_p > 0.9,
    }
    return {k: np.nan_to_num(v.astype(float), nan=0).astype(bool) & np.isfinite(iv) for k, v in F.items()}, iv, pc


def main():
    P.tee("r1.txt")
    D, DD, MM = P.load()
    print("A) Избыток форвардного лог-роста (п.п.) к среднему того же металла за дни с данными; половины 2008-06…2015 / 2016…2025; цены до 2025-12-31.")
    print("   126 дн. H1/H2 [эпизодов], 252 дн. H1/H2; 'дней' — в режиме")
    res = {}
    for k in P.DSEL + ["palladium"]:
        X = MM[k]
        F, iv, pc = feats(X)
        e = P._ix(X.t, P.END25 + " 23:59")
        c = X.c[:e]
        t = X.t[:e]
        f126, f252 = P.fwd(c, 126), P.fwd(c, 252)
        h1 = (t >= P.C08) & (t < HALF)
        h2 = t >= HALF
        base = np.isfinite(iv[:e])
        print(f"\n  {P.NAME[k]} (своя вол: {'GVZ' if k in ('gold', 'platinum', 'palladium') else 'VXSLV' if k == 'silver' else 'OVX'})")
        for nm, m in F.items():
            m = m[:e]
            row = []
            for f in (f126, f252):
                for h in (h1, h2):
                    d = h & base & np.isfinite(f)
                    x = d & m
                    row.append(np.nanmean(f[x]) - np.nanmean(f[d]) if x.sum() >= 10 else np.nan)
            n1 = len(P.B.episodes(m & h1, 21))
            n2 = len(P.B.episodes(m & h2, 21))
            res[(k, nm)] = row + [n1, n2]
            print(f"    {nm:<48} дней {int(m.sum()):5d} | 126д {row[0]:+6.1f}/{row[1]:+6.1f} [{n1}/{n2}] | 252д {row[2]:+6.1f}/{row[3]:+6.1f}")
    print("\nСВОДКА: признак → у скольких металлов отбора знак 126 дн. одинаков в обеих половинах и |избыток| ≥ 3 (знак +/−)")
    for nm in F:
        plus = [k for k in P.DSEL if np.all(np.array(res[(k, nm)][:2]) >= 3)]
        minus = [k for k in P.DSEL if np.all(np.array(res[(k, nm)][:2]) <= -3)]
        ep = sum(res[(k, nm)][4] + res[(k, nm)][5] for k in P.DSEL)
        print(f"  {nm:<48} + {len(plus)} ({','.join(P.NAME[x][:3] for x in plus)}) | − {len(minus)} ({','.join(P.NAME[x][:3] for x in minus)}) | эпизодов Σ {ep}")

    print("\nB) Сделки mb1 2008-06…2025-12 по режиму своей вол (перцентиль за год): месяцы продаж, доля «продано перед ростом» (цена через 252 дн. > цены продажи),")
    print("   средний рост после продажи 126/252 дн.; докупки серии: цена докупки к минимуму следующих 252 дн.")
    for k in P.DSEL + ["palladium"]:
        X = MM[k]
        F, iv, pc = feats(X)
        p = P.mb1(X)
        e = P._ix(X.t, P.END25 + " 23:59")
        c = X.c
        per = pd.DatetimeIndex(X.t).to_period("M")
        f126, f252 = P.fwd(c, 126), P.fwd(c, 252)
        sell = (p < 0) & (X.t >= P.C08)
        sell[e:] = False
        out = []
        for lo, hi_, nm in ((-1, 0.3, "низкая (< 0,3)"), (0.3, 0.7, "средняя"), (0.7, 2, "высокая (> 0,7)"), (-9, 9, "нет данных")):
            if nm == "нет данных":
                m = sell & ~np.isfinite(pc)
            else:
                m = sell & np.isfinite(pc) & (pc >= lo) & (pc < hi_)
            months = sorted(set(per[m]))
            if not months:
                out.append(f"{nm}: 0")
                continue
            # первый день каждого месяца продаж
            idx = [int(np.where(per == mm)[0][0]) for mm in months]
            up = np.array([f252[i] for i in idx])
            up = up[np.isfinite(up)]
            out.append(f"{nm}: мес. {len(months)} ({','.join(str(x)[2:] for x in months[:8])}{'…' if len(months) > 8 else ''}), перед ростом {np.mean(up > 0) * 100 if len(up) else np.nan:.0f}%, "
                       f"рост 126/252 {np.nanmean([f126[i] for i in idx]):+.0f}/{np.nanmean([f252[i] for i in idx]):+.0f}")
        print(f"  {P.NAME[k]} продажи: " + " | ".join(out))
        buy = (p > 1) & (X.t >= P.C08)
        buy[e:] = False
        fmin = np.array([c[i:min(len(c), i + 253)].min() for i in range(len(c))])
        for nm, m in (("всплеск вол/SMA50 > 1,3 или пц > 0,9", F["страх: перцентиль > 0,9"] | F["всплеск: вол/SMA50 > 1,3"]),):
            a = buy & m
            b = buy & ~m
            fa = (c[a] / fmin[a] - 1).mean() * 100 if a.sum() else np.nan
            fb = (c[b] / fmin[b] - 1).mean() * 100 if b.sum() else np.nan
            print(f"     докупки серии: при страхе дней {int(a.sum())}, выше будущего мин. {fa:.0f}% | без страха {int(b.sum())}, {fb:.0f}%")

    print("\nC) Сейчас (последний день): ", end="")
    V = P.vol()
    for s in ("^GVZ", "VXSLV", "VXGDX", "^OVX", "^VIX", "^VIX3M", "^MOVE"):
        x = V[s]
        print(f"{s} {x.iloc[-1]:.1f} ({str(x.index[-1])[:10]}, пц года {P.pctl(x).iloc[-1]:.2f})", end="; ")
    print()


if __name__ == "__main__":
    main()
