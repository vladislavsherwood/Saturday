"""Разбор результатов grid.py: отбор на первой половине истории, проверка на второй.

Запуск: python3 dca/grid_report.py
"""
import os

import numpy as np
import pandas as pd

import backtest as bt
import grid

TOL = bt.TOL
ACT = {-3: "прод×3", -2: "прод×2", -1: "прод×1", 0: "пропуск", 1: "×1", 2: "×2", 3: "×3"}


def describe(meta, i):
    na = len(meta["acts"])
    nm, th = meta["combos"][i // na]
    a = meta["acts"][i % na]
    zones = [f"<{th[0]}", f"{th[0]}–{th[1]}", f"{th[1]}–{th[2]}", f">{th[2]}"]
    return nm + ": " + ", ".join(f"{z} {ACT[int(x)]}" for z, x in zip(zones, a))


def stats(E):
    """E: тикеры x стратегии. Возвращает (хуже, лучше, медиана)."""
    E = np.where(np.isnan(E), -999, E)
    worse = (E < -TOL).sum(axis=0)
    better = (E > TOL).sum(axis=0)
    med = np.median(E, axis=0)
    return worse, better, med


def main():
    edges = np.load(os.path.join(bt.CACHE, "grid_edges.npy"), mmap_mode="r")
    meta = pd.read_pickle(os.path.join(bt.CACHE, "grid_meta.pkl"))
    tk = meta["tickers"]
    sel = [i for i, t in enumerate(tk) if t[2] >= grid.MIN_YEARS]
    n = edges.shape[2]
    print(f"стратегий: {n:,}; тикеров в отборе: {len(sel)} ({', '.join(tk[i][0] for i in sel)})")
    w1, b1, m1 = stats(np.asarray(edges[sel, 0, :]))
    w2, b2, m2 = stats(np.asarray(edges[sel, 1, :]))
    need = (len(sel) + 1) // 2
    p1 = (w1 == 0) & (b1 >= need)
    p2 = (w2 == 0) & (b2 >= need)
    print(f"\nкритерий: ни на одном тикере не хуже DCA и лучше минимум на {need} из {len(sel)}")
    print(f"прошли на 1-й половине: {p1.sum():,} ({p1.mean() * 100:.2f}%)")
    print(f"прошли на 2-й половине: {p2.sum():,} ({p2.mean() * 100:.2f}%)")
    both = p1 & p2
    print(f"прошли на обеих: {both.sum():,}; из прошедших 1-ю половину экзамен сдали {both.sum() / max(p1.sum(), 1) * 100:.1f}%")

    # мягкий критерий: не хуже ни на одном тикере в обеих половинах
    soft = (w1 == 0) & (w2 == 0)
    print(f"\nне хуже DCA нигде в обеих половинах: {soft.sum():,}")
    print(f"  из них медиана преимущества > {TOL} п.п. в обеих половинах: {(soft & (m1 > TOL) & (m2 > TOL)).sum():,}")

    # лучшие по первой половине -> что на второй
    cand = np.where(p1)[0] if p1.sum() else np.where(w1 == 0)[0]
    top = cand[np.argsort(-m1[cand])][:1000]
    print(f"\nтоп-1000 по 1-й половине: медиана преимущества на 1-й {np.median(m1[top]):.1f} п.п., "
          f"на 2-й {np.median(m2[top]):.1f} п.п.; на 2-й без проигрышей {int((w2[top] == 0).sum())} из {len(top)}")

    rows = []
    score = np.minimum(m1, m2)
    pool = np.where(soft)[0]
    for i in pool[np.argsort(-score[pool])][:300]:
        rows.append({"стратегия": describe(meta, i), "медиана_1": round(float(m1[i]), 1),
                     "медиана_2": round(float(m2[i]), 1), "лучше_1": int(b1[i]), "лучше_2": int(b2[i])})
    out = pd.DataFrame(rows)
    out.to_csv(os.path.join(bt.OUT, "grid_top.csv"), index=False)
    pd.set_option("display.width", 250, "display.max_colwidth", 120)
    print("\nлучшие из тех, кто нигде не хуже DCA в обеих половинах:")
    print(out.head(15).to_string(index=False))

    # какие индикаторы и какие действия встречаются среди выживших
    na = len(meta["acts"])
    fam = pd.Series([meta["combos"][i // na][0] for i in pool]).str.replace(r"\d+д?$", "", regex=True)
    print("\nвыжившие по индикаторам:")
    print(fam.value_counts().to_string())
    a = meta["acts"][pool % na]
    print(f"\nсреди выживших с продажами: {(a.min(axis=1) < 0).mean() * 100:.0f}%")

    # по группам: есть ли хоть что-то для акций и металлов
    groups = {}
    for i, t in enumerate(tk):
        if t[2] >= grid.MIN_YEARS:
            groups.setdefault("Акции+Израиль+металлы" if t[1] in ("США", "Израиль", "Металлы") else "Крипта+мемкоины", []).append(i)
    for gname, ids in groups.items():
        gw1, _, gm1 = stats(np.asarray(edges[ids, 0, :]))
        gw2, _, gm2 = stats(np.asarray(edges[ids, 1, :]))
        ok = (gw1 == 0) & (gw2 == 0)
        best = np.where(ok)[0]
        best = best[np.argsort(-np.minimum(gm1, gm2)[best])][:3]
        tr = np.where(gw1 == 0)[0]
        tr = tr[np.argsort(-gm1[tr])][:1000]
        print(f"\n{gname} ({len(ids)} тикеров): нигде не хуже в обеих половинах {ok.sum():,}; "
              f"топ-1000 по 1-й половине: {np.median(gm1[tr]):.1f} п.п. -> на 2-й {np.median(gm2[tr]):.1f} п.п.")
        for i in best:
            print(f"  {describe(meta, i)} | {gm1[i]:.1f} / {gm2[i]:.1f} п.п.")


if __name__ == "__main__":
    main()
