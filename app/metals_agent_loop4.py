"""Круг 4: свои пороги для каждого металла. Основа сравнения — R2 (пороги 80/20 по восьми металлам вместе, перегрев ×1,81 и +86%).
H4a — пороги всех 14 маркеров по собственной истории металла до 1999 (q = 75/80/85).
H4b — свои пороги только у ценовых маркеров (цена к средней за 3 года, рост за год), макро — общие.
H4c — свой порог перегрева цены: процентиль q (95–99) собственной истории до 1999.
Палладий: своей истории до 1999 нет (с 1998-09) — для него всегда общие пороги. Олово (экзамен) — свои пороги по его 1965–1998.
Запуск: python3 app/metals_agent_loop4.py"""
import numpy as np

import metals_agent_lib as L
from metals_monthly import BOT, TOP

PRICE = {(L.P3, "hi"), (L.Y1, "hi"), (L.P3, "lo")}


def mk(q=0.8, which="all", qh=None):
    """which: 'pool' — общие пороги; 'all' — все свои; 'price' — свои только у ценовых маркеров. qh — свой процентиль перегрева."""
    def f(d):
        pool = d["_pool"]
        if which == "pool" or d.get("_nohist"):
            thr = pool
        else:
            own = L.own_thr(d, q, TOP + BOT)
            thr = {m: (own[m] if (which == "all" or m in PRICE) else pool[m]) for m in TOP + BOT}
        tn, bn = L.count(d, thr, TOP), L.count(d, thr, BOT)
        h3, h1 = 1.81, 86.0
        if qh and not d.get("_nohist"):
            m = d["m"]
            h3 = float(np.nanquantile(d["F"][L.P3].values[:m], qh))
            h1 = float(np.nanquantile(d["F"][L.Y1].values[:m], qh))
        return L.plan_generic(d, tn, bn, hot3=h3, hot1=h1)
    return f


def main():
    D = L.load()
    pool = D["_thr"]
    for k in L.metals(D):
        D[k]["_pool"] = pool
        D[k]["_nohist"] = D[k]["m"] < 120
    B = L.run(D, L.base_plan)
    R2 = L.run(D, L.r2_plan)
    chk = L.run(D, mk(which="pool"))
    assert all(abs(chk[k]["full"] - R2[k]["full"]) < 1e-9 for k in L.metals(D)), "сборка R2 через пороги не совпала"
    print("пороги по своей истории до 1999 (80/20) против общих:")
    for (f, dr) in TOP[:2] + BOT[:1]:
        print(f"  {f} ({dr}): общий {pool[(f, dr)]:.3g}; " + ", ".join(f"{L.NAME[k]} {L.own_thr(D[k], 0.8, [(f, dr)])[(f, dr)]:.3g}" for k in L.metals(D) if not D[k]['_nohist']))
    for qh in (0.97,):
        print(f"  перегрев q{int(qh * 100)}: " + ", ".join(f"{L.NAME[k]} ×{np.nanquantile(D[k]['F'][L.P3].values[:D[k]['m']], qh):.2f} и +{np.nanquantile(D[k]['F'][L.Y1].values[:D[k]['m']], qh):.0f}%"
                                                for k in L.metals(D) if not D[k]['_nohist']))
    C = {}
    for q in (0.75, 0.8, 0.85):
        for which in ("all", "price"):
            for qh in (None, 0.95, 0.97, 0.98, 0.99):
                C[f"H4{'a' if which == 'all' else 'b'} свои пороги ({'все' if which == 'all' else 'ценовые'}) q{int(q * 100)}"
                  + (f" + H4c свой перегрев q{int(qh * 100)}" if qh else ", перегрев общий")] = mk(q, which, qh)
    for qh in (0.95, 0.96, 0.97, 0.98, 0.99):
        C[f"H4c только свой перегрев q{int(qh * 100)} (остальное общее)"] = mk(0.8, "pool", qh)
    keys = L.SEL
    print(f"\nвариантов: {len(C)}; к R2; лучшие по 1965–1998:")
    rows = L.study(D, C, R2, keys, show=8)
    print("\nВСЕ (к R2: сумма до / после; не хуже до / после из 8; худший до / после):")
    for r in sorted(rows, key=lambda r: r["name"]):
        s = r["s"]
        print(f"  {r['name']}: {s['before']['logsum']:+5.0f} / {s['after']['logsum']:+5.0f}; {s['before']['ok']}/{s['after']['ok']}; {s['before']['worst']:+.1f} / {s['after']['worst']:+.1f}")
    # по металлам: где свои пороги помогают (H4a q80 с общим перегревом и H4c q97)
    for name in ("H4a свои пороги (все) q80, перегрев общий", "H4b свои пороги (ценовые) q80, перегрев общий", "H4c только свой перегрев q97 (остальное общее)"):
        r = next(x for x in rows if x["name"] == name)
        print(f"\n{name}, разница к R2 по металлам до / после:\n   " + ", ".join(f"{L.NAME[k]} {L.rel(r['R'][k]['before'], R2[k]['before']):+.0f}/{L.rel(r['R'][k]['after'], R2[k]['after']):+.0f}" for k in keys))
    # экзамен: олово со своими порогами (подбор только по его 1965–1998 — но правило выбрано на отборе)
    print("\nОлово (экзамен), итог до / после / вся: R2 " + L.line(R2, ["tin"]))
    for name in ("H4a свои пороги (все) q80, перегрев общий", "H4b свои пороги (ценовые) q80, перегрев общий", "H4c только свой перегрев q97 (остальное общее)"):
        R = L.run(D, C[name], ["tin"])
        print(f"   {name}: " + L.line(R, ["tin"]))


