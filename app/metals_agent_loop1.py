"""Круг 1: растянуть докупки по дну.
H1a — лесенка по силе сигнала: дна = 3 → малая доля резерва, ≥ 4 → средняя, ≥ 5 → крупная (вместо «≥ 4 → весь резерв»).
H1b — растягивание во времени: при дна ≥ 4 каждый месяц доля g текущего резерва (геометрически) или равные доли резерва
      на начало серии (резерв / N в месяц); с удержанием серии, пока дна ≥ 3.
H1c — хрупкость порога: для каждого варианта — что будет, если требовать на 1 маркер больше.
Продажи — как в основе. Выбор — по 8 металлам до 1999; после 1999 — проверка.
Запуск: python3 app/metals_agent_loop1.py"""
import numpy as np

import metals_agent_lib as L


def sells(d):
    tn = d["tn"]
    return np.select([tn >= 6, tn >= 5], [-0.3, -0.1], default=1.0)


def graded(g3, g4, g5, k=0):
    def f(d):
        bn = d["bn"] - k
        p = sells(d)
        conds, acts = [bn >= 5, bn >= 4], [1 + g5, 1 + g4]
        if g3 > 0:
            conds.append(bn >= 3); acts.append(1 + g3)
        return np.select(conds, acts, default=p)
    return f


def episode(bn, k_on, k_hold):
    ep = np.zeros(len(bn), bool)
    for i in range(len(bn)):
        ep[i] = bn[i] >= k_on or (i > 0 and ep[i - 1] and bn[i] >= k_hold)
    return ep


def spread(g, hold, tranche=0, k=0):
    def f(d):
        bn = d["bn"] - k
        ep = episode(bn, 4, 3 if hold else 4)
        p = np.where(ep, 1 + (1.0 if tranche else g), sells(d))
        return (p, tranche) if tranche else p
    return f


def main():
    D = L.load()
    B = L.run(D, L.base_plan)
    print("ОСНОВА:", L.fmt_prox(L.agg_prox(B, L.SEL)))
    C = {}
    for g3 in (0, 0.1, 0.2, 0.33):
        for g4 in (0.25, 0.33, 0.5, 1.0):
            for g5 in (0.5, 1.0):
                if g5 < g4:
                    continue
                C[f"H1a лесенка: дна 3 → {g3:.0%}, 4 → {g4:.0%}, ≥5 → {g5:.0%} резерва"] = graded(g3, g4, g5)
    for g in (0.2, 0.25, 0.33, 0.4, 0.5, 0.67):
        for hold in (False, True):
            C[f"H1b геом.: дна ≥4{' (держать при ≥3)' if hold else ''} → {g:.0%} резерва в месяц"] = spread(g, hold)
    for n in (2, 3, 4, 6, 9):
        for hold in (False, True):
            C[f"H1b равные доли: дна ≥4{' (держать при ≥3)' if hold else ''} → резерв/{n} в месяц"] = spread(None, hold, n)
    print(f"\nвариантов: {len(C)}; лучшие по 1965–1998 (8 металлов):")
    rows = L.study(D, C, B, show=15)
    # плато: таблица медианы «до 1999» и «после» по сетке лесенки и растягивания
    print("\nПЛАТО (H1a, медиана разницы к основе до 1999 / после 1999, g5 = 100%):")
    by = {r["name"]: r for r in rows}
    for g3 in (0, 0.1, 0.2, 0.33):
        cells = []
        for g4 in (0.25, 0.33, 0.5, 1.0):
            r = by[f"H1a лесенка: дна 3 → {g3:.0%}, 4 → {g4:.0%}, ≥5 → {1.0:.0%} резерва"]
            cells.append(f"{r['s']['before']['med']:+5.1f}/{r['s']['after']['med']:+5.1f}")
        print(f"  дна 3 → {g3:4.0%}: " + "  ".join(f"4→{g:.0%}: {c}" for g, c in zip((0.25, 0.33, 0.5, 1.0), cells)))
    print("\nПЛАТО (H1b геом., держать при ≥3; равные доли, держать при ≥3): до / после / доньев ≥2 мес.")
    for g in (0.2, 0.25, 0.33, 0.4, 0.5, 0.67):
        r = by[f"H1b геом.: дна ≥4 (держать при ≥3) → {g:.0%} резерва в месяц"]
        print(f"  {g:.0%}: {r['s']['before']['med']:+.1f} / {r['s']['after']['med']:+.1f} / {r['a']['b2']}")
    for n in (2, 3, 4, 6, 9):
        r = by[f"H1b равные доли: дна ≥4 (держать при ≥3) → резерв/{n} в месяц"]
        print(f"  /{n}: {r['s']['before']['med']:+.1f} / {r['s']['after']['med']:+.1f} / {r['a']['b2']}")
    # H1c: хрупкость — тот же вариант, но маркеров дна нужно на 1 больше
    print("\nH1c ХРУПКОСТЬ: тот же вариант, но для каждой ступени нужен на 1 маркер дна больше (разница к основе, медиана до / после; худший до / после)")
    tests = {"основа (дна ≥4 → весь резерв)": (graded(0, 1.0, 1.0), graded(0, 1.0, 1.0, 1)),
             "лесенка 3 → 20%, 4 → 50%, ≥5 → 100%": (graded(0.2, 0.5, 1.0), graded(0.2, 0.5, 1.0, 1)),
             "лесенка 3 → 10%, 4 → 33%, ≥5 → 100%": (graded(0.1, 0.33, 1.0), graded(0.1, 0.33, 1.0, 1)),
             "геом. 33%/мес, держать при ≥3": (spread(0.33, True), spread(0.33, True, 0, 1)),
             "равные доли /4, держать при ≥3": (spread(None, True, 4), spread(None, True, 4, 1)),
             "геом. 50%/мес, держать при ≥3": (spread(0.5, True), spread(0.5, True, 0, 1)),
             "равные доли /3, держать при ≥3": (spread(None, True, 3), spread(None, True, 3, 1))}
    for name, (f0, f1) in tests.items():
        R0, R1 = L.run(D, f0, L.SEL), L.run(D, f1, L.SEL)
        s0, s1 = L.compare(R0, B), L.compare(R1, B)
        print(f"  {name}: как есть {s0['before']['med']:+.1f}/{s0['after']['med']:+.1f} (худш. {s0['before']['worst']:+.1f}/{s0['after']['worst']:+.1f}); "
              f"+1 маркер: {s1['before']['med']:+.1f}/{s1['after']['med']:+.1f} (худш. {s1['before']['worst']:+.1f}/{s1['after']['worst']:+.1f})")
    # подробно по металлам: лидеры по «до 1999» и ровные варианты с плато
    pick = rows[:2] + [by[n] for n in ("H1b геом.: дна ≥4 (держать при ≥3) → 50% резерва в месяц", "H1b геом.: дна ≥4 (держать при ≥3) → 40% резерва в месяц",
                                         "H1b равные доли: дна ≥4 (держать при ≥3) → резерв/3 в месяц")]
    for r in pick:
        print(f"\n{r['name']}:\n   " + L.line(r["R"], L.SEL) + "\n   " + L.lagcheck(r["R"], B))
    print("\nоснова:\n   " + L.line(B, L.SEL))


if __name__ == "__main__":
    main()
