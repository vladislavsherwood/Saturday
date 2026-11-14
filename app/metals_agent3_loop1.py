"""Круг 0 + круг 1 третьего агента (новый протокол: отбор 1982–98, вето 1999–2026 против R3, экзамен в конце).
Круг 0: пересчёт DCA, R3, R6 на новом протоколе; пропуски вершин 1982–98.
Круг 1: H1a — пороги маркеров: как в R3 (80/20 по 1965–98) или пересчитанные по 1982–98 (только маркеры / маркеры + перегрев q97).
        H1b — части R6 (страховка серии, продажи ×1,3 после роста ×2,5, затяжной перегрев → 50%) по новому протоколу, с плато.
Критерий: sel_ok против R3 (+ плато для параметров); из прошедших — наибольшая сумма 1982–98; вето — только для выбранного.
Запуск: python3 app/metals_agent3_loop1.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent3_lib as T
import metals_agent_lib as L


def main():
    D = T.load()
    keys = A.metals(D)
    B = T.run(D, L.base_plan)
    R3 = T.run(D, A.ver("R3"))
    R6 = T.run(D, A.ver("R6"))
    print("КРУГ 0. Итог к DCA, % (1982–98 / 1999–2026 / вся история):")
    for nm, R in (("основа v1", B), ("R3", R3), ("R6", R6)):
        print(f"  {nm}: " + T.line(R, keys))
    for nm, R in (("основа v1", B), ("R3", R3), ("R6", R6)):
        print(f"  {nm} 1982–98: " + T.fprox(T.agg(R)) + f"\n      1999–2026: " + T.fprox(T.agg(R, which="prox_after")))
    s = T.cmp(R6, R3)
    print("  R6 к R3: " + T.fs(s) + "\n      по металлам 1982–98: " + T.bym(s, "h2"))
    miss = [(k, str(D[k]["t"][i])[:7]) for k in T.SEL for i in R3[k]["prox_h2"]["missed"]]
    print("  пропущенные вершины R3 1982–98: " + ", ".join(f"{T.NAME[k]} {t}" for k, t in miss))

    print("\nКРУГ 1. H1a — пороги маркеров")
    D82 = T.rethr(D)
    D82h = T.rethr(D, hot=True)
    thr = D82["_thr82"]
    print("  пороги 1982–98 против R3: " + "; ".join(f"{f[:22]} {dr}: {D['_thr3'][(f, dr)]:.2f} → {thr[(f, dr)]:.2f}" for f, dr in thr))
    print(f"  перегрев q97 1982–98: ×{D82h['_hot'][0]:.2f}, +{D82h['_hot'][1]:.0f}% (R3: ×1,81, +86%)")
    C = {"H1a-1 R3, пороги 1982–98 (маркеры)": (D82, A.ver("R3")),
         "H1a-2 R3, пороги 1982–98 (маркеры + перегрев)": (D82h, lambda d: A.r3(d, **T.hotkw(D82h))),
         "H1a-3 R6, пороги 1982–98 (маркеры)": (D82, A.ver("R6")),
         "H1a-4 R6, пороги 1982–98 (маркеры + перегрев)": (D82h, lambda d: A.r3(d, **{**A.VERS["R6"], **T.hotkw(D82h)}))}
    rows = T.study(D, C, R3)
    for r in rows:
        print(f"    {r['name']}: по металлам 1982–98 {T.bym(r['s'], 'h2')}")

    print("\nКРУГ 1. H1b — части R6 по новому протоколу (к R3)")
    C, meta = {}, {}
    for v in (3, 4, 5):
        C[f"страховка серии p={v}"] = (lambda v: lambda d: A.r3(d, persist=v))(v)
        meta[f"страховка серии p={v}"] = ("persist", v, 0)
    for h in (2.0, 2.5, 3.0):
        for m in (1.15, 1.3, 1.45):
            nm = f"рост ≥ {h} → продажи ×{m}"
            C[nm] = (lambda h, m: lambda d: A.r3(d, rise_h=h, rise_m=m))(h, m)
            meta[nm] = ("rise", h, m)
    for v in (0.3, 0.4, 0.5, 0.6):
        nm = f"затяжной перегрев → {v:.0%}"
        C[nm] = (lambda v: lambda d: A.r3(d, hot2=v))(v)
        meta[nm] = ("hot2", v, 0)
    C["R6 целиком"] = A.ver("R6")
    meta["R6 целиком"] = ("R6", 0, 0)
    C["R6 без страховки"] = lambda d: A.r3(d, rise_h=2.5, rise_m=1.3, hot2=0.5)
    meta["R6 без страховки"] = ("R6-", 0, 0)
    rows = T.study(D, C, R3, show=30)

    def axes(key):
        if key[0] == "rise":
            return (None, (2.0, 2.5, 3.0), (1.15, 1.3, 1.45))
        if key[0] in ("persist", "hot2"):
            return (None, (3, 4, 5) if key[0] == "persist" else (0.3, 0.4, 0.5, 0.6), None)
        return (None, None, None)
    good, by = T.pick(rows, meta, axes)
    print("  прошли с плато: " + ", ".join(r["name"] for r in good))
    for r in rows:
        if r["name"] in ("R6 целиком", "R6 без страховки") or r in good[:1]:
            T.veto(r, R3)
    # выбор основы: центр плато затяжного перегрева (30–60%, 60% — край сетки) = 50%; продажи ×1,3 после роста поверх него — проверка
    Q = T.run(D, lambda d: A.r3(d, hot2=0.5))
    print("\n  поверх «R3 + затяжной перегрев 50%» правило «рост → продажи ×m» (к нему):")
    for h in (2.0, 2.5, 3.0):
        print("    рост ≥ %.1f: " % h + "; ".join(
            f"×{m}: сумма {T.cmp(T.run(D, lambda d: A.r3(d, hot2=0.5, rise_h=h, rise_m=m)), Q)['h2']['logsum']:+.1f}" for m in (1.15, 1.3, 1.45)))
    print("  ВЫБРАНА основа Q1 = R3 + затяжной перегрев 50%")
    T.veto({"name": "Q1", "R": Q}, R3)
    print("  R6 к Q1: " + T.fs(T.cmp(R6, Q)) + "\n      " + T.fv(T.cmp(R6, Q)))
    return D, R3


if __name__ == "__main__":
    main()
