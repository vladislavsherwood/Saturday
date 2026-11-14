"""Отчёт «стратегия металлов против DCA»: данные по месяцам для страницы-артефакта.

Взнос $300 в месяц (около $10 в день) с первого месяца истории металла. Решение по данным месяца исполняется по средней цене
следующего месяца, комиссия 0,1%. Стратегия — app/found/metals.json: пороги 80/20 по 1965–1998, дна ≥ 4 → взнос и весь резерв,
вершины ≥ 6 → продать 30%, вершины 5 → продать 10%.

Запуск: python3 app/build_metals_report.py <куда.html>
"""
import json
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
from metals_monthly import BOT, CUT, TOP  # noqa: E402

UNIT, FEE = 300.0, 0.001
ORDER = [("gold", "Золото"), ("silver", "Серебро"), ("platinum", "Платина"), ("palladium", "Палладий"), ("copper", "Медь"), ("aluminum", "Алюминий"),
         ("nickel", "Никель"), ("lead", "Свинец"), ("zinc", "Цинк"), ("tin", "Олово")]
SHORT = {"Цена к средней за 3 года": "цена высоко к средней за 3 года", "Изменение за год, %": "сильный рост за год", "Нефть: изменение за год, %": "нефть дорожает",
         "Доллар к средней за 5 лет": "доллар слабый", "Инфляция: изменение за год, п.п.": "инфляция ускоряется", "Реальная ставка: изменение за год, п.п.": "реальная ставка падает",
         "Золото к серебру: уровень": "серебро обгоняет золото"}
SHORT_B = {"Цена к средней за 3 года": "цена низко к средней за 3 года", "Доллар: изменение за год, %": "доллар укрепляется", "Нефть к средней за 3 года": "нефть дешёвая",
           "Ставка ФРС: изменение за год, п.п.": "ФРС снижает ставку", "Инфляция: изменение за год, п.п.": "инфляция замедляется",
           "Кривая: 10 лет минус ставка ФРС, п.п.": "крутая кривая доходности", "Безработица выше минимума за 3 года, п.п.": "безработица растёт"}


