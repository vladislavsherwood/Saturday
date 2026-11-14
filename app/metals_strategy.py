"""Стратегия для металлов из макромаркеров вершин и дна.

Модель та же, что для крипты: каждый торговый день взнос $10 идёт в резерв; план дня — обычный взнос (1), взнос и доля f
резерва (1 + f), продать долю f позиции (−f). Решение по закрытию дня исполняется по закрытию следующего; комиссия 0,1%;
берётся худший из двух вариантов исполнения (на следующий день и ещё на день позже). Итог — к обычному DCA, %.

Отбор: золото, серебро, медь. Экзамен: платина, палладий. Второй экзамен: фонды, которых отбор не видел
(золотодобытчики GDX, медные компании COPX, металлы и добыча XME, алюминий). Проверка во времени: пороги маркеров
считаются только по данным до 2013 года, стратегия выбирается на первой половине и проверяется на второй.

Запуск: python3 app/metals_strategy.py <куда.json>
"""
import itertools
import json
import os
import sys
import warnings

import numpy as np
import pandas as pd
from numba import njit

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import macro  # noqa: E402
from metals_markers import METALS, macro_features  # noqa: E402
from markers import roll  # noqa: E402

EXTRA = {"gdx": ("GDX", "Золотодобытчики"), "copx": ("COPX", "Медные компании"), "xme": ("XME", "Металлы и добыча"), "alu": ("ALI=F", "Алюминий")}
SEL, EXAM, EXAM2 = ["gold", "silver", "copper"], ["platinum", "palladium"], list(EXTRA)
# маркер: (признак, знак «тревоги», порог по всей истории)
TOP = [("Золото к серебру: соотношение против средней за 200 дней", "<", 0.941), ("Платина к золоту: соотношение против средней за 200 дней", ">", 1.02),
       ("Инфляция: изменение за полгода, п.п.", ">", 0.388), ("Нефть: изменение за год, %", ">", 19.7), ("Реальная доходность 10 лет (TIPS), %", "<", 0.65),
       ("Безработица: изменение за полгода, п.п.", "<", -0.2), ("Отклонение ставки от нейтральной, п.п.", "<", -2.83)]
BOT = [("Нефть: цена к средней за 200 дней", "<", 0.89), ("Медь к золоту: соотношение против средней за 200 дней", "<", 0.915),
       ("Платина к золоту: соотношение против средней за 200 дней", "<", 0.914), ("Акции: изменение за год, %", "<", 0.361),
       ("Золото к нефти: соотношение против средней за 200 дней", ">", 1.09), ("Акции: до исторического максимума, %", ">", 18.3)]
FEE, UNIT = 0.001, 10.0


@njit(cache=True)
def sim(c, plan, a, b, lag):
    """Итог к DCA, % на отрезке [a, b) при исполнении через lag + 1 дней после решения."""
    cash = 0.0
    units = 0.0
    du = 0.0
    for i in range(a, b):
        p = c[i]
        j = i - 1 - lag
        x = plan[j] if j >= 0 else 1.0
        before = cash
        cash += UNIT
        du += UNIT * (1 - FEE) / p
        if x < 0:
            amt = -x * units * p
            if amt > 0:
                units += x * units
                cash += amt * (1 - FEE)
        elif x > 0:
            amt = min(cash, UNIT + (x - 1) * before)
            units += amt * (1 - FEE) / p
            cash -= amt
    return ((units * c[b - 1] + cash) / (du * c[b - 1]) - 1) * 100


def edge(c, plan, a, b):
    return min(sim(c, plan, a, b, 0), sim(c, plan, a, b, 1))


def load():
    hist = {k: macro.long_history(v[0])["c"] for k, v in METALS.items()}
    for k, (sym, _) in EXTRA.items():
        hist[k] = macro.long_history(sym)["c"]
    idx = hist["gold"].index
    M = macro.table(idx)
    X = macro_features(M, hist)
    return hist, X


