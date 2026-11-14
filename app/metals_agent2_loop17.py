"""Круг 17: усилить ценовой перегрев. Основа — R5.
H17a — рост за 6 мес. > q → продать s. H17b — цена к ср. 3 г. и рост за год > q (98/99) → продать s2. H17c — перегрев ≥ 2 мес. подряд → продать s3.
Критерий: select_ok + плато + пропусков вершин до 1999 не больше R5; после 1999 — только вето.
Запуск: python3 app/metals_agent2_loop17.py"""
import numpy as np
import pandas as pd

import metals_agent2_lib as A
import metals_agent_lib as L

QA, SA = (0.95, 0.97, 0.99), (0.1, 0.2, 0.3)
QB, SB = (0.98, 0.99), (0.3, 0.4, 0.5)
SC = (0.3, 0.4, 0.5)


def ch6(d):
    c = pd.Series(d["c"])
    return ((c / c.shift(6) - 1) * 100).values


def main():
    D = A.load()
    base = A.ver("R5")
    R5 = A.evaluate(D, base)
    miss0 = A.agg(R5, A.SEL, "prox_b")["miss"]
    v6 = np.concatenate([ch6(D[k])[: D[k]["m"]] for k in A.SEL])
    v6 = v6[np.isfinite(v6)]
    C, meta = {}, {}
    for q in QA:
        a = float(np.quantile(v6, q))
        for s in SA:
            nm = f"H17a: рост за 6 мес. > {a:.0f}% (q{int(q * 100)}) → продать {s:.0%}"
            C[nm] = (lambda a, s: lambda d: (lambda p: np.where((np.nan_to_num(ch6(d)) > a) & (p <= 1.0), np.minimum(p, -s), p))(base(d)))(a, s)
            meta[nm] = ("a", q, s)
    for q in QB:
        a, b = L.pooled(D, A.P3, q), L.pooled(D, A.Y1, q)
        for s in SB:
            nm = f"H17b: к ср. 3 г. > {a:.2f} и за год > {b:.0f}% (q{int(q * 100)}) → продать {s:.0%}"
            C[nm] = (lambda a, b, s: lambda d: (lambda p: np.where((np.nan_to_num(A.feat(d, A.P3)) > a) & (np.nan_to_num(A.feat(d, A.Y1)) > b) & (p <= 1.0) | False,
                                                                     np.minimum(p, -s) if True else p, p))(base(d)))(a, b, s)
            meta[nm] = ("b", q, s)
    for s in SC:
        def fc(d, s=s):
            p = base(d)
            hot = (np.nan_to_num(A.feat(d, A.P3)) > A.DEF["hot3"]) & (np.nan_to_num(A.feat(d, A.Y1)) > A.DEF["hot1"])
            r = A.runs(hot)
            return np.where((r >= 2) & (p < 1.0), np.minimum(p, -s), p)
        nm = f"H17c: перегрев ≥ 2 мес. подряд → продать {s:.0%}"
        C[nm] = fc; meta[nm] = ("c", 0, s)
    print(f"=== {len(C)} вариантов; только период подбора (до 1999) ===")
    rows = A.study(D, C, R5, show=10)
    axes = lambda key: {"a": (None, QA, SA), "b": (None, QB, SB), "c": (None, None, SC)}[key[0]]   # noqa: E731
    good, by = A.pick(rows, meta, axes, extra=lambda r: r["a"]["miss"] <= miss0)
    print("\n  сетка: сумма до 1999 (половины) ✓ пропущено")
    for fam, X, Y in (("a", QA, SA), ("b", QB, SB), ("c", (0,), SC)):
        for x in X:
            print(f"    H17{fam} {x}: " + "  ".join(f"{y:.0%}: {by[(fam, x, y)]['s']['before']['logsum']:+6.1f} ({by[(fam, x, y)]['s']['h1']['logsum']:+.0f}/{by[(fam, x, y)]['s']['h2']['logsum']:+.0f})"
                                              f"{'✓' if by[(fam, x, y)]['ok'] else ' '} {by[(fam, x, y)]['a']['miss']}" for y in Y))
    print(f"\nпрошли критерий с плато: {len(good)}")
    if not good:
        print("R5 не меняется")
        return
    best = good[0]
    print(f"\nВЫБРАН по «до 1999»: {best['name']}\n  {A.fb(best['s'])}\n  до 1999 по металлам: {A.bymetal(best['s'], 'before')}\n  до 1999: " + A.fprox(best["a"]))
    A.veto([best], R5)
    print("  метрики, вся история: " + A.fprox(A.agg(best["R"], A.SEL)) + "\n  R5:                   " + A.fprox(A.agg(R5, A.SEL)))
    print("  итог к DCA: " + A.line(best["R"], A.SEL))
    return good


if __name__ == "__main__":
    main()
