"""Круг 5: «остывание» — копить взносы несколько месяцев после крупной продажи (идея 2-го агента, круг 19; отклонена из-за плато с 1965–81).
H5a: после месяца с продажей ≥ v (v = 20% — любая крупная, 50% — сильная вершина/затяжной перегрев) следующие N месяцев (6/12/18/24)
взнос идёт в резерв (если не началась серия докупок). H5b: то же, пока не появится хотя бы 2 маркера дна (досрочный конец остывания), N = 24.
Основа — Q1. Критерий: sel_ok + плато по v и N; вето — для выбранного.
Запуск: python3 app/metals_agent3_loop5.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent3_lib as T
from metals_agent3_loop2 import q1

VS, NS = (0.2, 0.5), (6, 12, 18, 24)


def cool(base, v, N, early=None):
    def f(d):
        p = base(d).copy()
        last = -10 ** 6
        for i in range(len(p)):
            if p[i] <= -v + 1e-9:
                last = i
                continue
            if p[i] == 1.0 and 0 < i - last <= N:
                if early is not None and d["bn3"][i] >= early:
                    last = -10 ** 6
                    continue
                p[i] = 0.0
        return p
    return f


def main():
    D = T.load()
    R3, Q = T.run(D, A.ver("R3")), T.run(D, q1)
    C, meta = {}, {}
    for v in VS:
        for N in NS:
            nm = f"H5a продажа ≥ {v:.0%} → копить {N} мес."
            C[nm] = cool(q1, v, N); meta[nm] = ("a", v, N)
        for e in (2, 3):
            nm = f"H5b продажа ≥ {v:.0%} → копить до 24 мес., пока маркеров дна < {e}"
            C[nm] = cool(q1, v, 24, e); meta[nm] = ("b" + str(e), v, 24)
    rows = T.study(D, C, Q, show=20)
    good, by = T.pick(rows, meta, lambda key: (None, VS, NS) if key[0] == "a" else (None, VS, None))
    print("  прошли с плато: " + ", ".join(r["name"] for r in good))
    for r in rows:
        print(f"    {r['name']}: по металлам 1982–98 {T.bym(r['s'], 'h2')}")
    if good:
        best = good[0]
        print(f"\nВЫБРАН: {best['name']}\n  {T.fs(best['s'])}\n  1982–98: " + T.fprox(best["a"]) + "\n  Q1:      " + T.fprox(T.agg(Q)))
        T.veto(best, R3, Q)
        print("  метрики 1999–2026: " + T.fprox(T.agg(best["R"], which="prox_after")) + "\n  Q1:                " + T.fprox(T.agg(Q, which="prox_after")))


if __name__ == "__main__":
    main()