def counts(X, marks):
    return sum(((X[f] > v) if op == ">" else (X[f] < v)).astype(int) for f, op, v in marks)


def thresholds_before(hist, X, cutoff):
    """Пороги маркеров только по данным до cutoff: граница крайней трети на днях, когда металл у 90-дневного максимума (минимума)."""
    out = []
    for marks, flag in ((TOP, "hi"), (BOT, "lo")):
        vals = {f: [] for f, _, _ in marks}
        for k in METALS:
            c = hist[k]
            c = c[c.index < cutoff]
            on = ((c >= c.rolling(90, min_periods=60).max()) if flag == "hi" else (c <= c.rolling(90, min_periods=60).min())).rolling(7).max() > 0
            Xi = X.reindex(c.index, method="ffill")[on.values]
            for f, _, _ in marks:
                vals[f].append(Xi[f].dropna().values)
        out.append([(f, op, float(np.quantile(np.concatenate(vals[f]), 1 / 3 if op == "<" else 2 / 3))) for f, op, _ in marks])
    return out


def assets(hist, X, top, bot):
    """По каждому активу: цены и признаки, из которых собираются правила."""
    tn, bn = counts(X, top), counts(X, bot)
    A = {}
    for k, c in hist.items():
        c = c[c.index >= "2001-01-01"]
        s200 = (c / roll(c, 200)).values
        hi = ((c >= c.rolling(90, min_periods=60).max()).rolling(7).max() > 0).values
        lo = ((c <= c.rolling(90, min_periods=60).min()).rolling(7).max() > 0).values
        A[k] = {"c": c.values.astype(np.float64), "t": c.index, "hi": hi, "lo": lo, "s200": np.nan_to_num(s200, nan=1.0),
                "tn": tn.reindex(c.index, method="ffill").fillna(0).values, "bn": bn.reindex(c.index, method="ffill").fillna(0).values}
    return A


def candidates():
    """Семейство стратегий: продажа у вершины (две ступени), покупка у дна, возврат резерва."""
    out = []
    sells = [("hi", k1, f1, k2, f2) for (k1, k2) in ((2, 4), (3, 4), (3, 5), (4, 5), (4, 6)) for f1 in (0.01, 0.03, 0.1) for f2 in (0.05, 0.15, 0.4)] \
        + [("up", k1, f1, k2, f2) for (k1, k2) in ((3, 5), (4, 5), (4, 6)) for f1 in (0.01, 0.03) for f2 in (0.05, 0.15)] + [None]
    buys = [None] + [(w, kb, g) for w in ("lo", "any") for kb in (3, 4) for g in (0.25, 1.0)]
    rets = [None, ("hi0", 1.0), ("hi0", 0.25), ("up0", 0.1), ("b3up", 1.0), ("b2", 0.1)]
    for s, b, r in itertools.product(sells, buys, rets):
        if s is None and b is None:
            continue
        out.append((s, b, r))
    return out


def plan_of(a, cand):
    s, b, r = cand
    conds, acts = [], []
    if b:
        w, kb, g = b
        conds.append(((a["lo"]) if w == "lo" else np.ones(len(a["c"]), bool)) & (a["bn"] >= kb)); acts.append(1 + g)
    if s:
        w, k1, f1, k2, f2 = s
        gate = a["hi"] if w == "hi" else (a["s200"] > 1)
        conds.append(gate & (a["tn"] >= k2)); acts.append(-f2)
        conds.append(gate & (a["tn"] >= k1)); acts.append(-f1)
    if r:
        w, g = r
        m = {"hi0": a["hi"] & (a["tn"] <= 1), "up0": (a["s200"] > 1) & (a["tn"] <= 1), "b3up": (a["bn"] >= 3) & (a["s200"] > 1), "b2": a["bn"] >= 2}[w]
        conds.append(m); acts.append(1 + g)
    return np.select(conds, acts, default=1.0).astype(np.float64)


