"""Круг 10: итог. Кандидат — R3 (круг 7). Гипотезы проверки:
H10a — R3 стоит на плато: каждый новый параметр, сдвинутый на шаг в обе стороны, не ломает результат (сравнение с основой и с R3);
H10b — выигрыш не держится на «нулевом доходе резерва»: если резерв приносит доход 3-месячных векселей, R3 всё равно лучше основы;
H10c — маржа целиком в одном счёте (плечо 0,5× при ставке ФРС < 3% + шорт 20% на сильной вершине): ноль ликвидаций
       на стандартных периодах, 510 стартах, при сдвиге исполнения и в стрессе (минимумы ×0,8/×0,7, максимумы ×1,2/×1,3).
Сохраняет found/metals-agent-best.json, found/metals-agent-best-margin.json, found/metals-agent-per-metal.json.
Запуск: python3 app/metals_agent_loop10.py"""
import json
import os

import numpy as np

import metals_agent_lib as L
from metals_monthly import BOT, TOP
from metals_agent_loop7 import F10, GO, GROUP, II, R2SIZE, build, changes, prep, smooth_best

HERE = os.path.dirname(os.path.abspath(__file__))
# итог: как R3 (круг 7), но порог индекса у дна — центр плато 25-й процентиль (20-й стоит у обрыва: 15-й ломает «до 1999»)
DEF = {"g": 0.5, "s5": 0.15, "s6": 0.5, "hot3": 1.81, "hot1": 86.0, "sh": 0.2, "qf10": 0.8, "qgo": 0.8, "qii": 0.25, "lead": 0.2, "k_on": 3}


def r3p(D, thr0, **kw):
    P = {**DEF, **kw}
    thr = dict(thr0)
    thr[(F10, "hi")] = L.pooled(D, F10, P["qf10"])
    thr[(GO, "hi")] = L.pooled(D, GO, P["qgo"])
    thr[(II, "lo")] = L.pooled(D, II, P["qii"])

    def plan(d):
        k = d["key"]
        top, bot = list(TOP), list(BOT) + [(II, "lo")]
        if GROUP[k] == "ind":
            top.append((F10, "hi"))
        elif k in ("gold", "silver"):
            top.append((GO, "hi"))
        tn, bn = L.count(d, thr, top), L.count(d, thr, bot)
        nt, nb = len(top), len(bot)
        p = L.plan_generic(d, tn, bn, g=P["g"], k_on=nb - P["k_on"], k_hold=nb - P["k_on"] - 1, s5=P["s5"], s6=P["s6"], k5=nt - 2, k6=nt - 1,
                           hot3=P["hot3"], hot1=P["hot1"], sh=P["sh"])
        return np.where(d["cu_past"] & (tn >= nt - 3) & (p == 1.0), -P["lead"], p)
    return plan


