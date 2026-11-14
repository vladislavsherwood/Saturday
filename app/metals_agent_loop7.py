"""Круг 7: индивидуальные размеры, гибрид «общая основа + групповые поправки» и сравнение общей / индивидуальной / гибридной версий.
H7a — свои размеры для каждого металла: доля резерва в месяц серии докупок g, продажи при 5 и ≥6 маркерах вершины, продажа на перегреве цены;
      выбор по итогу металла до 1999 со сглаживанием по соседям сетки (плато), проверка после 1999. Олово — по его 1965–1998.
H7b — свои размеры для группы (драгоценные / промышленные), выбор по сумме группы до 1999.
H7c — гибрид: R2 + групповые маркеры из круга 5 (промышленные: вершина + цена к средней за 10 лет; драгоценные: вершина + золото к нефти)
      + связи из круга 6 (дно + промышленный индекс дёшев; медь прошла вершину → продать 20% при своих ≥ 4). Вклад каждой части отдельно.
«Индивидуальная» версия = своя замена маркера (круг 5, H5b) + свои размеры (H7a). Палладий: истории до 1999 нет — общая/групповая версия.
Запуск: python3 app/metals_agent_loop7.py"""
import itertools

import numpy as np
import pandas as pd

import metals_agent_lib as L
from metals_monthly import BOT, TOP
from metals_agent_loop5 import changes
from metals_agent_loop6 import cross_features

IND = ["copper", "aluminum", "nickel", "lead", "zinc"]
PREC = ["gold", "silver", "platinum"]
GROUP = {**{k: "prec" for k in PREC + ["palladium"]}, **{k: "ind" for k in IND + ["tin"]}}
F10, GO, II = "Цена к средней за 10 лет", "Золото к нефти: соотношение к средней за 10 лет", "Пром. индекс к средней за 3 года"
GRID = {"g": (0.33, 0.5, 1.0), "s5": (0.1, 0.15, 0.2), "s6": (0.3, 0.5, 0.7), "sh": (0.1, 0.2, 0.3)}
R2SIZE = {"g": 0.5, "s5": 0.15, "s6": 0.5, "sh": 0.2}


def prep(D):
    for k in L.metals(D):
        D[k]["key"] = k
    cross_features(D)
    thr = dict(D["_thr"])
    thr[(F10, "hi")] = L.pooled(D, F10, 0.8)
    thr[(GO, "hi")] = L.pooled(D, GO, 0.8)
    thr[(II, "lo")] = L.pooled(D, II, 0.2)
    for f, dr in [x for _, t, b in changes() for x in t + b]:
        if (f, dr) not in thr:
            thr[(f, dr)] = L.pooled(D, f, 0.8 if dr == "hi" else 0.2)
    # медь прошла вершину: за 6 мес. был сигнал вершины меди, а её цена ниже средней за 12 мес.
    cu = D["copper"]
    c = pd.Series(cu["c"], index=cu["t"])
    sig = pd.Series(cu["tn"] >= 5, index=cu["t"]).astype(int).rolling(6, min_periods=1).max() > 0
    past = sig & (c < c.rolling(12, min_periods=9).mean())
    for k in L.metals(D):
        D[k]["cu_past"] = past.reindex(D[k]["t"]).fillna(False).values & (k != "copper")
    return thr


def build(top, bot, thr, size=None, leader=False):
    size = size or R2SIZE

    def f(d):
        tn, bn = L.count(d, thr, top), L.count(d, thr, bot)
        nt, nb = len(top), len(bot)
        p = L.plan_generic(d, tn, bn, g=size["g"], k_on=nb - 3, k_hold=nb - 4, s5=size["s5"], s6=size["s6"], k5=nt - 2, k6=nt - 1, sh=size["sh"])
        if leader:
            p = np.where(d["cu_past"] & (tn >= nt - 3) & (p == 1.0), -0.2, p)
        return p
    return f


def hybrid_sets(k, parts):
    top, bot = list(TOP), list(BOT)
    if "group" in parts:
        top.append((F10, "hi") if GROUP[k] == "ind" else (GO, "hi"))
    if "index" in parts:
        bot.append((II, "lo"))
    return top, bot


