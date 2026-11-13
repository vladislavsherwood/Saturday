"""Второй проход по маркерам: условный вопрос.

Первый проход (markers.py) нашёл очевидное: у вершины цена высоко, у дна низко. Полезный вопрос другой:
- монета только что обновила 90-дневный максимум. Что отличает настоящую вершину от продолжения роста?
- монета только что обновила 90-дневный минимум. Что отличает настоящее дно от продолжения падения?
Для каждого признака внутри такого набора дней считается AUC (зона разворота против остальных) в четырёх срезах
и что стало с ценой через 90 дней в нижней, средней и верхней трети значений признака.

Запуск: python3 app/markers2.py <markers.pkl> <куда.json>
"""
import json
import sys

import numpy as np
import pandas as pd


def auc(x, y):
    m = ~np.isnan(x)
    x, y = x[m], y[m]
    n1, n0 = y.sum(), (~y).sum()
    if n1 < 25 or n0 < 25:
        return np.nan
    rk = pd.Series(x).rank().values
    return (rk[y].sum() - n1 * (n1 + 1) / 2) / (n1 * n0)


def main(pkl, out):
    A = pd.read_pickle(pkl)
    feats = [k for k in A.columns if k not in ("top", "bot", "rel", "kind", "grp", "coin") and not k.startswith("_")]
    res = {}
    for cond, lab, title, good in (("_hi90", "top", "МОНЕТА НА 90-ДНЕВНОМ МАКСИМУМЕ: настоящая вершина или продолжение роста", -1), ("_lo90", "bot", "МОНЕТА НА 90-ДНЕВНОМ МИНИМУМЕ: настоящее дно или продолжение падения", 1)):
        D = A[A[cond].fillna(False).astype(bool) & A["_f90"].notna()]
        y = D[lab].values.astype(bool)
        cells = [(D.grp == "знакомые") & (D.index < "2022-01-01"), (D.grp == "знакомые") & (D.index >= "2022-01-01"), (D.grp == "случайные") & (D.index < "2022-01-01"), (D.grp == "случайные") & (D.index >= "2022-01-01")]
        print(f"\n=== {title} ===")
        print(f"дней {len(D)} на {D.coin.nunique()} монетах; из них в зоне разворота {y.mean() * 100:.0f}%; цена через 90 дней: медиана {D['_f90'].median():.0f}%, выросла в {(D['_f90'] > 0).mean() * 100:.0f}% случаев")
        rows = []
        for f in feats:
            x = D[f].values.astype(float)
            if np.isfinite(x).mean() < 0.6:
                continue
            cs = [auc(x[m.values], y[m.values]) for m in cells]
            v = [a for a in cs if not np.isnan(a)]
            if len(v) < 3:
                continue
            ok = all(a > 0.5 for a in v) or all(a < 0.5 for a in v)
            q1, q2 = np.nanquantile(x, 1 / 3), np.nanquantile(x, 2 / 3)
            g = [D[x <= q1], D[(x > q1) & (x <= q2)], D[x > q2]]
            rows.append({"f": f, "auc": auc(x, y), "cells": cs, "ok": ok, "min": min(abs(a - 0.5) for a in v), "q": [float(q1), float(q2)],
                         "zone": [float(k[lab].mean() * 100) for k in g], "f90": [float(k["_f90"].median()) for k in g], "win": [float((k["_f90"] * good > 0).mean() * 100) for k in g],
                         "worst": [float(k["_fmin90"].median()) for k in g], "best": [float(k["_fmax90"].median()) for k in g]})
        R = pd.DataFrame(rows)
        q = R[R.ok].sort_values("min", ascending=False).head(26)
        print(f"{'признак':60} {'AUC':>5} {'зн.до':>6} {'зн.после':>8} {'сл.до':>6} {'сл.после':>8} | доля зоны по третям, %  | цена через 90 дней по третям, % | границы третей")
        for _, r in q.iterrows():
            print(f"{r.f[:60]:60} {r.auc:5.2f} " + " ".join(f"{(a if not np.isnan(a) else 0):>7.2f}" for a in r.cells) + " | " + " / ".join(f"{z:3.0f}" for z in r.zone) + "           | " + " / ".join(f"{z:4.0f}" for z in r.f90) + "              | " + " / ".join(f"{z:.3g}" for z in r.q))
        print("  не прошли (меняют знак): " + "; ".join(f"{r.f} ({r.auc:.2f})" for _, r in R[~R.ok].assign(d=lambda d: (d.auc - 0.5).abs()).sort_values("d", ascending=False).head(8).iterrows()))
        res[cond] = json.loads(R.to_json(orient="records"))
    json.dump(res, open(out, "w", encoding="utf-8"), ensure_ascii=False)


if __name__ == "__main__":
    main(*sys.argv[1:])