def text(cand):
    s, b, r = cand
    out = []
    if b:
        out.append(f"{'на 90-дн. минимуме и ' if b[0] == 'lo' else ''}маркеров дна ≥ {b[1]} → взнос и {int(b[2] * 100)}% резерва")
    if s:
        g = "на 90-дн. максимуме" if s[0] == "hi" else "выше средней 200"
        out.append(f"{g}: маркеров вершины ≥ {s[3]} → продать {s[4] * 100:g}%, ≥ {s[1]} → продать {s[2] * 100:g}%")
    if r:
        out.append({"hi0": "на максимуме и маркеров вершины ≤ 1", "up0": "выше средней 200 и маркеров вершины ≤ 1", "b3up": "маркеров дна ≥ 3 и цена выше средней 200", "b2": "маркеров дна ≥ 2"}[r[0]] + f" → вернуть {int(r[1] * 100)}% резерва")
    return " | ".join(out)


def score(A, cand, keys, part="full", cut=None):
    """Итог к DCA по каждому активу. part: full, h1, h2 (половины истории актива) или before / after календарной даты cut."""
    out = []
    for k in keys:
        a = A[k]
        n = len(a["c"])
        lo, hi = 0, n
        if part == "h1":
            hi = n // 2
        elif part == "h2":
            lo = n // 2
        elif part in ("before", "after"):
            m = int(np.searchsorted(a["t"].values, np.datetime64(cut)))
            lo, hi = (0, m) if part == "before" else (m, n)
        if hi - lo < 250:
            continue
        out.append(edge(a["c"], plan_of(a, cand), lo, hi))
    return np.array(out)


def stat(A, cand, keys):
    f = score(A, cand, keys)
    h = np.concatenate([score(A, cand, keys, "h1"), score(A, cand, keys, "h2")])
    return {"n": len(f), "pos": int((f > 0).sum()), "worst": float(f.min()), "med": float(np.median(f)), "hpos": int((h > 0).sum()), "hn": len(h), "hworst": float(h.min()), "per": [round(float(x), 1) for x in f]}


def sh(s):
    return f"в плюсе {s['pos']}/{s['n']}, худший {s['worst']:.0f}%, медиана {s['med']:.0f}%, половины {s['hpos']}/{s['hn']}, худшая половина {s['hworst']:.0f}%"


