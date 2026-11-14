"""Металлы на месячных данных, третий круг: доводка.

Что перебирается:
- пороги маркеров: 70/30, 75/25 или 80/20 процентилей (только по месяцам до 1999 года);
- набор маркеров: все семь или «ядро» из четырёх самых сильных (цена против средней за 3 года, рост за год / доллар, нефть, ставка ФРС);
- продажа: сколько маркеров вершины нужно, какую долю продавать, одна ступень или две (при k+1 маркерах — втрое больше);
- покупка у дна: сколько маркеров и какую долю резерва;
- возврат резерва: нет или четверть резерва при 3+ маркерах дна.
Золото на DCA, поэтому выбор — по семи остальным металлам. Две проверки во времени: подбор по 1965–1998 → проверка на 1999–2026,
и наоборот. Запуск: python3 app/metals_monthly3.py
"""
import itertools
import os
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import metals_long as ml  # noqa: E402
from metals_monthly import BOT, CUT, TOP, edge  # noqa: E402

CORE_TOP = [TOP[0], TOP[1], TOP[2], TOP[3]]
CORE_BOT = [BOT[0], BOT[1], BOT[2], BOT[3]]
SEVEN = ["silver", "platinum", "copper", "aluminum", "nickel", "lead", "zinc"]


def counts(X, F, q, marks, period):
    """Сколько маркеров выполнено в каждом месяце, с порогами по месяцам периода period ('before' или 'after' CUT)."""
    pool = pd.concat([F[k][(F[k].index < CUT) if period == "before" else (F[k].index >= CUT)] for k in ml.METALS])
    thr = {(f, d): float(pool[f].dropna().quantile(q if d == "hi" else 1 - q)) for f, d in marks}
    return {k: sum(((F[k][f] > thr[(f, d)]) if d == "hi" else (F[k][f] < thr[(f, d)])).fillna(False).astype(int) for f, d in marks) for k in ml.METALS}


def plan(tn, bn, cand):
    s, b, r = cand
    conds, acts = [], []
    if b:
        conds.append(bn >= b[0]); acts.append(1 + b[1])
    if s:
        k, f, graded = s
        if graded:
            conds.append(tn >= k + 1); acts.append(-min(1.0, 3 * f))
        conds.append(tn >= k); acts.append(-f)
    if r:
        conds.append(bn >= 3); acts.append(1.25)
    return np.select(conds, acts, default=1.0).astype(np.float64)


def text(q, setname, cand):
    s, b, r = cand
    n = 7 if setname == "все" else 4
    out = [f"пороги {int(q * 100)}/{int(round((1 - q) * 100))}, маркеров {n}"]
    if b:
        out.append(f"дна ≥ {b[0]} → взнос и {int(b[1] * 100)}% резерва")
    if s:
        k, f, graded = s
        out.append(f"вершины ≥ {k} → продать {f * 100:g}%" + (f", ≥ {k + 1} → {min(100, 3 * f * 100):g}%" if graded else ""))
    if r:
        out.append("дна ≥ 3 → вернуть 25% резерва")
    return " | ".join(out)


