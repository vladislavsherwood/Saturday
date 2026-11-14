"""Круг 3: тёплая ступень продаж с фильтром «не суперцикл» (идея 2-го агента, круг 6) + свой фильтр по долгому тренду.
Тёплая ступень (цена к ср. 3 г. И рост за год > q, q = 85/88/90/92) → продать s (5/10/15%), только если
  infl — инфляция за год не выросла; usd — доллар за год вырос; real — реальная ставка за год выросла;
  f10 — металл не в долгом подъёме: цена к средней за 10 лет < 1,3 (свой вариант: суперцикл = цена давно выше 10-летней средней);
  ma10 — 10-летняя средняя за 3 года не выросла больше чем на 10% (свой вариант).
Охват — все металлы. Основа — Q1. Критерий: sel_ok + плато по q и s + пропусков 1982–98 не больше Q1; вето — для выбранного.
Справочно (после выбора) — вето-ландшафт по всем фильтрам: проверка, есть ли фильтр, который вообще переживает 1999–2026.
Запуск: python3 app/metals_agent3_loop3.py"""
import numpy as np
import pandas as pd

import metals_agent2_lib as A
import metals_agent3_lib as T
import metals_agent_lib as L
from metals_agent3_loop2 import q1

QS, SS = (0.85, 0.88, 0.90, 0.92), (0.05, 0.10, 0.15)


def gate(d, g):
    if g == "infl":
        x = A.feat(d, "Инфляция: изменение за год, п.п."); return np.isfinite(x) & (np.nan_to_num(x) <= 0)
    if g == "usd":
        x = A.feat(d, "Доллар: изменение за год, %"); return np.isfinite(x) & (np.nan_to_num(x) > 0)
    if g == "real":
        x = A.feat(d, "Реальная ставка: изменение за год, п.п."); return np.isfinite(x) & (np.nan_to_num(x) > 0)
    if g == "f10":
        x = A.feat(d, A.F10); return np.isfinite(x) & (np.nan_to_num(x, nan=9) < 1.3)
    if g == "ma10":
        m10 = pd.Series(d["c"]).rolling(120, min_periods=84).mean()
        x = (m10 / m10.shift(36)).values
        return np.isfinite(x) & (np.nan_to_num(x, nan=9) < 1.1)
    raise ValueError(g)


GN = {"infl": "инфляция не выросла", "usd": "доллар вырос", "real": "реальная ставка выросла", "f10": "цена < 1,3 × ср. 10 лет", "ma10": "ср. 10 лет за 3 г. < +10%"}


def warmg(base, a, b, s, g):
    def f(d):
        p = base(d)
        return np.where(T.heat(d, a, b) & gate(d, g) & (p <= 1.0), np.minimum(p, -s), p)
    return f


def main():
    D = T.load()
    R3, Q = T.run(D, A.ver("R3")), T.run(D, q1)
    miss0 = T.agg(Q)["miss"]
    C, meta = {}, {}
    for g in GN:
        for q in QS:
            a, b = L.pooled(D, A.P3, q), L.pooled(D, A.Y1, q)
            for s in SS:
                nm = f"[{GN[g]}] q{int(q * 100)} → {s:.0%}"
                C[nm] = warmg(q1, a, b, s, g); meta[nm] = (g, q, s)
    rows = T.study(D, C, Q, show=6)
    good, by = T.pick(rows, meta, (None, QS, SS), extra=lambda r: r["a"]["miss"] <= miss0)
    print("\n  сумма 1982–98 [не хуже, худший] ✓; пропущено 1982–98")
    for g in GN:
        for q in QS:
            print(f"  {GN[g]:26s} q{int(q * 100)}: " + "  ".join(
                f"{s:.0%}: {by[(g, q, s)]['s']['h2']['logsum']:+6.1f} [{by[(g, q, s)]['s']['h2']['ok']}, {by[(g, q, s)]['s']['h2']['worst']:+.1f}]"
                f"{'✓' if by[(g, q, s)]['ok'] else ' '} {by[(g, q, s)]['a']['miss']}" for s in SS))
    print(f"\nпрошли с плато: {len(good)}")
    if good:
        best = good[0]
        print(f"\nВЫБРАН: {best['name']}\n  {T.fs(best['s'])}\n  по металлам 1982–98: {T.bym(best['s'], 'h2')}\n  1982–98: " + T.fprox(best["a"]))
        T.veto(best, R3, Q)
        print("\n  справочно, ПОСЛЕ выбора — 1999–2026 к R3 (медиана / худший) по всей сетке, s = 5%:")
        for g in GN:
            print(f"    {GN[g]:26s} " + "  ".join(
                f"q{int(q * 100)}: {T.cmp(by[(g, q, 0.05)]['R'], R3)['after']['med']:+.1f}/{T.cmp(by[(g, q, 0.05)]['R'], R3)['after']['worst']:+.1f}" for q in QS))
        months = {g: sum(int((T.heat(D[k], L.pooled(D, A.P3, 0.88), L.pooled(D, A.Y1, 0.88)) & gate(D[k], g))[D[k]["m"]:].sum()) for k in T.SEL) for g in GN}
        print("  месяцев срабатывания q88 после 1999 (8 металлов): " + ", ".join(f"{GN[g]} {v}" for g, v in months.items()))


if __name__ == "__main__":
    main()
