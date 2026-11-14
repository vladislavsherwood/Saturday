"""Металлы, второй круг. Из первого круга: стратегии без возврата резерва в среднем хуже DCA (−7%), с возвратом лучше (+14%);
маркеры вершины и дна сами по себе почти не дают прибавки. В крипте сработала пара «продать в начале спада — вернуть резерв на
развороте». Здесь та же идея на языке металлов:
- продажа: много маркеров вершины, сильный отрыв от средней 200, ужесточение (реальная ставка растёт), укрепление доллара;
- возврат: импульс цены за месяц, возврат выше средней 200, маркеры дна.
Отбор — золото, серебро, медь; экзамен — платина, палладий; второй экзамен — GDX, COPX, XME, алюминий;
проверка во времени — пороги маркеров только по данным до 2013 года, выбор до 2013, проверка после.

Запуск: python3 app/metals_loop2.py
"""
import itertools
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from markers import roll  # noqa: E402
from metals_strategy import BOT, EXAM, EXAM2, SEL, TOP, assets, edge, load, thresholds_before  # noqa: E402

ALL5 = SEL + EXAM


def enrich(A, hist, X):
    for k, a in A.items():
        c = hist[k].reindex(a["t"])
        a["r21"] = np.nan_to_num(((c / c.shift(21) - 1) * 100).values)
        a["s50"] = np.nan_to_num((c / roll(c, 50)).values, nan=1.0)
        Xi = X.reindex(a["t"], method="ffill")
        a["ry63"] = np.nan_to_num(Xi["Реальная доходность: изменение за квартал, п.п."].values)
        a["dx63"] = np.nan_to_num(Xi["Доллар: изменение за квартал, %"].values)
    return A


SELLS = [None] + [("top", k, f) for k in (3, 4, 5) for f in (0.02, 0.05, 0.1)] + [("far", x, f) for x in (1.15, 1.25, 1.4) for f in (0.02, 0.05, 0.1)] \
    + [("ry", x, f) for x in (0.4, 0.7) for f in (0.02, 0.05, 0.1)] + [("dx", x, f) for x in (4, 7) for f in (0.02, 0.05, 0.1)]
RETS = [None, ("imp", 5), ("imp", 8), ("imp", 12), ("cross", 0), ("up50", 0)]
BOTS = [None, ("bn", 3, 0.5), ("bn", 4, 1.0)]


def plan_of(a, cand):
    s, r, b = cand
    conds, acts = [], []
    if b:
        conds.append(a["bn"] >= b[1]); acts.append(1 + b[2])
    if s:
        w, x, f = s
        m = {"top": (a["tn"] >= x) & a["hi"], "far": a["s200"] > x, "ry": (a["ry63"] > x) & (a["s200"] > 1), "dx": (a["dx63"] > x) & (a["s200"] > 1)}[w]
        conds.append(m); acts.append(-f)
    if r:
        w, x = r
        m = {"imp": a["r21"] > x, "cross": (a["s200"] > 1) & (a["s200"] < 1.03) & (a["tn"] <= 2), "up50": (a["s50"] > 1.05) & (a["s200"] > 1)}[w]
        conds.append(m); acts.append(2.0)
    return np.select(conds, acts, default=1.0).astype(np.float64) if conds else np.ones(len(a["c"]))


def text(c):
    s, r, b = c
    out = []
    if b:
        out.append(f"маркеров дна ≥ {b[1]} → взнос и {int(b[2] * 100)}% резерва")
    if s:
        w, x, f = s
        out.append({"top": f"на максимуме и маркеров вершины ≥ {x}", "far": f"цена выше средней 200 в {x} раза", "ry": f"реальная ставка выросла на {x} п.п. за квартал (цена выше средней 200)",
                    "dx": f"доллар вырос на {x}% за квартал (цена выше средней 200)"}[w] + f" → продать {f * 100:g}%")
    if r:
        w, x = r
        out.append({"imp": f"цена выросла на {x}% за месяц", "cross": "цена только что поднялась выше средней 200", "up50": "цена выше средней 50 на 5% и выше средней 200"}[w] + " → вернуть весь резерв")
    return " | ".join(out) or "DCA"


def scores(A, cand, keys, lo_hi):
    out = []
    for k in keys:
        a = A[k]
        n = len(a["c"])
        lo, hi = lo_hi(a, n)
        if hi - lo >= 250:
            out.append(edge(a["c"], plan_of(a, cand), lo, hi))
    return np.array(out)


