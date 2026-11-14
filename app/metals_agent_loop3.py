"""Круг 3: правила разворота и конфликт-правила (идеи из крипто-стратегии). Основа сравнения — R2.
H3a — возврат резерва после подтверждения роста: цена пересекла среднюю за 12 месяцев вверх (или выше неё и средняя растёт),
      не дороже средней за 3 года и маркеров вершины ≤ 1 → взнос и доля g резерва; вариант — только в W месяцев после серии докупок.
H3b — подтверждение вершины: после сигнала вершины (вершины ≥ 5 или перегрев цены) в пределах 12 месяцев цена упала на x% от максимума
      с начала сигнала → продать s (один раз на сигнал).
H3c — конфликт: в серии докупок (дна ≥ 4) металл всё ещё дорог (цена к средней за 3 года > X) → только обычный взнос.
      Счёт конфликтов «вершина и дно одновременно»: их на истории нет (макромаркеры вершины и дна противоположны), правило-арбитр не нужно.
Запуск: python3 app/metals_agent_loop3.py"""
import numpy as np

import metals_agent_lib as L


def ma(c, n):
    return np.array([c[max(0, i - n + 1): i + 1].mean() for i in range(len(c))])


def ret(kind, g, w=None, p3max=1.0):
    def f(d):
        p = L.r2_plan(d)
        c = d["c"]
        m12 = ma(c, 12)
        up = c > m12
        if kind == "cross":
            sig = up & np.r_[False, ~up[:-1]]
        else:                                    # выше средней и средняя растёт
            sig = up & (m12 > np.r_[m12[0], m12[:-1]])
        sig &= (d["tn"] <= 1) & (np.nan_to_num(d["F"][L.P3].values, nan=1.0) < p3max)
        if w:
            ep = L.episode(d["bn"], 4, 3)
            sig &= (L.since(ep) <= w) & ~ep
        return np.where((p == 1.0) & sig, 1 + g, p)
    return f


def topconf(x, s, win=12):
    def f(d):
        p = L.r2_plan(d)
        c = d["c"]
        hot = (np.nan_to_num(d["F"][L.P3].values) > 1.81) & (np.nan_to_num(d["F"][L.Y1].values) > 86)
        top = (d["tn"] >= 5) | hot
        out = p.copy()
        start, mx, done = -10 ** 6, 0.0, True
        for i in range(len(c)):
            if top[i]:
                if i - start > win:
                    mx, done = c[i], False
                start = i
                mx = max(mx, c[i])
            elif i - start <= win:
                mx = max(mx, c[i])
                if not done and c[i] <= mx * (1 - x) and out[i] >= 1.0 and not (out[i] > 1.0):
                    out[i] = -s
                    done = True
        return out
    return f


def conflict(X):
    def f(d):
        p = L.r2_plan(d)
        ep = L.episode(d["bn"], 4, 3)
        dear = np.nan_to_num(d["F"][L.P3].values, nan=1.0) > X
        return np.where(ep & dear, 1.0, p)
    return f


def main():
    D = L.load()
    B = L.run(D, L.base_plan)
    R2 = L.run(D, L.r2_plan)
    print(L.summary_line("R2 против основы:", R2, B))
    C = {}
    for kind in ("cross", "up"):
        for g in (0.1, 0.25, 0.5, 1.0):
            for w in (None, 12, 24):
                for p3 in (1.0, 1.2):
                    C[f"H3a возврат: {'пересечение средней 12 мес.' if kind == 'cross' else 'выше растущей средней 12 мес.'}, к ср. 3 г. < {p3}"
                      + (f", ≤ {w} мес. после серии докупок" if w else "") + f" → {g:.0%} резерва"] = ret(kind, g, w, p3)
    for x in (0.1, 0.15, 0.2, 0.25, 0.3):
        for s in (0.1, 0.2, 0.3, 0.5):
            C[f"H3b подтверждение вершины: −{x:.0%} от максимума после сигнала → продать {s:.0%}"] = topconf(x, s)
    for X in (0.9, 1.0, 1.1, 1.2, 1.3):
        C[f"H3c конфликт: в серии докупок цена к ср. 3 г. > {X} → только взнос"] = conflict(X)
    print(f"\nвариантов: {len(C)}; к R2; лучшие по 1965–1998:")
    rows = L.study(D, C, R2, show=12)
    print("\nВСЕ (к R2: сумма лог-разниц до / после; металлов не хуже до / после; доньев ≥2 мес.; продажи к макс.; пропущено):")
    for r in sorted(rows, key=lambda r: r["name"]):
        s, a = r["s"], r["a"]
        print(f"  {r['name']}: {s['before']['logsum']:+5.0f} / {s['after']['logsum']:+5.0f}; {s['before']['ok']}/{s['after']['ok']}; худш. {s['before']['worst']:+.1f}/{s['after']['worst']:+.1f}; "
              f"{a['b2']}/{a['bots']}; {a['sell_top']:.0f}%; {a['miss']}/{a['tops']}")
    for r in rows[:2]:
        print(f"\n{r['name']}:\n   " + L.line(r["R"], L.SEL) + "\n   " + L.lagcheck(r["R"], R2))
    print("\nR2:\n   " + L.line(R2, L.SEL))


if __name__ == "__main__":
    main()