def smooth_best(d, top, bot, thr, part="before", keys_fn=None):
    """Лучшие размеры по итогу part со сглаживанием: оценка точки = среднее лог-итога её и соседей по сетке."""
    names = list(GRID)
    vals = {}
    for combo in itertools.product(*GRID.values()):
        s = dict(zip(names, combo))
        e = keys_fn(s) if keys_fn else L.edges(d, build(top, bot, thr, s)(d))[part]
        vals[combo] = np.log1p(e / 100)
    best, bs = None, -1e9
    for combo in vals:
        idx = [GRID[n].index(v) for n, v in zip(names, combo)]
        nb = [vals[combo]]
        for j in range(len(names)):
            for dd in (-1, 1):
                ii = list(idx); ii[j] += dd
                if 0 <= ii[j] < len(GRID[names[j]]):
                    nb.append(vals[tuple(GRID[n][x] for n, x in zip(names, ii))])
        sc = np.mean(nb)
        if sc > bs:
            best, bs = combo, sc
    return dict(zip(names, best))


def main():
    D = L.load()
    thr = prep(D)
    keys = L.metals(D)
    B = L.run(D, L.base_plan)
    R2 = L.run(D, L.r2_plan)
    chk = L.run(D, build(TOP, BOT, thr), prox=False)
    assert all(abs(chk[k]["full"] - R2[k]["full"]) < 1e-9 for k in keys)

    # H7c — гибрид по частям
    print("=== H7c: гибрид R2 + групповые поправки (к R2; выбор частей был по «до 1999» в кругах 5–6) ===")
    variants = {"группы (маркер вершины по группе)": ("group",), "пром. индекс у дна": ("index",), "медь-лидер": ("leader",),
                "группы + индекс": ("group", "index"), "группы + медь-лидер": ("group", "leader"), "все три": ("group", "index", "leader")}
    HY = {}
    for name, parts in variants.items():
        fn = (lambda parts: lambda d: build(*hybrid_sets(d["key"], parts), thr, leader="leader" in parts)(d))(parts)
        R = L.run(D, fn)
        HY[name] = (R, fn, parts)
        print(L.summary_line(f"  {name}:", R, R2))
        print("     экзамен (справка): " + L.line(R, L.EXAM))

    # H7a — свои размеры для каждого металла (по своему «до 1999»), H7b — по группе
    print("\n=== H7a: свои размеры для каждого металла (выбор по своему «до 1999» со сглаживанием по сетке) ===")
    own = {}
    for k in L.SEL + ["tin"]:
        d = D[k]
        own[k] = smooth_best(d, TOP, BOT, thr)
        e = L.edges(d, build(TOP, BOT, thr, own[k])(d))
        print(f"  {L.NAME[k]}: g {own[k]['g']:.0%}, 5 → {own[k]['s5']:.0%}, ≥6 → {own[k]['s6']:.0%}, перегрев → {own[k]['sh']:.0%} | к R2 до {L.rel(e['before'], R2[k]['before']):+.1f}, "
              f"после {L.rel(e['after'], R2[k]['after']):+.1f}, вся {L.rel(e['full'], R2[k]['full']):+.1f}")
    print("\n=== H7b: свои размеры для группы (сумма группы до 1999, со сглаживанием) ===")
    grp = {}
    for g, ks in (("prec", PREC), ("ind", IND)):
        def score(s, ks=ks):
            return float(np.mean([np.log1p(L.edges(D[k], build(TOP, BOT, thr, s)(D[k]))["before"] / 100) for k in ks]) * 100)
        sz = smooth_best(None, TOP, BOT, thr, keys_fn=lambda s: (np.exp(score(s) / 100) - 1) * 100)
        grp[g] = sz
        print(f"  {'драгоценные' if g == 'prec' else 'промышленные'}: g {sz['g']:.0%}, 5 → {sz['s5']:.0%}, ≥6 → {sz['s6']:.0%}, перегрев → {sz['sh']:.0%} | "
              + ", ".join(f"{L.NAME[k]} {L.rel(L.edges(D[k], build(TOP, BOT, thr, sz)(D[k]))['before'], R2[k]['before']):+.0f}/{L.rel(L.edges(D[k], build(TOP, BOT, thr, sz)(D[k]))['after'], R2[k]['after']):+.0f}" for k in ks))
    grp["prec_pd"] = grp["prec"]

    # индивидуальная замена маркера (круг 5): выбор по своему «до 1999»
    CH = changes()
    swap = {}
    for k in L.SEL + ["tin"]:
        best, bv = ("—", TOP, BOT), L.edges(D[k], build(TOP, BOT, thr)(D[k]))["before"]
        for nm, t, b in CH:
            v = L.edges(D[k], build(t, b, thr)(D[k]))["before"]
            if L.rel(v, bv) >= 3 and (best[0] == "—" or v > bvv):
                best, bvv = (nm, t, b), v
        swap[k] = best

    def indiv(d):
        k = d["key"]
        if k not in swap:                       # палладий — групповая версия
            return build(TOP, BOT, thr, grp["prec"])(d)
        nm, t, b = swap[k]
        return build(t, b, thr, own[k])(d)

    def group_only(d):
        return build(TOP, BOT, thr, grp["prec" if GROUP[d["key"]] == "prec" else "ind"])(d)

    def hybrid_sizes(d):
        t, b = hybrid_sets(d["key"], ("group", "index", "leader"))
        return build(t, b, thr, grp["prec" if GROUP[d["key"]] == "prec" else "ind"], leader=True)(d)

    print("\n=== СРАВНЕНИЕ ВЕРСИЙ (итог к DCA, %: до 1999 / после 1999 / вся история) ===")
    versions = {"основа (metals.json)": L.base_plan, "общая R2": L.r2_plan, "индивидуальная (своя замена + свои размеры)": indiv,
                "групповые размеры": group_only, "гибрид (R2 + группы + индекс + медь-лидер)": HY["все три"][1], "гибрид + групповые размеры": hybrid_sizes}
    VR = {}
    for name, fn in versions.items():
        R = L.run(D, fn)
        VR[name] = R
        s = L.compare(R, R2, L.SEL) if name != "общая R2" else None
        print(f"  {name}: " + L.line(R, keys))
        if s:
            print(f"     к R2 на 8 металлах: до не хуже {s['before']['ok']}/8, мед. {s['before']['med']:+.1f}, худш. {s['before']['worst']:+.1f}; после {s['after']['ok']}/8, мед. {s['after']['med']:+.1f}, "
                  f"худш. {s['after']['worst']:+.1f}; " + L.lagcheck(R, R2))
        print("     " + L.fmt_prox(L.agg_prox(R, L.SEL)))
    print("\nиндивидуальные замены: " + "; ".join(f"{L.NAME[k]}: {swap[k][0]}" for k in swap))
    return VR, own, grp, swap


