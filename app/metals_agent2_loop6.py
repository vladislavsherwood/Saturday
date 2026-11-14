"""Круг 6: продажи на циклической вершине — горячая цена при «невершинном» макро-фоне. Основа — R5.
Тёплая ступень: цена к ср. 3 г. И рост за год > процентиля q → продать s, только если
H6a — инфляция за год не выросла; H6b — доллар за год вырос; H6c — реальная ставка за год выросла. Охват: все металлы / промышленные.
Критерий: select_ok + плато по q и s + пропусков вершин до 1999 не больше R5; после 1999 — только вето.
Запуск: python3 app/metals_agent2_loop6.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L

QS, SS = (0.85, 0.88, 0.90, 0.92), (0.05, 0.10, 0.15)
GATES = {"infl": ("Инфляция: изменение за год, п.п.", "le", "инфляция не выросла"), "usd": ("Доллар: изменение за год, %", "gt", "доллар вырос"),
         "real": ("Реальная ставка: изменение за год, п.п.", "gt", "реальная ставка выросла")}


def gate_arr(d, g):
    f, op, _ = GATES[g]
    x = A.feat(d, f)
    return np.nan_to_num(x <= 0 if op == "le" else x > 0).astype(bool) & np.isfinite(x)


def warm(base, a, b, s, g, scope):
    def f(d):
        p = base(d)
        if scope == "ind" and A.GROUP[d["key"]] != "ind":
            return p
        cond = (np.nan_to_num(A.feat(d, A.P3)) > a) & (np.nan_to_num(A.feat(d, A.Y1)) > b) & gate_arr(d, g)
        return np.where(cond & (p <= 1.0), np.minimum(p, -s), p)
    return f


def main():
    D = A.load()
    base = A.ver("R5")
    R5 = A.evaluate(D, base)
    miss0 = A.agg(R5, A.SEL, "prox_b")["miss"]
    print("R5 до 1999: " + A.fprox(A.agg(R5, A.SEL, "prox_b")))
    C, meta = {}, {}
    for g in GATES:
        for scope in ("all", "ind"):
            for q in QS:
                a, b = L.pooled(D, A.P3, q), L.pooled(D, A.Y1, q)
                for s in SS:
                    nm = f"H6{'abc'[list(GATES).index(g)]} [{GATES[g][2]}, {'все' if scope == 'all' else 'пром.'}]: q{int(q * 100)} (×{a:.2f}, +{b:.0f}%) → {s:.0%}"
                    C[nm] = warm(base, a, b, s, g, scope); meta[nm] = (g, scope, q, s)
    print(f"\n=== {len(C)} вариантов; только период подбора (до 1999) ===")
    rows = A.study(D, C, R5, show=12)
    good, by = A.pick(rows, meta, (None, None, QS, SS), extra=lambda r: r["a"]["miss"] <= miss0)
    for g in GATES:
        for scope in ("all", "ind"):
            print(f"\n  {GATES[g][2]}, {'все' if scope == 'all' else 'пром.'}: сумма до 1999 (половины), ✓ — прошёл; пропущено до 1999")
            for q in QS:
                print(f"    q{int(q * 100)}: " + "  ".join(
                    f"{s:.0%}: {by[(g, scope, q, s)]['s']['before']['logsum']:+6.1f} ({by[(g, scope, q, s)]['s']['h1']['logsum']:+.0f}/{by[(g, scope, q, s)]['s']['h2']['logsum']:+.0f})"
                    f"{'✓' if by[(g, scope, q, s)]['ok'] else ' '} {by[(g, scope, q, s)]['a']['miss']}" for s in SS))
    print(f"\nпрошли критерий с плато и без роста пропусков: {len(good)}")
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
