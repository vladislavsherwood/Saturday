"""Круг 2: нижняя ступень перегрева — продажи на «тёплых» вершинах (идея 2-го агента, круг 1; отклонена из-за 1965–81 и вето свинца).
Тёплая ступень: цена к средней за 3 года И рост за год выше процентиля q (по 8 металлам 1965–98, как пороги R3) → продать s,
если план месяца — взнос или меньшая продажа. Охват: все металлы / только промышленные. Основа — Q1 (R3 + затяжной перегрев 50%).
Критерий: sel_ok + плато по q и s + пропусков вершин 1982–98 не больше Q1; из прошедших — наибольшая сумма; вето — для выбранного.
Запуск: python3 app/metals_agent3_loop2.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent3_lib as T
import metals_agent_lib as L

QS, SS = (0.85, 0.88, 0.90, 0.92, 0.94), (0.05, 0.10, 0.15, 0.20)


def q1(d):
    return A.r3(d, hot2=0.5)


def warm(base, a, b, s, scope):
    def f(d):
        p = base(d)
        if scope == "ind" and A.GROUP[d["key"]] != "ind":
            return p
        return np.where(T.heat(d, a, b) & (p <= 1.0), np.minimum(p, -s), p)
    return f


def main():
    D = T.load()
    R3, Q = T.run(D, A.ver("R3")), T.run(D, q1)
    miss0 = T.agg(Q)["miss"]
    print("Q1 1982–98: " + T.fprox(T.agg(Q)))
    C, meta = {}, {}
    for scope in ("all", "ind"):
        for q in QS:
            a, b = L.pooled(D, A.P3, q), L.pooled(D, A.Y1, q)
            for s in SS:
                nm = f"[{'все' if scope == 'all' else 'пром.'}] q{int(q * 100)} (×{a:.2f}, +{b:.0f}%) → {s:.0%}"
                C[nm] = warm(q1, a, b, s, scope); meta[nm] = (scope, q, s)
    rows = T.study(D, C, Q, show=8)
    good, by = T.pick(rows, meta, (None, QS, SS), extra=lambda r: r["a"]["miss"] <= miss0)
    for scope in ("all", "ind"):
        print(f"\n  {'все' if scope == 'all' else 'пром.'}: сумма 1982–98 [не хуже из 8, худший] ✓ — прошёл; пропущено вершин 1982–98")
        for q in QS:
            print(f"    q{int(q * 100)}: " + "  ".join(
                f"{s:.0%}: {by[(scope, q, s)]['s']['h2']['logsum']:+6.1f} [{by[(scope, q, s)]['s']['h2']['ok']}, {by[(scope, q, s)]['s']['h2']['worst']:+.1f}]"
                f"{'✓' if by[(scope, q, s)]['ok'] else ' '} {by[(scope, q, s)]['a']['miss']}" for s in SS))
    print(f"\nпрошли критерий с плато и без роста пропусков: {len(good)}: " + ", ".join(r["name"] for r in good[:8]))
    if not good:
        return
    best = good[0]
    print(f"\nВЫБРАН: {best['name']}\n  {T.fs(best['s'])}\n  по металлам 1982–98: {T.bym(best['s'], 'h2')}\n  1982–98: " + T.fprox(best["a"]))
    ok = T.veto(best, R3, Q)
    print("  метрики 1999–2026: " + T.fprox(T.agg(best["R"], which="prox_after")) + "\n  Q1:                " + T.fprox(T.agg(Q, which="prox_after")))
    if not ok:      # следующий по сумме из прошедших — справочно, какой ценой проходит вето
        for r in good[1:]:
            if T.veto_ok(T.cmp(r["R"], R3))[0]:
                print(f"  первый прошедший вето из отобранных: {r['name']}")
                T.veto(r, R3, Q)
                break


if __name__ == "__main__":
    main()
