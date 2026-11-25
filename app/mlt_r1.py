"""Круг 1 mlt: диагностика — будущий рост после состояний контртренда и тренда (A / B), потолок «оракула», цена случайной торговли.
Запуск: python3 app/mlt_r1.py"""
import numpy as np

import mlt_lib as L

NM = L.NAME


def states(X):
    f = L.F(X)
    c = X.c
    sd = f["sd250"]
    s20 = L.sstd(c, 20)
    bz = (c - L.sma(c, 20)) / s20
    st = {
        "RSI14 > 70": f["rsi"] > 70, "RSI14 < 30": f["rsi"] < 30,
        "Боллинджер z20 > +2": bz > 2, "Боллинджер z20 < −2": bz < -2,
        "рост 21 дн. > +1,5σ": f["z21"] > 1.5, "рост 21 дн. < −1,5σ": f["z21"] < -1.5,
        "рост 10 дн. > +1,5σ": f["z10"] > 1.5, "рост 10 дн. < −1,5σ": f["z10"] < -1.5,
        "к SMA50 > +2σ√25": np.log(f["ma50"]) > 2 * sd * 5, "к SMA50 < −2σ√25": np.log(f["ma50"]) < -2 * sd * 5,
        "цена > SMA200": f["ma200"] > 1, "цена < SMA200": f["ma200"] < 1,
        "цена > SMA100": c > L.sma(c, 100), "цена < SMA100": c < L.sma(c, 100),
        "цена > SMA50": f["ma50"] > 1, "цена < SMA50": f["ma50"] < 1,
        "импульс 126 дн. > 0": f["r126"] > 0, "импульс 126 дн. < 0": f["r126"] < 0,
        "импульс 250 дн. > 0": f["r250"] > 0, "импульс 250 дн. < 0": f["r250"] < 0,
        "SMA50 > SMA200": L.sma(c, 50) > L.sma(c, 200), "SMA50 < SMA200": L.sma(c, 50) < L.sma(c, 200),
        "Дончиан: у макс. 50 дн.": c >= L.rmax(c, 50), "Дончиан: у мин. 50 дн.": c <= L.rmin(c, 50),
    }
    return st


# ожидаемый знак: контртренд — «перекупленность → ниже», тренд — «выше средней → выше»
EXP = {"RSI14 > 70": -1, "RSI14 < 30": +1, "Боллинджер z20 > +2": -1, "Боллинджер z20 < −2": +1, "рост 21 дн. > +1,5σ": -1, "рост 21 дн. < −1,5σ": +1,
       "рост 10 дн. > +1,5σ": -1, "рост 10 дн. < −1,5σ": +1, "к SMA50 > +2σ√25": -1, "к SMA50 < −2σ√25": +1,
       "цена > SMA200": +1, "цена < SMA200": -1, "цена > SMA100": +1, "цена < SMA100": -1, "цена > SMA50": +1, "цена < SMA50": -1,
       "импульс 126 дн. > 0": +1, "импульс 126 дн. < 0": -1, "импульс 250 дн. > 0": +1, "импульс 250 дн. < 0": -1,
       "SMA50 > SMA200": +1, "SMA50 < SMA200": -1, "Дончиан: у макс. 50 дн.": +1, "Дончиан: у мин. 50 дн.": -1}


def main():
    L.tee("r1.txt")
    D, DD, MM, base = L.load()
    print("Круг 1. Избыток будущего лог-роста после состояния (к среднему всех дней той же половины), п.п.; A 2005–15 / B 2016–25 (окна до 2025-12)\n")
    keys = L.DSEL + ["palladium"]
    res = {}
    for h in (5, 21, 63):
        print(f"--- горизонт {h} дн. ---")
        print("состояние | ожид. знак | " + " | ".join(f"{NM[k]} A/B" for k in keys) + " | совпало в обеих (из 4 отбора) | доля дней (зол., A/B)")
        for nm in EXP:
            row, agree, share = [], 0, ""
            for k in keys:
                X = MM[k]
                st = states(X)[nm]
                fw = L.fwd(X.c, h)
                cells = []
                good = True
                for hh, (a, b_) in L.segs(X).items():
                    sl = slice(a, b_ - h)
                    m = np.isfinite(fw[sl])
                    s = np.asarray(st[sl], bool) & m
                    if s.sum() < 10:
                        cells.append(np.nan)
                        good = False
                        continue
                    x = (np.nanmean(fw[sl][s]) - np.nanmean(fw[sl][m])) * 100
                    cells.append(x)
                    good &= np.sign(x) == EXP[nm]
                    if k == "gold":
                        share += f"{s.mean() * 100:.0f}/"
                if k in L.DSEL:
                    agree += bool(good)
                row.append("/".join("—" if not np.isfinite(x) else f"{x:+.1f}" for x in cells))
                res[(h, nm, k)] = cells
            print(f"{nm} | {'+' if EXP[nm] > 0 else '−'} | " + " | ".join(row) + f" | **{agree}/4** | {share[:-1]}")
        print()

    # ---- потолок «оракула» и цена случайной торговли ----
    print("Потолок и случайная торговля (f = 30%, прибавка к ядру, % ; A / B / 2005–25):")
    rng = np.random.default_rng(0)
    for core in ("mb1", "dca"):
        print(f"  ядро {core}:")
        for k in L.DSEL:
            X = MM[k]
            sg = L.segs(X)
            full = (sg["A"][0], sg["B"][1])
            out = []
            for h in (21, 63):
                fw = L.fwd(X.c, h)
                eo = np.r_[(fw[1:] > 0).astype(float), 1.0]   # оракул: держит металл, если следующие h дней рост (решение «вчера» → знает будущее)
                v = []
                for seg in (sg["A"], sg["B"], full):
                    rc = L.R(X, None, seg, core)
                    v.append(L.rel(L.combo(rc, L.R(X, eo, seg, core), L.F0), rc))
                out.append(f"оракул {h} дн. " + "/".join(f"{x:+.0f}" for x in v))
            # случайная торговля: отрезки в металле ~ эксп. 120 дн., вне ~ 60 дн. (≈ 2,8 сделки/год, 67% в металле)
            sims = []
            for s in range(30):
                e = np.ones(X.n)
                i, st = 0, 1.0
                while i < X.n:
                    ln = int(rng.exponential(120 if st == 1 else 60)) + 1
                    e[i:i + ln] = st
                    i += ln
                    st = 1 - st
                v = []
                for seg in (sg["A"], sg["B"], full):
                    rc = L.R(X, None, seg, core)
                    v.append(L.rel(L.combo(rc, L.R(X, e, seg, core), L.F0), rc))
                sims.append(v)
            sims = np.array(sims)
            med = np.median(sims, 0)
            print(f"    {NM[k]}: {'; '.join(out)}; случайная (67% в металле, ~2,8 сделки/год), медиана " + "/".join(f"{x:+.1f}" for x in med)
                  + f", 10–90% (2005–25) {np.percentile(sims[:, 2], 10):+.1f}…{np.percentile(sims[:, 2], 90):+.1f}")


if __name__ == "__main__":
    main()
