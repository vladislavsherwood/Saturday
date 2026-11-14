"""Круг 2: простаивающий резерв. Основа — R3.
H2a — цена < x × средней за 10 лет, месяц без другого действия → взнос и доля g резерва.
H2b — то же только после паузы ≥ P мес. без серии докупок (x может отсутствовать).
H2c — цена ниже цены последней продажи (в месяц решения о продаже) на dd → доля g резерва.
Критерий: select_ok + плато по осям сетки; после 1999 — только вето для выбранного.
Запуск: python3 app/metals_agent2_loop2.py"""
import numpy as np

import metals_agent2_lib as A


def drip(x, g, pause=0):
    def f(d):
        p = A.r3(d)
        f10 = A.feat(d, A.F10)
        cheap = np.ones(len(p), bool) if x is None else (np.nan_to_num(f10, nan=9.0) < x)
        cond = cheap & (p == 1.0)
        if pause:
            cond &= A.since(p > 1.0) >= pause
        return np.where(cond, 1 + g, p)
    return f


def buyback(dd, g):
    def f(d):
        p = A.r3(d)
        c = d["c"]
        last = np.full(len(c), np.nan)
        lv = np.nan
        for i in range(len(c)):
            if p[i] < 0:
                lv = c[i]
            last[i] = lv
        cond = (c <= (1 - dd) * np.nan_to_num(last, nan=0.0)) & (p == 1.0)
        return np.where(cond, 1 + g, p)
    return f


def main():
    D = A.load()
    R3 = A.evaluate(D, A.r3)
    C, meta = {}, {}
    XA, GA = (0.7, 0.8, 0.9, 1.0), (0.05, 0.1, 0.2)
    for x in XA:
        for g in GA:
            nm = f"H2a: цена < {x} × ср. 10 лет → {g:.0%} резерва"
            C[nm] = drip(x, g); meta[nm] = ("a", x, g)
    XB, PB, GB = (0.8, 0.9, 1.0, None), (24, 36, 60), (0.05, 0.1)
    for x in XB:
        for P in PB:
            for g in GB:
                nm = f"H2b: пауза ≥ {P} мес." + (f", цена < {x} × ср. 10 лет" if x else ", без условия на цену") + f" → {g:.0%} резерва"
                C[nm] = drip(x, g, P); meta[nm] = ("b", x, P, g)
    DC, GC = (0.3, 0.4, 0.5), (0.1, 0.2, 0.33)
    for dd in DC:
        for g in GC:
            nm = f"H2c: цена ниже последней продажи на {dd:.0%} → {g:.0%} резерва"
            C[nm] = buyback(dd, g); meta[nm] = ("c", dd, g)
    # сколько месяцев срабатывает (до 1999 / после) — без результатов
    for nm in list(C)[:12:3] + [n for n in C if n.startswith("H2b") and "60" in n][:2] + [n for n in C if n.startswith("H2c")][:3:2]:
        cnt_b = sum(int(((C[nm](D[k]) > 1) & (A.r3(D[k]) == 1.0))[: D[k]["m"]].sum()) for k in A.SEL)
        cnt_a = sum(int(((C[nm](D[k]) > 1) & (A.r3(D[k]) == 1.0))[D[k]["m"]:].sum()) for k in A.SEL)
        print(f"  срабатываний (мес., 8 металлов) до/после 1999: {cnt_b}/{cnt_a} — {nm}")
    print(f"\n=== {len(C)} вариантов; только период подбора (до 1999) ===")
    rows = A.study(D, C, R3, show=14)
    axes = lambda key: {"a": (None, XA, GA), "b": (None, XB, PB, GB), "c": (None, DC, GC)}[key[0]]   # noqa: E731
    good, by = A.pick(rows, meta, axes)
    for fam, nm in (("a", "H2a капельница"), ("b", "H2b после паузы"), ("c", "H2c откуп ниже продажи")):
        g_ = [r for r in rows if meta[r["name"]][0] == fam]
        print(f"  {nm}: медиана суммы до 1999 {np.median([r['s']['before']['logsum'] for r in g_]):+.1f}, лучшая {max(r['s']['before']['logsum'] for r in g_):+.1f}, "
              f"худшая {min(r['s']['before']['logsum'] for r in g_):+.1f}; прошли {sum(r['ok'] for r in g_)}/{len(g_)}, с плато {sum(r in good for r in g_)}")
        if fam == "a":
            for x in XA:
                print(f"     x={x}: " + "  ".join(f"{g:.0%}: {by[('a', x, g)]['s']['before']['logsum']:+6.1f} (половины {by[('a', x, g)]['s']['h1']['logsum']:+.0f}/{by[('a', x, g)]['s']['h2']['logsum']:+.0f})" for g in GA))
        if fam == "c":
            for dd in DC:
                print(f"     dd={dd}: " + "  ".join(f"{g:.0%}: {by[('c', dd, g)]['s']['before']['logsum']:+6.1f} (половины {by[('c', dd, g)]['s']['h1']['logsum']:+.0f}/{by[('c', dd, g)]['s']['h2']['logsum']:+.0f})" for g in GC))
    if not good:
        print("\nНИ ОДИН вариант не прошёл критерий с плато — R3 не меняется")
        return
    best = good[0]
    print(f"\nВЫБРАН по «до 1999»: {best['name']}\n  {A.fb(best['s'])}\n  до 1999 по металлам: {A.bymetal(best['s'], 'before')}")
    A.veto([best], R3)
    print("  метрики, вся история: " + A.fprox(A.agg(best["R"], A.SEL)) + "\n  R3:                   " + A.fprox(A.agg(R3, A.SEL)))
    print("  итог к DCA: " + A.line(best["R"], A.SEL))


if __name__ == "__main__":
    main()
