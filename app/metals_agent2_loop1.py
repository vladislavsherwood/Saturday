"""Круг 1: нижняя ступень перегрева — продажи на «тёплых» циклических вершинах. Основа — R3.
H1a — цена к средней за 3 года И рост за год выше процентиля q (8 металлов, до 1999) → продать s (все металлы).
H1b — то же только для промышленных металлов.
H1c — цена на максимуме за 24 мес. И цена к средней за 3 года выше процентиля q → продать s.
Критерий: select_ok + плато по q (оба соседа проходят) + пропущенных вершин до 1999 не больше R3; после 1999 — только вето.
Запуск: python3 app/metals_agent2_loop1.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L

QS = (0.85, 0.88, 0.90, 0.92, 0.94)
SS = (0.05, 0.10, 0.15)


def warm(D, q, s, ind_only=False, local=False):
    a = L.pooled(D, A.P3, q)
    b = L.pooled(D, A.Y1, q)

    def f(d):
        p = A.r3(d)
        if ind_only and A.GROUP[d["key"]] != "ind":
            return p
        p3 = np.nan_to_num(A.feat(d, A.P3))
        if local:
            c = d["c"]
            mx = np.array([c[max(0, i - 23): i + 1].max() for i in range(len(c))])
            cond = (c >= mx) & (p3 > a)
        else:
            cond = (p3 > a) & (np.nan_to_num(A.feat(d, A.Y1)) > b)
        return np.where(cond & (p <= 1.0), np.minimum(p, -s), p)
    return f, a, b


def main():
    D = A.load()
    R3 = A.evaluate(D, A.r3)
    base_miss = A.agg(R3, A.SEL, "prox_b")["miss"]
    print(f"R3 до 1999: {A.fprox(A.agg(R3, A.SEL, 'prox_b'))}")
    C, meta = {}, {}
    for fam, kw in (("H1a все", {}), ("H1b пром.", {"ind_only": True}), ("H1c локальная вершина", {"local": True})):
        for q in QS:
            for s in SS:
                fn, a, b = warm(D, q, s, **kw)
                nm = f"{fam}: q{int(q * 100)} (к ср.3г > {a:.2f}" + ("" if kw.get("local") else f", за год > {b:.0f}%") + f") → продать {s:.0%}"
                C[nm] = fn
                meta[nm] = (fam, q, s)
    print(f"\n=== {len(C)} вариантов; только период подбора (до 1999) ===")
    rows = A.study(D, C, R3, show=20)
    by = {meta[r["name"]]: r for r in rows}
    good = []
    for r in rows:
        fam, q, s = meta[r["name"]]
        i = QS.index(q)
        nb = [by[(fam, QS[j], s)] for j in (i - 1, i + 1) if 0 <= j < len(QS)]
        plateau = all(x["ok"] for x in nb)
        fewer = r["a"]["miss"] <= base_miss
        r["plateau"] = plateau
        if r["ok"] and plateau and fewer:
            good.append(r)
    print("\nпо семействам (медиана суммы лог-разниц до 1999; прошли критерий; прошли с плато):")
    for fam in ("H1a все", "H1b пром.", "H1c локальная вершина"):
        g = [r for r in rows if meta[r["name"]][0] == fam]
        print(f"  {fam}: {np.median([r['s']['before']['logsum'] for r in g]):+.1f}; {sum(r['ok'] for r in g)}/{len(g)}; {sum(r in good for r in g)}")
    print("\nсетка суммы до 1999 (строки q, столбцы s) и пропущено вершин до 1999:")
    for fam in ("H1a все", "H1b пром.", "H1c локальная вершина"):
        print(f"  {fam}:")
        for q in QS:
            print(f"    q{int(q * 100)}: " + "  ".join(f"{s:.0%}: {by[(fam, q, s)]['s']['before']['logsum']:+6.1f} ({'✓' if by[(fam, q, s)]['ok'] else '·'}, проп. {by[(fam, q, s)]['a']['miss']})" for s in SS))
    if not good:
        print("\nНИ ОДИН вариант не прошёл критерий с плато — R3 не меняется")
        return
    best = good[0]
    print(f"\nВЫБРАН по «до 1999»: {best['name']}\n  {A.fb(best['s'])}\n  до 1999 по металлам: {A.bymetal(best['s'], 'before')}")
    A.veto([best], R3)
    print("  метрики, вся история: " + A.fprox(A.agg(best["R"], A.SEL)) + f"\n  R3, вся история:      " + A.fprox(A.agg(R3, A.SEL)))
    print("  итог к DCA: " + A.line(best["R"], A.SEL))


if __name__ == "__main__":
    main()
