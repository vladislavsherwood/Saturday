"""Круг 8: упорство и нарастание сигнала вершины. Основа — R5.
H8a — маркеров вершины ≥ n−3 подряд p мес. → продать s. H8b — маркеров выросло за 6 мес. на ≥ 2 и сейчас ≥ n−3 → продать s.
Справочно: хрупкость порогов продаж (на маркер строже / мягче).
Критерий: select_ok + плато + пропусков вершин до 1999 не больше R5; после 1999 — только вето.
Запуск: python3 app/metals_agent2_loop8.py"""
import numpy as np

import metals_agent2_lib as A

PS, SS, US = (2, 3, 4, 6), (0.05, 0.10, 0.15), (2, 3)


def persist(p_, s):
    base = A.ver("R5")

    def f(d):
        p = base(d)
        r = A.runs(d["tn3"] >= d["nt"] - 3)
        return np.where((r >= p_) & (p == 1.0), -s, p)
    return f


def growing(u, s):
    base = A.ver("R5")

    def f(d):
        p = base(d)
        tn = d["tn3"]
        t6 = np.r_[np.full(6, 99), tn[:-6]]
        return np.where((tn - t6 >= u) & (tn >= d["nt"] - 3) & (p == 1.0), -s, p)
    return f


def main():
    D = A.load()
    R5 = A.evaluate(D, A.ver("R5"))
    miss0 = A.agg(R5, A.SEL, "prox_b")["miss"]
    for nm, sh in (("строже на маркер (n−1 → 15%, n → 50%)", 1), ("мягче на маркер (n−3 → 15%, n−2 → 50%)", -1)):
        R = A.evaluate(D, lambda d, sh=sh: A.r3(d, **A.VERS["R5"], tn=d["tn3"] - sh, nt=d["nt"]))
        s = A.cmp(R, R5)
        print(f"хрупкость продаж, {nm}: {A.fb(s)}; пропущено до 1999 {A.agg(R, A.SEL, 'prox_b')['miss']}/32\n   по металлам до 1999: {A.bymetal(s, 'before')}")
    C, meta = {}, {}
    for p_ in PS:
        for s in SS:
            nm = f"H8a: маркеров вершины ≥ n−3 подряд {p_} мес. → продать {s:.0%}"
            C[nm] = persist(p_, s); meta[nm] = ("a", p_, s)
    for u in US:
        for s in SS:
            nm = f"H8b: маркеров вершины +{u} за 6 мес. и ≥ n−3 → продать {s:.0%}"
            C[nm] = growing(u, s); meta[nm] = ("b", u, s)
    print(f"\n=== {len(C)} вариантов; только период подбора (до 1999) ===")
    rows = A.study(D, C, R5, show=10)
    good, by = A.pick(rows, meta, lambda key: (None, PS if key[0] == "a" else US, SS), extra=lambda r: r["a"]["miss"] <= miss0)
    print("\n  сетка: сумма до 1999 (половины) ✓ пропущено")
    for fam, X in (("a", PS), ("b", US)):
        for x in X:
            print(f"    H8{fam} {x}: " + "  ".join(f"{s:.0%}: {by[(fam, x, s)]['s']['before']['logsum']:+6.1f} ({by[(fam, x, s)]['s']['h1']['logsum']:+.0f}/{by[(fam, x, s)]['s']['h2']['logsum']:+.0f})"
                                             f"{'✓' if by[(fam, x, s)]['ok'] else ' '} {by[(fam, x, s)]['a']['miss']}" for s in SS))
    print(f"\nпрошли критерий с плато и без роста пропусков: {len(good)}")
    if not good:
        print("R5 не меняется")
        return
    best = good[0]
    print(f"\nВЫБРАН по «до 1999»: {best['name']}\n  {A.fb(best['s'])}\n  до 1999 по металлам: {A.bymetal(best['s'], 'before')}\n  до 1999: " + A.fprox(best["a"]))
    A.veto([best], R5)
    print("  метрики, вся история: " + A.fprox(A.agg(best["R"], A.SEL)) + "\n  R5:                   " + A.fprox(A.agg(R5, A.SEL)))
    print("  итог к DCA: " + A.line(best["R"], A.SEL))


if __name__ == "__main__":
    main()