def main(out):
    X = ml.monthly_table()
    x = pd.read_excel(os.path.join(data.CACHE, "wb_cmo_monthly.xlsx"), sheet_name="Monthly Prices", header=None)
    names = [str(v).strip() for v in x.iloc[4].values]
    body = x.iloc[6:]
    idx = pd.to_datetime(body.iloc[:, 0].astype(str).str.replace("M", "-") + "-01") + pd.offsets.MonthEnd(0)
    X["tin"] = pd.Series(pd.to_numeric(body.iloc[:, names.index("Tin")], errors="coerce").values, index=idx).reindex(X.index)
    X["palladium"] = macro.long_history("PA=F")["c"].resample("ME").mean().reindex(X.index)
    F = {k: ml.features(X, k) for k, _ in ORDER}
    pool = pd.concat([F[k][F[k].index < CUT] for k in ml.METALS])
    thr = {(f, d): float(pool[f].dropna().quantile(0.8 if d == "hi" else 0.2)) for f, d in TOP + BOT}
    hit = lambda k, f, d: ((F[k][f] > thr[(f, d)]) if d == "hi" else (F[k][f] < thr[(f, d)])).fillna(False)      # noqa: E731
    res, summary = [], []
    for k, title in ORDER:
        start = "1972-01-01" if k in ("gold", "silver") else "1965-01-01"
        c = X[k][X.index >= start].dropna()
        tn = sum(hit(k, f, d).astype(int) for f, d in TOP).reindex(c.index)
        bn = sum(hit(k, f, d).astype(int) for f, d in BOT).reindex(c.index)
        plan = np.select([bn >= 4, tn >= 6, tn >= 5], [2.0, -0.3, -0.1], default=1.0)
        cash = units = du = 0.0
        kind, amt, eq, dq, res_ = [], [], [], [], []
        for i, p in enumerate(c.values):
            a, before = (plan[i - 1] if i else 1.0), cash
            cash += UNIT
            du += UNIT * (1 - FEE) / p
            kd, am = 0, UNIT
            if a < 0:
                v = -a * units * p
                if v > 0.01:
                    units += a * units; cash += v * (1 - FEE); am = v; kd = 2 if a > -0.2 else 3
                else:
                    kd, am = 4, 0.0
            else:
                v = min(cash, UNIT + (a - 1) * before)
                units += v * (1 - FEE) / p; cash -= v; am = v
                kd = 1 if v > UNIT * 1.001 else 0
            kind.append(kd); amt.append(round(am, 2)); eq.append(round(cash + units * p, 2)); dq.append(round(du * p, 2)); res_.append(round(cash, 2))
        top_now = [SHORT[f] for f, d in TOP if bool(hit(k, f, d).reindex(c.index).iloc[-1])]
        bot_now = [SHORT_B[f] for f, d in BOT if bool(hit(k, f, d).reindex(c.index).iloc[-1])]
        a0 = int(plan[-1] == 2.0) * 1 + int(plan[-1] == -0.3) * 3 + int(plan[-1] == -0.1) * 2
        res.append({"k": k, "name": title, "months": [d.strftime("%Y-%m") for d in c.index], "c": [float(f"{v:.5g}") for v in c.values], "kind": kind, "amt": amt,
                    "eq": eq, "dq": dq, "res": res_, "tn": int(tn.iloc[-1]), "bn": int(bn.iloc[-1]), "top_now": top_now, "bot_now": bot_now, "next": a0, "exam": k in ("tin", "palladium")})
        m = int(np.searchsorted(c.index.values, np.datetime64(CUT)))
        def edge(lo, hi):
            u = cs = d2 = 0.0
            for i in range(lo, hi):
                p, a, b = c.values[i], (plan[i - 1] if i > lo else 1.0), cs
                cs += UNIT; d2 += UNIT * (1 - FEE) / p
                if a < 0:
                    v = -a * u * p; u += a * u; cs += v * (1 - FEE)
                else:
                    v = min(cs, UNIT + (a - 1) * b); u += v * (1 - FEE) / p; cs -= v
            return ((u * c.values[hi - 1] + cs) / (d2 * c.values[hi - 1]) - 1) * 100
        summary.append((title, c.index[0].strftime("%Y"), edge(0, m) if m > 24 else None, edge(m, len(c)), edge(0, len(c)), eq[-1], dq[-1], UNIT * len(c)))
    print(f"{'металл':10} {'с':>5} {'до 1999':>8} {'после':>7} {'вся':>7} | {'стратегия':>13} {'DCA':>13} {'внесено':>10}")
    for t, y, a, b, f, e, d, inv in summary:
        print(f"{t:10} {y:>5} {(f'{a:+.0f}%' if a is not None else '—'):>8} {b:+6.0f}% {f:+6.0f}% | {e:13,.0f} {d:13,.0f} {inv:10,.0f}")
    payload = {"unit": UNIT, "asof": X.index[-1].strftime("%Y-%m"), "metals": res,
               "thr_top": [f"{SHORT[f]}: {'больше' if d == 'hi' else 'меньше'} {thr[(f, d)]:.3g}" for f, d in TOP], "thr_bot": [f"{SHORT_B[f]}: {'больше' if d == 'hi' else 'меньше'} {thr[(f, d)]:.3g}" for f, d in BOT],
               "summary": [{"name": t, "from": y, "before": a, "after": b, "full": f} for t, y, a, b, f, e, d, inv in summary]}
    tpl = open(os.path.join(HERE, "metals_report_template.html"), encoding="utf-8").read()
    open(out, "w", encoding="utf-8").write(tpl.replace("/*DATA*/null", json.dumps(payload, ensure_ascii=False, separators=(",", ":"))))
    print(out, round(os.path.getsize(out) / 1024), "КБ")


if __name__ == "__main__":
    main(sys.argv[1])
