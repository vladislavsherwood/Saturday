"""Круг 2: продавать ближе к вершине и не пропускать крупные вершины. Основа — R1 (растянутые докупки по дну из круга 1).
H2a — ступени продаж: вершины 4 → s4, 5 → s5, ≥6 → s6 (основа: 0 / 10% / 30%).
H2b — ценовой маркер перегрева без макро: цена к средней за 3 года и рост за год оба выше процентиля q (по 8 металлам до 1999) → продать s
      (добавляется к продажам по макро; берётся бо́льшая продажа).
H2c — не покупать у вершины: при вершины ≥ k взнос копится в резерв (без продажи).
H2d — продавать по макро только пока цена у максимума (≥ 90% максимума за 12 месяцев).
Запуск: python3 app/metals_agent_loop2.py"""
import numpy as np

import metals_agent_lib as L

P3, Y1 = "Цена к средней за 3 года", "Изменение за год, %"


def steps(s4, s5, s6):
    def f(d):
        tn = d["tn"]
        return np.select([tn >= 6, tn >= 5, tn >= 4], [-s6, -s5, -s4 if s4 > 0 else 1.0], default=1.0)
    return f


def overheat(t3, t1, s, sell=L.base_sells):
    def f(d):
        p = sell(d)
        hot = (np.nan_to_num(d["F"][P3].values) > t3) & (np.nan_to_num(d["F"][Y1].values) > t1)
        return np.where(hot, np.minimum(p, -s), p)
    return f


def skip(k, sell=L.base_sells):
    def f(d):
        p = sell(d)
        return np.where((d["tn"] >= k) & (p == 1.0), 0.0, p)
    return f


def gate(frac, sell=L.base_sells):
    def f(d):
        p = sell(d)
        c = d["c"]
        mx = np.array([c[max(0, i - 11): i + 1].max() for i in range(len(c))])
        return np.where((p < 0) & (c < frac * mx), 1.0, p)
    return f


def main():
    D = L.load()
    B = L.run(D, L.base_plan)
    R1 = L.run(D, L.r1_plan)
    print("ОСНОВА:", L.fmt_prox(L.agg_prox(B, L.SEL)))
    print(L.summary_line("R1 (круг 1) против основы:", R1, B))
    C = {}
    for s4 in (0, 0.02, 0.05):
        for s5 in (0.05, 0.1, 0.15, 0.2):
            for s6 in (0.2, 0.3, 0.4, 0.5):
                C[f"H2a ступени: вершины 4 → {s4:.0%}, 5 → {s5:.0%}, ≥6 → {s6:.0%}"] = (lambda f: lambda d: L.r1_plan(d, f))(steps(s4, s5, s6))
    thr = {q: (L.pooled(D, P3, q), L.pooled(D, Y1, q)) for q in (0.8, 0.85, 0.9, 0.95)}
    for q, (t3, t1) in thr.items():
        for s in (0.05, 0.1, 0.2, 0.3):
            C[f"H2b перегрев цены: к средней 3 г. > {t3:.2f} и рост за год > {t1:.0f}% (q{int(q * 100)}) → продать {s:.0%}"] = (lambda f: lambda d: L.r1_plan(d, f))(overheat(t3, t1, s))
    for k in (3, 4, 5):
        C[f"H2c не покупать при вершины ≥ {k}"] = (lambda f: lambda d: L.r1_plan(d, f))(skip(k))
    for fr in (0.8, 0.85, 0.9, 0.95):
        C[f"H2d продавать только у максимума: цена ≥ {fr:.0%} макс. за 12 мес."] = (lambda f: lambda d: L.r1_plan(d, f))(gate(fr))
    print(f"\nвариантов: {len(C)}; сравнение с R1; лучшие по 1965–1998 (8 металлов):")
    rows = L.study(D, C, R1, show=14)
    by = {r["name"]: r for r in rows}
    print("\nПЛАТО H2a (s4 = 0): медиана к R1 до / после")
    for s5 in (0.05, 0.1, 0.15, 0.2):
        print(f"  5 → {s5:4.0%}: " + "  ".join(f"≥6→{s6:.0%}: {by[f'H2a ступени: вершины 4 → {0:.0%}, 5 → {s5:.0%}, ≥6 → {s6:.0%}']['s']['before']['med']:+5.1f}/"
                                         f"{by[f'H2a ступени: вершины 4 → {0:.0%}, 5 → {s5:.0%}, ≥6 → {s6:.0%}']['s']['after']['med']:+5.1f}" for s6 in (0.2, 0.3, 0.4, 0.5)))
    print("ПЛАТО H2a (s5 = 10%, s6 = 30%) по s4: " + ", ".join(f"{s4:.0%}: {by[f'H2a ступени: вершины 4 → {s4:.0%}, 5 → {0.1:.0%}, ≥6 → {0.3:.0%}']['s']['before']['med']:+.1f}/"
                                                               f"{by[f'H2a ступени: вершины 4 → {s4:.0%}, 5 → {0.1:.0%}, ≥6 → {0.3:.0%}']['s']['after']['med']:+.1f}" for s4 in (0, 0.02, 0.05)))
    print("\nВСЕ H2b / H2c / H2d (к R1, сумма лог-разниц до / после; пропущено вершин):")
    for r in rows:
        if r["name"].startswith(("H2b", "H2c", "H2d")):
            print(f"  {r['name']}: до {r['s']['before']['logsum']:+.0f} ({r['s']['before']['ok']}/8), после {r['s']['after']['logsum']:+.0f} ({r['s']['after']['ok']}/8), "
                  f"продажи {r['a']['sell_top']:.0f}%, пропущено {r['a']['miss']}/{r['a']['tops']}")
    for r in rows[:3]:
        print(f"\n{r['name']}:\n   " + L.line(r["R"], L.SEL) + "\n   " + L.lagcheck(r["R"], R1))
    print("\nR1:\n   " + L.line(R1, L.SEL))