if __name__ == "__main__":
    main()


GROUPS = {"драг": ["gold", "silver", "platinum"], "пром": ["copper", "aluminum", "nickel", "lead", "zinc"]}
GROUP_OF = {**{k: "драг" for k in GROUPS["драг"]}, **{k: "пром" for k in GROUPS["пром"]}, "palladium": "драг", "tin": "пром"}


def group_part():
    """H4d — пороги по группе (драгоценные: золото, серебро, платина; промышленные: медь, алюминий, никель, свинец, цинк), 1965–1998."""
    D = L.load()
    pool = D["_thr"]
    R2 = L.run(D, L.r2_plan)
    gthr = {}
    for g, ks in GROUPS.items():
        for q in (0.75, 0.8, 0.85):
            t = {}
            for f, dr in TOP + BOT:
                v = np.concatenate([D[k]["F"][f].values[: D[k]["m"]] for k in ks])
                v = v[np.isfinite(v)]
                t[(f, dr)] = float(np.quantile(v, q if dr == "hi" else 1 - q))
            gthr[(g, q)] = t

    def mkg(q, which):
        def f(d):
            t = gthr[(GROUP_OF[d["key"]], q)]
            thr = {m: (t[m] if (which == "all" or m in PRICE) else pool[m]) for m in TOP + BOT}
            return L.plan_generic(d, L.count(d, thr, TOP), L.count(d, thr, BOT))
        return f
    for k in L.metals(D):
        D[k]["key"] = k
    C = {f"H4d пороги по группе ({'все' if w == 'all' else 'ценовые'}) q{int(q * 100)}": mkg(q, w) for q in (0.75, 0.8, 0.85) for w in ("all", "price")}
    print("\n=== H4d: пороги по группе металлов (к R2) ===")
    rows = L.study(D, C, R2, L.SEL, show=6)
    r = next(x for x in rows if x["name"] == "H4d пороги по группе (ценовые) q80")
    print("   ценовые q80 по металлам до / после: " + ", ".join(f"{L.NAME[k]} {L.rel(r['R'][k]['before'], R2[k]['before']):+.0f}/{L.rel(r['R'][k]['after'], R2[k]['after']):+.0f}" for k in L.SEL))


if __name__ == "__main__":
    group_part()