def main():
    D = L.load()
    thr = prep(D)
    keys = L.metals(D)
    B = L.run(D, L.base_plan)
    R2 = L.run(D, L.r2_plan)
    r3b, _ = L.r3_setup(D)
    R3a = L.run(D, r3b)
    chk = L.run(D, r3p(D, thr, qii=0.2), prox=False)
    assert all(abs(chk[k]["full"] - R3a[k]["full"]) < 1e-9 for k in keys)
    thr[(II, "lo")] = L.pooled(D, II, DEF["qii"])
    r3 = r3p(D, thr)
    R3 = L.run(D, r3)
    print("ИТОГ (до 1999 / после 1999 / вся история), итог к DCA, %; R3 — итог (индекс у дна q25), R3 круга 7 — q20:")
    for nm, R in (("основа", B), ("R2", R2), ("R3 круга 7", R3a), ("R3", R3)):
        print(f"  {nm}: " + L.line(R, keys))
    print(L.summary_line("R3 против основы (8 металлов отбора):", R3, B) + "\n   " + L.lagcheck(R3, B))
    ex = {k: {p: L.rel(R3[k][p], B[k][p]) for p in ("before", "after", "full") if np.isfinite(B[k][p])} for k in L.EXAM}
    print("   экзамен против основы: " + "; ".join(f"{L.NAME[k]} " + ", ".join(f"{p} {v:+.1f}" for p, v in ex[k].items()) for k in L.EXAM))
    sfin = L.compare(R3, B)
    d = D["gold"]
    a0, a1 = (int(np.searchsorted(d["t"].values, np.datetime64(x))) for x in ("1974-01-01", "1988-01-01"))
    rate = np.zeros(len(d["c"]))
    gold7487 = {"base": round(float(L.sim(d["c"], L.base_plan(d), a0, a1, 0, rate)[0]), 1), "agent": round(float(L.sim(d["c"], r3(d), a0, a1, 0, rate)[0]), 1)}
    print(f"   золото 1974–1987 (слабое место основы), итог к DCA: основа {gold7487['base']:+.1f}%, R3 {gold7487['agent']:+.1f}%")
    print("\nМЕТРИКИ БЛИЗОСТИ (отбор / экзамен):")
    for nm, R in (("основа", B), ("R2", R2), ("R3", R3)):
        print(f"  {nm}: отбор — {L.fmt_prox(L.agg_prox(R, L.SEL))}\n        экзамен — {L.fmt_prox(L.agg_prox(R, L.EXAM))}")

    # H10a — плато
    print("\n=== H10a: плато R3 — каждый параметр на шаг в обе стороны (против основы: не хуже до/после из 8, медианы; против R3: медиана до/после) ===")
    steps = {"g": (0.4, 0.67), "s5": (0.1, 0.2), "s6": (0.4, 0.6), "hot3": (1.72, 1.96), "hot1": (77.0, 103.0), "sh": (0.1, 0.3),
             "qf10": (0.75, 0.85), "qgo": (0.75, 0.85), "qii": (0.15, 0.2, 0.3), "lead": (0.1, 0.3), "k_on": (2, 4)}
    worst_seen = []
    for p, vals in steps.items():
        for v in vals:
            R = L.run(D, r3p(D, thr, **{p: v}), prox=False)
            sb, s3 = L.compare(R, B), L.compare(R, R3)
            worst_seen.append((s3["before"]["med"], s3["after"]["med"], p, v))
            print(f"  {p} = {v}: к основе {sb['before']['ok']}/{sb['after']['ok']}, мед. {sb['before']['med']:+.1f}/{sb['after']['med']:+.1f}, худш. {sb['before']['worst']:+.1f}/{sb['after']['worst']:+.1f}"
                  f" | к R3 мед. {s3['before']['med']:+.1f}/{s3['after']['med']:+.1f}")

    # H10b — доход резерва
    print("\n=== H10b: если резерв приносит доход 3-месячных векселей ===")
    BI = L.run(D, L.base_plan, interest=True, prox=False)
    RI = L.run(D, r3, interest=True, prox=False)
    print("  основа: " + L.line(BI, keys) + "\n  R3:     " + L.line(RI, keys))
    s = L.compare(RI, BI)
    print(f"  R3 против основы: до 1999 не хуже {s['before']['ok']}/8, мед. {s['before']['med']:+.1f}; после {s['after']['ok']}/8, мед. {s['after']['med']:+.1f}; вся мед. {s['full']['med']:+.1f}")

    # H10c — маржа целиком
    from metals_agent_loop9 import signals
    signals(D, thr)
    print("\n=== H10c: маржа в одном счёте — R3 + заём 0,5× на докупках при ставке ФРС < 3% + шорт 20% на сильной вершине (до дна или 24 мес.) ===")
    tot = {"liq": 0, "runs": 0, "worst": 1e9}
    MR = {}
    rs_all = []
    for k in keys:
        d = D[k]
        c, n, m = d["c"], len(d["c"]), d["m"]
        plan = r3(d)
        lev = np.where((plan > 1.0) & (d["ff"] < 3.0), 0.5, 0.0)
        ent, ext = d["_strong"], d["_ep"]
        z, zb = np.zeros(n), np.zeros(n, bool)
        MR[k] = {}
        segs = [("before", 0, m), ("after", m, n), ("full", 0, n)] if m > 24 else [("after", m, n), ("full", 0, n)]
        for nm, a0, a1 in segs:
            e0 = L.sim_combo(c, d["lo"], d["hi"], plan, z, zb, ext, d["ff"], a0, a1, 1.0, 2.0, 1.1, 0, 0.2, 24)[0]
            assert abs(e0 - L.edges(d, plan)[nm]) < 1e-6
            for st in (1.0, 0.8, 0.7):
                for lag in (0, 1):
                    e, lq, w = L.sim_combo(c, d["lo"], d["hi"], plan, lev, ent, ext, d["ff"], a0, a1, st, 2.0, 1.1, lag, 0.2, 24)
                    tot["liq"] += lq; tot["runs"] += 1; tot["worst"] = min(tot["worst"], w) if st == 1.0 else tot["worst"]
                    if st == 1.0 and lag == 0:
                        MR[k][nm] = e
        for y in range(1966, 2017):
            a0 = int(np.searchsorted(d["t"].values, np.datetime64(f"{y}-01-01")))
            if (a0 <= 0 and y > d["t"][0].year) or a0 >= n - 60:
                continue
            e0 = L.sim_combo(c, d["lo"], d["hi"], plan, z, zb, ext, d["ff"], a0, n, 1.0, 2.0, 1.1, 0, 0.2, 24)[0]
            for st in (1.0, 0.8, 0.7):
                e, lq, w = L.sim_combo(c, d["lo"], d["hi"], plan, lev, ent, ext, d["ff"], a0, n, st, 2.0, 1.1, 0, 0.2, 24)
                tot["liq"] += lq; tot["runs"] += 1
                if st == 1.0:
                    rs_all.append(L.rel(e, e0))
    print(f"  прогонов {tot['runs']} (периоды × стресс × сдвиг + старты × стресс): ликвидаций {tot['liq']}, мин. уровень обеспечения без стресса {tot['worst']:.2f}")
    print(f"  старты ({len(rs_all)}): медиана к R3 без маржи {np.median(rs_all):+.1f}%, худшие 10% {np.percentile(rs_all, 10):+.1f}%, хуже без маржи {np.mean(np.array(rs_all) < -0.5) * 100:.0f}%")
    print("  R3 + маржа: " + ", ".join(f"{L.NAME[k]} " + "/".join(f"{MR[k][p]:+.0f}" if p in MR[k] else "—" for p in ("before", "after", "full")) for k in keys))
    print("  к R3 без маржи: " + ", ".join(f"{L.NAME[k]} " + "/".join(f"{L.rel(MR[k][p], R3[k][p]):+.0f}" if p in MR[k] else "—" for p in ("before", "after", "full")) for k in keys))
    print("  к основе: " + ", ".join(f"{L.NAME[k]} " + "/".join(f"{L.rel(MR[k][p], B[k][p]):+.0f}" if p in MR[k] else "—" for p in ("before", "after", "full")) for k in keys))

    # индивидуальные версии для found/metals-agent-per-metal.json
    CH = changes()
    swap, own = {}, {}
    for k in L.SEL + ["tin"]:
        best, bvv = ("—", TOP, BOT), L.edges(D[k], build(TOP, BOT, thr)(D[k]))["before"]
        b0 = bvv
        for nm, t, b in CH:
            v = L.edges(D[k], build(t, b, thr)(D[k]))["before"]
            if L.rel(v, b0) >= 3 and v > bvv:
                best, bvv = (nm, t, b), v
        swap[k] = best
        own[k] = smooth_best(D[k], TOP, BOT, thr)

    def indiv(d):
        k = d["key"]
        if k not in swap:
            return L.r2_plan(d)
        nm, t, b = swap[k]
        return build(t, b, thr, own[k])(d)
    RI2 = L.run(D, indiv, prox=False)
    rnd = lambda R, k: {p: (None if not np.isfinite(R[k][p]) else round(float(R[k][p]), 1)) for p in ("before", "after", "full")}    # noqa: E731
    per = {"note": "Индивидуальные варианты по металлам (круги 5 и 7): своя замена одного маркера и свои размеры, выбранные по истории металла до 1999 "
                   "(палладий — без своей истории до 1999, для него общая версия R2). Итог к DCA, %: до 1999 / после 1999 / вся история. "
                   "Вывод: индивидуальные версии переобучены (золото после 1999 −47% против +25% у основы), рекомендуем гибрид R3.",
           "metals": {}}
    for k in keys:
        item = {"name": L.NAME[k], "group": "драгоценные" if GROUP[k] == "prec" else "промышленные", "exam": k in L.EXAM,
                "base": rnd(B, k), "general_R2": rnd(R2, k), "hybrid_R3": rnd(R3, k), "individual": rnd(RI2, k)}
        if k in swap:
            item["individual_rules"] = {"marker_change": swap[k][0], "bottom_share_per_month": own[k]["g"], "sell_at_n-2": own[k]["s5"], "sell_at_n-1": own[k]["s6"],
                                        "sell_on_price_overheat": own[k]["sh"], "fitted_on": "собственная история до 1999"}
        else:
            item["individual_rules"] = "нет истории до 1999 — общая версия R2"
        item["hybrid_corrections"] = (["вершина + цена к средней за 10 лет высоко"] if GROUP[k] == "ind" else (["вершина + золото к нефти высоко"] if k in ("gold", "silver") else [])) + \
            ["дно + промышленный индекс дёшев к средней за 3 года", "медь прошла вершину → продать 20% при ≥ n−3 маркерах вершины"]
        per["metals"][k] = item
    json.dump(per, open(os.path.join(HERE, "found", "metals-agent-per-metal.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nиндивидуальная версия: " + L.line(RI2, keys))

    # лучший кандидат
    t = thr
    best = {
        "name": "Металлы: маркеры вершин и дна + растянутые докупки + групповые поправки (агент, R3)",
        "thresholds": "80-й / 20-й процентиль по восьми металлам, 1965–1998 (как в основе)",
        "top_markers": [f for f, _ in TOP],
        "top_markers_by_group": {
            "промышленные (медь, алюминий, никель, свинец, цинк, олово)": f"+ «Цена к средней за 10 лет» высоко (> {t[(F10, 'hi')]:.2f})",
            "золото и серебро": f"+ «Золото к нефти: соотношение к средней за 10 лет» высоко (> {t[(GO, 'hi')]:.2f})",
            "платина и палладий": "без добавочного маркера (7 маркеров)"},
        "bottom_markers": [f for f, _ in BOT] + [f"Пром. индекс (медь, алюминий, никель, свинец, цинк) к средней за 3 года низко (< {t[(II, 'lo')]:.3f})"],
        "rules": [
            "n — число маркеров вершины у металла (8 у промышленных, золота и серебра; 7 у платины и палладия); маркеров дна — 8",
            "маркеров дна ≥ 5 из 8 → начинается серия докупок: взнос и 50% резерва каждый месяц; серия держится, пока маркеров дна ≥ 4",
            "маркеров вершины ≥ n−1 → продать 50%",
            "маркеров вершины = n−2 → продать 15%",
            "цена выше средней за 3 года в 1,81 раза И рост за год > 86% → продать 20% (если по маркерам продажа меньше)",
            "медь прошла вершину (за 6 мес. у меди было ≥ 5 из 7 маркеров вершины, а её цена ниже средней за 12 мес.) и у металла ≥ n−3 маркеров вершины → продать 20%",
            "иначе — обычный взнос"],
        "changes": [
            "круг 1: весь резерв за один месяц → 50% резерва в месяц, серия держится, пока маркеров дна ≥ 4 из 8 (растягивание по дну)",
            "круг 2: продажи 10%/30% → 15%/50%; новый ценовой сигнал перегрева (×1,81 к средней за 3 года и +86% за год) → продать 20%",
            "круг 7: групповые маркеры вершины (промышленные — цена к средней за 10 лет, золото и серебро — золото к нефти), 8-й маркер дна — промышленный индекс, правило «медь-лидер»",
            "проверено и отвергнуто: возврат резерва на развороте, подтверждение вершины, конфликт-правила, свои пороги металла, свои наборы маркеров и размеры (круги 3–7)"],
        "results_vs_dca": {L.NAME[k]: {"base": rnd(B, k), "agent": rnd(R3, k)} for k in keys},
        "checks": {"vs_base_8_metals": {p: {"not_worse": sfin[p]["ok"], "median_pct": round(sfin[p]["med"], 1), "worst_pct": round(sfin[p]["worst"], 1)} for p in ("before", "after", "full")},
                   "exam_vs_base_pct": {L.NAME[k]: {p: round(v, 1) for p, v in ex[k].items()} for k in L.EXAM},
                   "proximity_base": {kk: (round(v, 1) if isinstance(v, float) else v) for kk, v in L.agg_prox(B, L.SEL).items()},
                   "proximity_agent": {kk: (round(v, 1) if isinstance(v, float) else v) for kk, v in L.agg_prox(R3, L.SEL).items()},
                   "gold_1974_1987": gold7487,
                   "fragility": "серия докупок при ≥ 6 из 8 маркеров дна ломает результат (как «≥ 5 из 7» у основы); при ≥ 4 из 8 — хуже итога на 4–8%, но лучше основы"},
        "scripts": ["metals_agent_lib.py", "metals_agent_loop7.py", "metals_agent_loop10.py"]}
    json.dump(best, open(os.path.join(HERE, "found", "metals-agent-best.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=int)
    margin = {
        "strategy": "found/metals-agent-best.json (R3)",
        "account": "отдельный счёт на каждый металл, кросс-маржа внутри счёта (монеты, деньги резерва, долг, шорт)",
        "leverage": {"when": "месяцы серии докупок (маркеров дна ≥ 5 из 8, серия держится при ≥ 4) И ставка ФРС в месяц решения < 3%",
                     "size": "заём 0,5 × суммы, которая в этот месяц берётся из резерва", "rate": "ставка ФРС + 2% годовых",
                     "repay": "выручкой продаж, свободным резервом и взносами обычных месяцев (вместо покупки), пока долг не погашен"},
        "short": {"when": "маркеров вершины ≥ n−1 (сильная вершина)", "size": "20% капитала счёта при открытии, один шорт за раз",
                  "exit": "начало серии докупок (дно) или 24 месяца", "cost": "ставка ФРС + 2% годовых от стоимости шорта; деньги от продажи без дохода"},
        "liquidation_model": "уровень (монеты по минимуму месяца + деньги) / (долг + шорт по максимуму месяца) ≤ 1,1; минимум/максимум — дневные закрытия ×0,97/×1,03, "
                             "иначе из средней и полусумм с соседними месяцами ∓10%; стресс — минимумы ×0,8/×0,7 и максимумы ×1,2/×1,3 одновременно",
        "checks": {"runs": tot["runs"], "liquidations": tot["liq"], "min_collateral_level": round(float(tot["worst"]), 2),
                   "starts_median_vs_R3_pct": round(float(np.median(rs_all)), 1), "starts_worst10_vs_R3_pct": round(float(np.percentile(rs_all, 10)), 1)},
        "results_vs_dca": {L.NAME[k]: {p: round(float(MR[k][p]), 1) for p in MR[k]} for k in keys},
        "caveat": "до 1999 дешёвых денег на дне почти не было (2 месяца при ставке < 3%), поэтому выигрыш плеча проверен в основном на 1999–2026; "
                  "шорты опираются на 2–4 эпизода на металл (1974, 1987, 2008, 2011)."}
    json.dump(margin, open(os.path.join(HERE, "found", "metals-agent-best-margin.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nсохранено: found/metals-agent-best.json, found/metals-agent-best-margin.json, found/metals-agent-per-metal.json")


if __name__ == "__main__":
    main()