def main():
    X = ml.monthly_table()
    F = {k: ml.features(X, k) for k in ml.METALS}
    C = {k: X[k][X.index >= ("1972-01-01" if k in ("gold", "silver") else "1965-01-01")].dropna() for k in ml.METALS}
    res = []
    for period in ("before", "after"):
        for q in (0.7, 0.75, 0.8):
            for setname, (tm, bm) in (("все", (TOP, BOT)), ("ядро", (CORE_TOP, CORE_BOT))):
                TN, BN = counts(X, F, q, tm, period), counts(X, F, q, bm, period)
                ks = (4, 5, 6) if setname == "все" else (3, 4)
                sells = [(k, f, g) for k in ks for f in (0.03, 0.05, 0.1) for g in (False, True)]
                buys = [None] + [(k, g) for k in ks for g in (0.5, 1.0)]
                for cand in itertools.product(sells, buys, (None, True)):
                    e_tr, e_te = {}, {}
                    for k in ml.METALS:
                        c = C[k]
                        tn, bn = TN[k].reindex(c.index).values, BN[k].reindex(c.index).values
                        p = plan(tn, bn, cand)
                        a = {"c": c.values.astype(np.float64)}
                        m = int(np.searchsorted(c.index.values, np.datetime64(CUT)))
                        lo_tr, hi_tr, lo_te, hi_te = (0, m, m, len(c)) if period == "before" else (m, len(c), 0, m)
                        e_tr[k], e_te[k] = edge(a, p, lo_tr, hi_tr), edge(a, p, lo_te, hi_te)
                    res.append({"period": period, "q": q, "set": setname, "cand": cand, "tr": e_tr, "te": e_te})
    names = {k: v[1] for k, v in ml.METALS.items()}
    sv = lambda d: np.array([d[k] for k in SEVEN])                        # noqa: E731
    sc = lambda d: sv(d).min() + np.median(sv(d)) / 2                    # noqa: E731
    for period, title in (("before", "ПОДБОР 1965–1998 → ПРОВЕРКА 1999–2026"), ("after", "ПОДБОР 1999–2026 → ПРОВЕРКА 1965–1998")):
        R = [r for r in res if r["period"] == period]
        ok = [r for r in R if (sv(r["tr"]) > 0).all()]
        a, b = np.array([sc(r["tr"]) for r in R]), np.array([sc(r["te"]) for r in R])
        print(f"\n=== {title} ===\nвариантов {len(R)}; на подборе все 7 металлов в плюсе: {len(ok)}; связь оценки подбора и проверки: {np.corrcoef(a, b)[0, 1]:.2f}")
        best = sorted(ok, key=lambda r: -sc(r["tr"]))
        for r in best[:8]:
            print(f"  {text(r['q'], r['set'], r['cand'])}\n     подбор: худший {sv(r['tr']).min():.0f}%, медиана {np.median(sv(r['tr'])):.0f}% | проверка: в плюсе {(sv(r['te']) > 0).sum()}/7, худший {sv(r['te']).min():.0f}%, медиана {np.median(sv(r['te'])):.0f}%"
                  f" | золото {r['tr']['gold']:.0f}/{r['te']['gold']:.0f} | " + ", ".join(f"{names[k]} {r['te'][k]:.0f}" for k in SEVEN))
        top = best[:30]
        print(f"  топ-30 по подбору: на проверке медиана {np.median([np.median(sv(r['te'])) for r in top]):.0f}%, все 7 в плюсе у {sum((sv(r['te']) > 0).all() for r in top)} из {len(top)}; "
              f"всё семейство на проверке: медиана {np.median([np.median(sv(r['te'])) for r in R]):.0f}%")
        # какие части чаще в топ-30
        for name, key in (("пороги", lambda r: r["q"]), ("набор", lambda r: r["set"]), ("ступени продаж", lambda r: r["cand"][0][2]), ("доля продажи", lambda r: r["cand"][0][1]),
                          ("покупка у дна", lambda r: r["cand"][1] and r["cand"][1][1]), ("возврат", lambda r: r["cand"][2])):
            cnt = {}
            for r in top:
                cnt[str(key(r))] = cnt.get(str(key(r)), 0) + 1
            print(f"    {name}: " + ", ".join(f"{k} — {v}" for k, v in sorted(cnt.items(), key=lambda x: -x[1])))
    # вариант, хороший в обоих направлениях
    both = {}
    for r in res:
        both.setdefault((r["q"], r["set"], r["cand"]), {})[r["period"]] = r
    pairs = [(k, v["before"], v["after"]) for k, v in both.items() if len(v) == 2]
    good = [(k, b, a) for k, b, a in pairs if (sv(b["tr"]) > 0).all() and (sv(b["te"]) > 0).all()]
    good.sort(key=lambda x: -(min(sv(x[1]["tr"]).min(), sv(x[1]["te"]).min()) + (np.median(sv(x[1]["tr"])) + np.median(sv(x[1]["te"]))) / 4))
    print(f"\nВАРИАНТЫ, ГДЕ ВСЕ 7 МЕТАЛЛОВ В ПЛЮСЕ И ДО 1999, И ПОСЛЕ (пороги по 1965–1998): {len(good)}")
    for k, b, a in good[:8]:
        print(f"  {text(*k)}\n     до 1999: худший {sv(b['tr']).min():.0f}%, медиана {np.median(sv(b['tr'])):.0f}% | после 1999: худший {sv(b['te']).min():.0f}%, медиана {np.median(sv(b['te'])):.0f}% | золото {b['tr']['gold']:.0f}/{b['te']['gold']:.0f}"
              f" | после: " + ", ".join(f"{names[m]} {b['te'][m]:.0f}" for m in SEVEN))


if __name__ == "__main__":
    main()
