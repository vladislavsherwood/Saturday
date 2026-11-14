"""Круг 7 (своя гипотеза): «хвост серии» — докупать резерв и после конца макро-сигнала дна, пока цена у дна.
Серия Q2 кончается, когда маркеров дна < n−4; часто цена ещё у дна, а резерв (после остывания он больше) лежит до следующего макро-дна годами.
H7: в E месяцев (3/6/12) после конца серии, если план месяца — взнос (или накопление) и цена ≤ (1 + u) × средней цены месяцев серии (u = 0/10/25%),
→ взнос и доля g2 резерва (25/50%). Цель — размазать докупки по дну и не держать резерв без дела.
Основа — Q2. Критерий: sel_ok + плато по E, u, g2; вето — для выбранного.
Запуск: python3 app/metals_agent3_loop7.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent3_lib as T
from metals_agent3_loop6 import q2

ES, US, GS = (3, 6, 12), (0.0, 0.10, 0.25), (0.25, 0.5)


def tail(base, E, u, g2):
    def f(d):
        p0 = base(d)
        p = p0.copy()
        c = d["c"]
        s = cnt = 0.0
        end = -10 ** 6
        avg = np.nan
        for i in range(len(p)):
            if p0[i] > 1.0:
                if i == 0 or p0[i - 1] <= 1.0:
                    s = cnt = 0.0
                s += c[i]; cnt += 1
                avg = s / cnt
                end = i
                continue
            if 0 < i - end <= E and 0.0 <= p0[i] <= 1.0 and c[i] <= avg * (1 + u):
                p[i] = 1 + g2
        return p
    return f


def main():
    D = T.load()
    R3, Q = T.run(D, A.ver("R3")), T.run(D, q2)
    print("Q2 1982–98: " + T.fprox(T.agg(Q)) + "\n   1999–2026: " + T.fprox(T.agg(Q, which="prox_after")))
    C, meta = {}, {}
    for E in ES:
        for u in US:
            for g in GS:
                nm = f"H7 хвост {E} мес., цена ≤ {1 + u:.2f} × ср. серии → {g:.0%} резерва"
                C[nm] = tail(q2, E, u, g); meta[nm] = (E, u, g)
    rows = T.study(D, C, Q, show=8)
    good, by = T.pick(rows, meta, (ES, US, GS))
    print("\n  сумма 1982–98 [не хуже, худший] ✓; доньев ≥2 мес. 1982–98")
    for E in ES:
        print(f"    E = {E:2d}: " + "  ".join(f"u{int(u * 100)}/{g:.0%}: {by[(E, u, g)]['s']['h2']['logsum']:+5.1f} [{by[(E, u, g)]['s']['h2']['ok']}, {by[(E, u, g)]['s']['h2']['worst']:+.1f}]"
                                         f"{'✓' if by[(E, u, g)]['ok'] else ' '} {by[(E, u, g)]['a']['b2']}" for u in US for g in GS))
    print(f"  прошли с плато: {len(good)}")
    if good:
        b = good[0]
        print(f"\nВЫБРАН: {b['name']}\n  {T.fs(b['s'])}\n  по металлам 1982–98: {T.bym(b['s'], 'h2')}\n  1982–98: " + T.fprox(b["a"]))
        T.veto(b, R3, Q)
        print("  метрики 1999–2026: " + T.fprox(T.agg(b["R"], which="prox_after")))


if __name__ == "__main__":
    main()