if __name__ == "__main__":
    main()


def combos():
    """Часть Б: сочетание ступеней продаж (H2a) и редкого ценового перегрева (H2b q90/q95)."""
    D = L.load()
    R1 = L.run(D, L.r1_plan)
    B = L.run(D, L.base_plan)
    thr = {q: (L.pooled(D, P3, q), L.pooled(D, Y1, q)) for q in (0.9, 0.95, 0.97)}
    C = {}
    for s5, s6 in ((0.1, 0.3), (0.15, 0.4), (0.15, 0.5), (0.2, 0.4), (0.2, 0.5)):
        for q in (None, 0.9, 0.95, 0.97):
            for s in ((0.1, 0.2) if q else (0,)):
                st = steps(0, s5, s6)
                fn = overheat(*thr[q], s, st) if q else st
                C[f"вершины 5 → {s5:.0%}, ≥6 → {s6:.0%}" + (f" + перегрев цены q{int(q * 100)} → {s:.0%}" if q else "")] = (lambda f: lambda d: L.r1_plan(d, f))(fn)
    print("\n=== ЧАСТЬ Б: сочетания (к R1) ===")
    rows = L.study(D, C, R1, show=40)
    for name in ("вершины 5 → 15%, ≥6 → 40%", "вершины 5 → 15%, ≥6 → 40% + перегрев цены q95 → 10%", "вершины 5 → 10%, ≥6 → 30% + перегрев цены q95 → 10%",
                 "вершины 5 → 20%, ≥6 → 50% + перегрев цены q95 → 10%"):
        r = next(x for x in rows if x["name"] == name)
        print(f"\n{name}:\n   " + L.line(r["R"], L.SEL) + "\n   " + L.lagcheck(r["R"], R1) + "\n   к основе: " + L.summary_line("", r["R"], B).strip())
    print("   экзамен не используется в выборе.")


if __name__ == "__main__":
    combos()


def plateau():
    """Часть В: плато по порогу перегрева цены q и доле s (ступени 5 → 15%, ≥6 → 50%)."""
    D = L.load()
    R1 = L.run(D, L.r1_plan)
    print("\n=== ЧАСТЬ В: плато перегрева цены (к R1; медиана до / после, худший до / после, металлов не хуже до+после из 16) ===")
    for q in (0.93, 0.94, 0.95, 0.96, 0.97, 0.98, 0.99):
        t3, t1 = L.pooled(D, P3, q), L.pooled(D, Y1, q)
        cells = []
        for s in (0.1, 0.2, 0.3):
            fn = overheat(t3, t1, s, steps(0, 0.15, 0.5))
            R = L.run(D, lambda d: L.r1_plan(d, fn), L.SEL, prox=False)
            x = L.compare(R, R1)
            cells.append(f"{s:.0%}: {x['before']['med']:+5.1f}/{x['after']['med']:+5.1f} ({x['before']['worst']:+5.1f}/{x['after']['worst']:+5.1f}) {x['before']['ok'] + x['after']['ok']:2d}")
        months = sum(int(((np.nan_to_num(D[k]['F'][P3].values) > t3) & (np.nan_to_num(D[k]['F'][Y1].values) > t1)).sum()) for k in L.SEL)
        print(f"  q{q * 100:.0f} (к средней 3 г. > {t3:.2f}, рост за год > {t1:.0f}%, месяцев на 8 металлах {months}): " + " | ".join(cells))
    # где срабатывает перегрев q97
    t3, t1 = L.pooled(D, P3, 0.97), L.pooled(D, Y1, 0.97)
    for k in L.metals(D):
        hot = (np.nan_to_num(D[k]['F'][P3].values) > t3) & (np.nan_to_num(D[k]['F'][Y1].values) > t1)
        print(f"  {L.NAME[k]}: " + ", ".join(f"{t:%Y-%m}" for t in D[k]["t"][hot]))


if __name__ == "__main__":
    plateau()
