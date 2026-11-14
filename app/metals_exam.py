"""Экзамен для итоговой стратегии металлов: активы, которые не участвовали ни в поиске маркеров, ни в подборе правил —
олово и железная руда (Всемирный банк, с 1965), палладий (Yahoo, с 1998, средние за месяц). Пороги маркеров — те же,
по восьми металлам до 1999 года. Плюс проверка соседних вариантов: результат не должен держаться на одной точке.

Запуск: python3 app/metals_exam.py
"""
import os
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import data  # noqa: E402
import macro  # noqa: E402
import metals_long as ml  # noqa: E402
from metals_monthly import BOT, CUT, TOP, edge  # noqa: E402
from metals_monthly3 import plan  # noqa: E402

EXAM = {"tin": "Олово", "iron": "Железная руда", "palladium": "Палладий"}


def main():
    X = ml.monthly_table()
    x = pd.read_excel(os.path.join(data.CACHE, "wb_cmo_monthly.xlsx"), sheet_name="Monthly Prices", header=None)
    names = [str(v).strip() for v in x.iloc[4].values]
    body = x.iloc[6:]
    idx = pd.to_datetime(body.iloc[:, 0].astype(str).str.replace("M", "-") + "-01") + pd.offsets.MonthEnd(0)
    for k, col in (("tin", "Tin"), ("iron", "Iron ore, cfr spot")):
        X[k] = pd.Series(pd.to_numeric(body.iloc[:, names.index(col)], errors="coerce").values, index=idx).reindex(X.index)
    pa = macro.long_history("PA=F")["c"]
    X["palladium"] = pa.resample("ME").mean().reindex(X.index)
    allk = list(ml.METALS) + list(EXAM)
    F = {k: ml.features(X, k) for k in allk}
    pool = pd.concat([F[k][F[k].index < CUT] for k in ml.METALS])
    res = {}
    for q in (0.75, 0.8, 0.85):
        thr = {(f, d): float(pool[f].dropna().quantile(q if d == "hi" else 1 - q)) for f, d in TOP + BOT}
        cnt = lambda k, marks: sum(((F[k][f] > thr[(f, d)]) if d == "hi" else (F[k][f] < thr[(f, d)])).fillna(False).astype(int) for f, d in marks)  # noqa: E731
        res[q] = {k: (cnt(k, TOP), cnt(k, BOT)) for k in allk}
    title = {**{k: v[1] for k, v in ml.METALS.items()}, **EXAM}
    cands = [("ИТОГ: пороги 80/20, дна ≥ 4 → взнос и 100% резерва, вершины ≥ 5 → продать 10%, ≥ 6 → 30%", 0.8, ((5, 0.1, True), (4, 1.0), None)),
             ("то же, покупка у дна 50%", 0.8, ((5, 0.1, True), (4, 0.5), None)),
             ("пороги 75/25", 0.75, ((5, 0.1, True), (4, 1.0), None)),
             ("пороги 85/15", 0.85, ((5, 0.1, True), (4, 1.0), None)),
             ("продажа 5% / 15%", 0.8, ((5, 0.05, True), (4, 1.0), None)),
             ("продажа одной ступенью 10%", 0.8, ((5, 0.1, False), (4, 1.0), None)),
             ("вершины ≥ 4 → 5%, ≥ 5 → 15%", 0.8, ((4, 0.05, True), (4, 1.0), None)),
             ("дна ≥ 5", 0.8, ((5, 0.1, True), (5, 1.0), None)),
             ("прежняя (70/30, дна ≥ 5 → весь резерв, вершины ≥ 5 → 5%)", 0.7, ((5, 0.05, False), (5, 1.0), None))]
    q7 = 0.7
    pool70 = {(f, d): float(pool[f].dropna().quantile(q7 if d == "hi" else 1 - q7)) for f, d in TOP + BOT}
    res[0.7] = {k: (sum(((F[k][f] > pool70[(f, d)]) if d == "hi" else (F[k][f] < pool70[(f, d)])).fillna(False).astype(int) for f, d in TOP),
                    sum(((F[k][f] > pool70[(f, d)]) if d == "hi" else (F[k][f] < pool70[(f, d)])).fillna(False).astype(int) for f, d in BOT)) for k in allk}
    for name, q, cand in cands:
        line, ex = [], []
        for k in allk:
            start = "1972-01-01" if k in ("gold", "silver") else "1965-01-01"
            c = X[k][X.index >= start].dropna()
            tn, bn = res[q][k][0].reindex(c.index).values, res[q][k][1].reindex(c.index).values
            p = plan(tn, bn, cand)
            a = {"c": c.values.astype(np.float64)}
            m = int(np.searchsorted(c.index.values, np.datetime64(CUT)))
            full = edge(a, p, 0, len(c))
            if k in EXAM:
                ex.append(full)
                line.append(f"{title[k]} {full:.0f}% (с {c.index[0]:%Y})")
            else:
                line.append(f"{title[k]} {edge(a, p, 0, m):.0f}/{edge(a, p, m, len(c)):.0f}")
        print(f"{name}\n   до 1999 / после: " + ", ".join(line[:8]) + "\n   ЭКЗАМЕН (вся история): " + ", ".join(line[8:]))
    # сделки итоговой стратегии: сколько месяцев продажа и покупка, и в какие годы
    q, cand = 0.8, ((5, 0.1, True), (4, 1.0), None)
    for k in ("gold", "silver", "copper", "platinum"):
        tn, bn = res[q][k]
        c = X[k].dropna()
        tn, bn = tn.reindex(c.index), bn.reindex(c.index)
        years = lambda m: sorted({d.year for d in c.index[m.values]})                                         # noqa: E731
        print(f"{title[k]}: продаж 10% — {int(((tn >= 5) & (tn < 6) & (bn < 4)).sum())} мес., продаж 30% — {int(((tn >= 6) & (bn < 4)).sum())} мес. (годы {years((tn >= 6) & (bn < 4))}); "
              f"покупок у дна — {int((bn >= 4).sum())} мес. (годы {years(bn >= 4)}); сейчас: вершины {int(tn.iloc[-1])}, дна {int(bn.iloc[-1])}")


if __name__ == "__main__":
    main()