if __name__ == "__main__":
    main()


def part_b():
    """Часть Б: насколько гибрид зависит от маркера «золото к нефти» у драгметаллов (у платины он и до 1999 был −4%)."""
    D = L.load()
    thr = prep(D)
    keys = L.metals(D)
    R2 = L.run(D, L.r2_plan)

    def hy(prec_set):
        def f(d):
            k = d["key"]
            top, bot = list(TOP), list(BOT) + [(II, "lo")]
            if GROUP[k] == "ind":
                top.append((F10, "hi"))
            elif k in prec_set:
                top.append((GO, "hi"))
            return build(top, bot, thr, leader=True)(d)
        return f
    print("\n=== ЧАСТЬ Б: гибрид с разным охватом маркера «золото к нефти» ===")
    for name, ps in (("золото, серебро, платина, палладий (как в части А)", {"gold", "silver", "platinum", "palladium"}),
                     ("только золото и серебро (у платины до 1999 −4%)", {"gold", "silver"}),
                     ("без маркера у драгметаллов (только промышленные + индекс + медь-лидер)", set())):
        R = L.run(D, hy(ps))
        print(f"  {name}:\n     " + L.line(R, keys) + "\n" + L.summary_line("     к R2:", R, R2) + "\n     " + L.lagcheck(R, R2))


if __name__ == "__main__":
    part_b()
