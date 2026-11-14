"""Круг 10: доход резерва (3-месячные векселя) и устойчивость размеров; сводка кругов 6–10. Основа — R5.
H10a — R5 против R3 и основы при доходе резерва (проверка). H10b — множитель продаж m и доля серии g: принимается, только если
проходит select_ok против R5 и без дохода, и с доходом резерва, с плато.
Запуск: python3 app/metals_agent2_loop10.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L

MS, GS = (1.0, 1.15, 1.3, 1.5), (0.33, 0.5, 0.67)


def sized(m, g):
    def f(d):
        P = A.DEF
        return A.r3(d, **A.ACC, s5=P["s5"] * m, s6=min(P["s6"] * m, 0.9), sh=P["sh"] * m, lead=P["lead"] * m, g=g)
    return f


def main():
    D = A.load()
    B0, B1 = A.evaluate(D, L.base_plan), A.evaluate(D, L.base_plan, interest=True)
    R3a, R3b = A.evaluate(D, A.r3), A.evaluate(D, A.r3, interest=True)
    R5a, R5b = A.evaluate(D, A.ver("R5")), A.evaluate(D, A.ver("R5"), interest=True)
    print("=== H10a: доход резерва — 3-мес. векселя (итог к DCA, до/после/вся) ===")
    for nm, R in (("основа, без дохода", B0), ("основа, с доходом", B1), ("R3, без дохода", R3a), ("R3, с доходом", R3b), ("R5, без дохода", R5a), ("R5, с доходом", R5b)):
        print(f"  {nm}: " + A.line(R, A.metals(D)))
    for nm, X, Y in (("R5 к R3, с доходом", R5b, R3b), ("R5 к основе, с доходом", R5b, B1), ("R5 с доходом к R5 без дохода", R5b, R5a)):
        s = A.cmp(X, Y)
        print(f"  {nm}: {A.fb(s)}\n     {A.fa(s)}")
    print("\n=== H10b: множитель продаж m и доля серии g (только до 1999; ✓ — прошёл и без дохода, и с доходом) ===")
    rows, by = [], {}
    for m in MS:
        for g in GS:
            if m == 1.0 and g == 0.5:
                continue
            fn = sized(m, g)
            Ra, Rb = A.evaluate(D, fn), A.evaluate(D, fn, interest=True)
            sa, sb = A.cmp(Ra, R5a), A.cmp(Rb, R5b)
            oka, wa = A.select_ok(sa)
            okb, wb = A.select_ok(sb)
            r = {"name": f"продажи × {m}, доля серии {g:.0%}", "ok": oka and okb, "sa": sa, "sb": sb, "Ra": Ra, "Rb": Rb, "key": (m, g)}
            rows.append(r); by[(m, g)] = r
            print(f"  {'✓' if r['ok'] else '·'} {r['name']}\n      без дохода: {A.fb(sa)}{'' if oka else '  ← ' + wa}\n      с доходом:  {A.fb(sb)}{'' if okb else '  ← ' + wb}")
    by[(1.0, 0.5)] = {"ok": True}
    good = [r for r in rows if r["ok"] and A.plateau(by, r["key"], (MS, GS))]
    good.sort(key=lambda r: -(r["sa"]["before"]["logsum"] + r["sb"]["before"]["logsum"]))
    print(f"\nпрошли критерий (оба варианта дохода) с плато: {len(good)}")
    if good:
        best = good[0]
        print(f"ВЫБРАН: {best['name']}")
        for nm, s in (("без дохода", best["sa"]), ("с доходом", best["sb"])):
            ok, why = A.veto_ok(s)
            print(f"  ВЕТО ({nm}): {A.fa(s)} → {'проходит' if ok else 'ОТКЛОНЁН: ' + why}")
        print("  итог к DCA без дохода: " + A.line(best["Ra"], A.SEL))
    else:
        print("R5 не меняется")
    # сводка кругов 6–10
    print("\n=== СВОДКА КРУГОВ 6–10: R5 против R3 (без дохода резерва) ===")
    s = A.cmp(R5a, R3a)
    print("  8 металлов: " + A.fb(s) + "\n  " + A.fa(s) + "\n  экзамен к R3 (до/после/вся): " + A.exam(R5a, R3a))
    print("  метрики R5: " + A.fprox(A.agg(R5a, A.SEL)) + "\n  экзамен: " + A.fprox(A.agg(R5a, A.EXAM)))


if __name__ == "__main__":
    main()
