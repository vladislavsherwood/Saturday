"""Круг 4: доля докупки в серии по глубине цены. Основа — R4 (R3 + упорство сигнала дна).
H4a — цена к средней за 3 года < процентиля q → g_hi, иначе g_lo.
H4b — цена ниже цены месяца начала серии на dd → g_hi, иначе g_lo.
Критерий: select_ok + плато; после 1999 — только вето.
Запуск: python3 app/metals_agent2_loop4.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L

QA, DB, GL, GH = (0.1, 0.2, 0.3), (0.0, 0.05, 0.10), (0.2, 0.33, 0.5), (0.5, 0.67, 0.85)


def depth(a, gl, gh):
    def f(d):
        p = A.cur(d)
        ep = p > 1.0
        deep = np.nan_to_num(A.feat(d, A.P3), nan=9.0) < a
        return np.where(ep, 1 + np.where(deep, gh, gl), p)
    return f


def avgdown(dd, gl, gh):
    def f(d):
        p = A.cur(d)
        c = d["c"]
        ep = p > 1.0
        ref = np.full(len(c), np.nan)
        for i in range(len(c)):
            if ep[i]:
                ref[i] = c[i] if (i == 0 or not ep[i - 1]) else ref[i - 1]
        low = c <= np.nan_to_num(ref, nan=0.0) * (1 - dd)
        first = ep & ~np.r_[False, ep[:-1]]
        g = np.where(low & ~first, gh, gl)
        g = np.where(first & (dd == 0.0), gh, g)          # dd = 0: первый месяц серии — «цена не выше начала» → g_hi
        return np.where(ep, 1 + g, p)
    return f


def main():
    D = A.load()
    R4 = A.evaluate(D, A.cur)
    print("R4 до 1999: " + A.fprox(A.agg(R4, A.SEL, "prox_b")))
    C, meta = {}, {}
    for q in QA:
        a = L.pooled(D, A.P3, q)
        for gl in GL:
            for gh in GH:
                if gl == gh == 0.5:
                    continue
                nm = f"H4a: цена к ср. 3 г. < {a:.2f} (q{int(q * 100)}) → {gh:.0%}, иначе {gl:.0%}"
                C[nm] = depth(a, gl, gh); meta[nm] = ("a", q, gl, gh)
    for dd in DB:
        for gl in GL:
            for gh in GH:
                if gl == gh == 0.5:
                    continue
                nm = f"H4b: цена ниже начала серии на {dd:.0%} → {gh:.0%}, иначе {gl:.0%}"
                C[nm] = avgdown(dd, gl, gh); meta[nm] = ("b", dd, gl, gh)
    print(f"\n=== {len(C)} вариантов; только период подбора (до 1999) ===")
    rows = A.study(D, C, R4, show=12)
    axes = lambda key: (None, QA if key[0] == "a" else DB, GL, GH)   # noqa: E731
    good, by = A.pick(rows, meta, axes)
    for fam, nm, X in (("a", "H4a по глубине к ср. 3 г.", QA), ("b", "H4b усреднение вниз", DB)):
        g_ = [r for r in rows if meta[r["name"]][0] == fam]
        print(f"\n  {nm}: медиана суммы {np.median([r['s']['before']['logsum'] for r in g_]):+.1f}, прошли {sum(r['ok'] for r in g_)}/{len(g_)}, с плато {sum(r in good for r in g_)}")
        for x in X:
            print(f"    {x}: " + "  ".join(f"{gl:.0%}/{gh:.0%}: {by[(fam, x, gl, gh)]['s']['before']['logsum']:+5.1f}{'✓' if by[(fam, x, gl, gh)]['ok'] else ''}"
                                         for gl in GL for gh in GH if (fam, x, gl, gh) in by))
    if not good:
        print("\nНИ ОДИН вариант не прошёл критерий с плато — R4 не меняется")
        return
    best = good[0]
    print(f"\nВЫБРАН по «до 1999»: {best['name']}\n  {A.fb(best['s'])}\n  до 1999 по металлам: {A.bymetal(best['s'], 'before')}\n  до 1999: " + A.fprox(best["a"]))
    A.veto([best], R4)
    print("  метрики, вся история: " + A.fprox(A.agg(best["R"], A.SEL)) + "\n  R4:                   " + A.fprox(A.agg(R4, A.SEL)))
    print("  итог к DCA: " + A.line(best["R"], A.SEL))


if __name__ == "__main__":
    main()