def main(out):
    hist, X = load()
    A = assets(hist, X, TOP, BOT)
    names = {**{k: v[1] for k, v in METALS.items()}, **{k: v[1] for k, v in EXTRA.items()}}
    for k in A:
        print(f"{names[k]}: {len(A[k]['c'])} дней с {A[k]['t'][0].date()}, цена ×{A[k]['c'][-1] / A[k]['c'][0]:.1f}")
    C = candidates()
    print("стратегий в семействе:", len(C))
    rows = []
    for cand in C:
        rows.append({"cand": cand, "sel": stat(A, cand, SEL), "ex": stat(A, cand, EXAM), "ex2": stat(A, cand, EXAM2)})
    sc = lambda s: s["worst"] + s["hworst"] + s["med"] / 2          # noqa: E731
    ok = [r for r in rows if r["sel"]["pos"] == 3]
    print(f"\nвсе три металла отбора в плюсе: {len(ok)} из {len(rows)}; из них оба экзаменационных в плюсе: {sum(1 for r in ok if r['ex']['pos'] == 2)}; "
          f"и все четыре фонда второго экзамена: {sum(1 for r in ok if r['ex']['pos'] == 2 and r['ex2']['pos'] == r['ex2']['n'])}")
    print("медиана по семейству: отбор %.0f%%, экзамен %.0f%%, второй экзамен %.0f%%" % tuple(np.median([r[k]["med"] for r in rows]) for k in ("sel", "ex", "ex2")))
    top = sorted(rows, key=lambda r: -sc(r["sel"]))
    print("\nЛУЧШИЕ ПО ОТБОРУ (экзамены в выборе не участвовали):")
    for r in top[:6]:
        print(f"  {text(r['cand'])}\n     отбор (золото, серебро, медь): {sh(r['sel'])} | {r['sel']['per']}\n     экзамен (платина, палладий): {sh(r['ex'])} | {r['ex']['per']}\n     второй экзамен (GDX, COPX, XME, алюминий): {sh(r['ex2'])} | {r['ex2']['per']}")
    a = np.array([sc(r["sel"]) for r in rows]); b = np.array([sc(r["ex"]) for r in rows]); d = np.array([sc(r["ex2"]) for r in rows])
    print(f"\nкорреляция оценки: отбор–экзамен {np.corrcoef(a, b)[0, 1]:.2f}, отбор–второй экзамен {np.corrcoef(a, d)[0, 1]:.2f}")
    # что работает: вклад каждой части (медиана оценки на всех пяти металлах по вариантам с этой частью и без)
    allm = SEL + EXAM
    full = {i: np.median(score(A, r["cand"], allm)) for i, r in enumerate(rows)}
    for name, test in (("без продаж у вершины", lambda c: c[0] is None), ("с продажами у вершины", lambda c: c[0] is not None), ("без покупки у дна", lambda c: c[1] is None), ("с покупкой у дна", lambda c: c[1] is not None),
                       ("без возврата", lambda c: c[2] is None), ("с возвратом", lambda c: c[2] is not None)):
        v = [full[i] for i, r in enumerate(rows) if test(r["cand"])]
        print(f"  {name}: медиана итога на пяти металлах {np.median(v):.0f}% ({len(v)} вариантов)")

    # проверка во времени: пороги по данным до 2013, выбор на «до», проверка на «после»
    cut = "2013-01-01"
    top_b, bot_b = thresholds_before(hist, X, cut)
    print("\nПРОВЕРКА ВО ВРЕМЕНИ. Пороги маркеров по данным до 2013 года:")
    for (f, op, v0), (_, _, v1) in zip(TOP + BOT, top_b + bot_b):
        print(f"  {f[:58]:58} {op} {v1:.3g} (по всей истории было {v0:.3g})")
    B = assets(hist, X, top_b, bot_b)
    trows = []
    for cand in C:
        bf = score(B, cand, allm, "before", cut)
        trows.append({"cand": cand, "before": bf, "after": score(B, cand, allm, "after", cut), "after2": score(B, cand, EXAM2, "after", cut)})
    tsel = sorted([r for r in trows if (r["before"] > 0).all()], key=lambda r: -(r["before"].min() + np.median(r["before"]) / 2))
    print(f"стратегий, у которых до 2013 все пять металлов в плюсе: {len(tsel)}")
    for r in tsel[:5]:
        print(f"  {text(r['cand'])}\n     до 2013: худший {r['before'].min():.0f}%, медиана {np.median(r['before']):.0f}% | после 2013: в плюсе {(r['after'] > 0).sum()}/5, худший {r['after'].min():.0f}%, медиана {np.median(r['after']):.0f}% {np.round(r['after'], 0).tolist()}"
              f" | фонды после 2013: {np.round(r['after2'], 0).tolist()}")
    aft = np.array([np.median(r["after"]) for r in tsel[:50]]) if tsel else np.array([0.0])
    print(f"топ-50 по «до 2013»: медиана итога после 2013 — {np.median(aft):.0f}%, в плюсе {int((aft > 0).sum())} из {len(aft)}")
    print(f"всё семейство после 2013: медиана {np.median([np.median(r['after']) for r in trows]):.0f}%, в плюсе {sum(1 for r in trows if np.median(r['after']) > 0)} из {len(trows)}")
    json.dump({"top": [{"text": text(r["cand"]), "cand": r["cand"], "sel": r["sel"], "ex": r["ex"], "ex2": r["ex2"]} for r in top[:30]]}, open(out, "w", encoding="utf-8"), ensure_ascii=False, default=str)


if __name__ == "__main__":
    main(sys.argv[1])