FULL = lambda a, n: (0, n)               # noqa: E731
H1 = lambda a, n: (0, n // 2)            # noqa: E731
H2 = lambda a, n: (n // 2, n)            # noqa: E731


def cut_at(date, before):
    def f(a, n):
        m = int(np.searchsorted(a["t"].values, np.datetime64(date)))
        return (0, m) if before else (m, n)
    return f


def st(A, c, keys):
    f = scores(A, c, keys, FULL)
    h = np.concatenate([scores(A, c, keys, H1), scores(A, c, keys, H2)])
    return {"n": len(f), "pos": int((f > 0).sum()), "worst": f.min(), "med": float(np.median(f)), "hpos": int((h > 0).sum()), "hn": len(h), "hworst": h.min(), "per": np.round(f, 0).tolist()}


def sh(s):
    return f"в плюсе {s['pos']}/{s['n']}, худший {s['worst']:.0f}%, медиана {s['med']:.0f}%, половины {s['hpos']}/{s['hn']}, худшая половина {s['hworst']:.0f}% {s['per']}"


def main():
    hist, X = load()
    A = enrich(assets(hist, X, TOP, BOT), hist, X)
    C = list(itertools.product(SELLS, RETS, BOTS))
    print("вариантов:", len(C))
    rows = [{"c": c, "sel": st(A, c, SEL), "ex": st(A, c, EXAM), "ex2": st(A, c, EXAM2)} for c in C]
    sc = lambda s: s["worst"] + s["hworst"] + s["med"] / 2          # noqa: E731
    ok = [r for r in rows if r["sel"]["pos"] == 3 and r["sel"]["hpos"] >= 5]
    print(f"все три металла отбора в плюсе и минимум 5 из 6 половин: {len(ok)}; из них экзамен 2/2: {sum(r['ex']['pos'] == 2 for r in ok)}; и фонды 4/4: {sum(r['ex']['pos'] == 2 and r['ex2']['pos'] == 4 for r in ok)}")
    print("\nЛУЧШИЕ ПО ОТБОРУ:")
    for r in sorted(ok or rows, key=lambda r: -sc(r["sel"]))[:8]:
        print(f"  {text(r['c'])}\n     отбор: {sh(r['sel'])}\n     экзамен: {sh(r['ex'])}\n     фонды: {sh(r['ex2'])}")
    # вклад частей
    allf = {id(r): np.median(scores(A, r["c"], ALL5, FULL)) for r in rows}
    for name, pick in (("продажа по маркерам вершины", lambda c: c[0] and c[0][0] == "top"), ("продажа по отрыву от средней 200", lambda c: c[0] and c[0][0] == "far"),
                       ("продажа на росте реальной ставки", lambda c: c[0] and c[0][0] == "ry"), ("продажа на укреплении доллара", lambda c: c[0] and c[0][0] == "dx"),
                       ("возврат на импульсе", lambda c: c[1] and c[1][0] == "imp"), ("возврат при пересечении средней 200", lambda c: c[1] and c[1][0] == "cross"),
                       ("возврат выше средней 50", lambda c: c[1] and c[1][0] == "up50"), ("без возврата", lambda c: not c[1]), ("покупка у дна", lambda c: bool(c[2]))):
        v = [allf[id(r)] for r in rows if pick(r["c"])]
        print(f"  {name}: медиана итога на пяти металлах {np.median(v):.0f}% ({len(v)} вариантов)")
    # во времени
    cut = "2013-01-01"
    top_b, bot_b = thresholds_before(hist, X, cut)
    B = enrich(assets(hist, X, top_b, bot_b), hist, X)
    T = []
    for c in C:
        bf, af = scores(B, c, ALL5, cut_at(cut, True)), scores(B, c, ALL5, cut_at(cut, False))
        T.append({"c": c, "bf": bf, "af": af, "af2": scores(B, c, EXAM2, cut_at(cut, False))})
    good = sorted([r for r in T if (r["bf"] > 0).all()], key=lambda r: -(r["bf"].min() + np.median(r["bf"]) / 2))
    print(f"\nПРОВЕРКА ВО ВРЕМЕНИ: вариантов, где до 2013 все пять металлов в плюсе: {len(good)}")
    for r in good[:6]:
        print(f"  {text(r['c'])}\n     до 2013: худший {r['bf'].min():.0f}%, медиана {np.median(r['bf']):.0f}% | после 2013: в плюсе {(r['af'] > 0).sum()}/5, худший {r['af'].min():.0f}%, медиана {np.median(r['af']):.0f}% {np.round(r['af'], 0).tolist()} | фонды после 2013: {np.round(r['af2'], 0).tolist()}")
    a20 = [np.median(r["af"]) for r in good[:20]]
    print(f"топ-20 по «до 2013»: после 2013 медиана {np.median(a20):.0f}%, в плюсе {sum(x > 0 for x in a20)} из {len(a20)}; всё семейство после 2013: медиана {np.median([np.median(r['af']) for r in T]):.0f}%")


if __name__ == "__main__":
    main()
