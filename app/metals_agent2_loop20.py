"""Круг 20: итог. R6 — финальная проверка (плато, старты, сдвиг и издержки, экзамен), маржа в одном счёте, текущие сигналы;
сохраняет found/metals-agent2-best.json и found/metals-agent2-best-margin.json (per-metal — круг 18).
Запуск: python3 app/metals_agent2_loop20.py"""
import json
import os

import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L
from metals_monthly import BOT, TOP

HERE = os.path.dirname(os.path.abspath(__file__))
R6 = A.VERS["R6"]


def rnd(R, k):
    return {p: (None if not np.isfinite(R[k][p]) else round(float(R[k][p]), 1)) for p in ("before", "after", "full")}


def main():
    D = A.load()
    keys = A.metals(D)
    B = A.evaluate(D, L.base_plan)
    R3 = A.evaluate(D, A.ver("R3"))
    RB = A.evaluate(D, A.ver("R6"))
    print("ИТОГ К DCA, % (до 1999 / после 1999 / вся история):")
    for nm, R in (("основа v1", B), ("R3 (metals.json)", R3), ("R6 (агент 2)", RB)):
        print(f"  {nm}: " + A.line(R, keys))
    s3, sb = A.cmp(RB, R3), A.cmp(RB, B)
    print("\nR6 против R3: " + A.fb(s3) + "\n   " + A.fa(s3) + "\n   экзамен к R3 (до/после/вся): " + A.exam(RB, R3))
    print("   по металлам до / после: " + A.bymetal(s3, "before") + " | " + A.bymetal(s3, "after"))
    print("R6 против основы v1: " + A.fb(sb) + "\n   " + A.fa(sb) + "\n   экзамен к основе: " + A.exam(RB, B))
    print("\nМЕТРИКИ БЛИЗОСТИ (отбор, вся история / экзамен):")
    for nm, R in (("основа v1", B), ("R3", R3), ("R6", RB)):
        print(f"  {nm}: {A.fprox(A.agg(R, A.SEL))}\n      экзамен: {A.fprox(A.agg(R, A.EXAM))}")
    # (а) плато новых параметров
    print("\n(а) ПЛАТО новых параметров R6 (к R3: не хуже до/после из 8; к R6: медиана до/после):")
    plat_ok = True
    for p, vals in (("persist", (3, 5)), ("rise_h", (2.0, 3.0)), ("rise_m", (1.15, 1.45)), ("hot2", (0.4, 0.6))):
        for v in vals:
            R = A.evaluate(D, (lambda kw: lambda d: A.r3(d, **kw))({**R6, p: v}), lag=False)
            a, b = A.cmp(R, R3), A.cmp(R, RB)
            plat_ok &= a["before"]["ok"] >= 7
            print(f"  {p} = {v}: к R3 {a['before']['ok']}/{a['after']['ok']}, мед. {a['before']['med']:+.1f}/{a['after']['med']:+.1f} | к R6 мед. {b['before']['med']:+.1f}/{b['after']['med']:+.1f}")
    # (б) старты, сдвиг, издержки
    sbf, saf = [], []
    for k in A.SEL:
        d = D[k]
        c, n, m = d["c"], len(d["c"]), d["m"]
        z = np.zeros(n)
        p3, p6 = A.ver("R3")(d), A.ver("R6")(d)
        for y in range(1966, 2017):
            a0 = int(np.searchsorted(d["t"].values, np.datetime64(f"{y}-01-01")))
            if a0 <= 0 and y > d["t"][0].year:
                continue
            if y <= 1988:
                sbf.append(A.rel(L.sim(c, p6, a0, m, 0, z)[0], L.sim(c, p3, a0, m, 0, z)[0]))
            elif y >= 1999 and a0 < n - 60:
                saf.append(A.rel(L.sim(c, p6, a0, n, 0, z)[0], L.sim(c, p3, a0, n, 0, z)[0]))
    sbf, saf = np.array(sbf), np.array(saf)
    print(f"\n(б) старты 1966–1988 до 1999 ({len(sbf)}): R6 не хуже R3 в {(sbf >= -0.5).mean() * 100:.0f}%, медиана {np.median(sbf):+.1f}%; "
          f"старты 1999–2016 до конца ({len(saf)}): не хуже в {(saf >= -0.5).mean() * 100:.0f}%, медиана {np.median(saf):+.1f}%")
    for nm, lag, fee in (("сдвиг 2 мес.", 2, 0.001), ("комиссия 0,5%", 0, 0.005)):
        v = np.array([A.rel(A.sim_fee(D[k]["c"], A.ver("R6")(D[k]), 0, D[k]["m"], lag, fee), A.sim_fee(D[k]["c"], A.ver("R3")(D[k]), 0, D[k]["m"], lag, fee)) for k in A.SEL])
        print(f"    {nm}: до 1999 R6 к R3 не хуже {(v >= -0.5).sum()}/8, медиана {np.median(v):+.1f}")
    # доход резерва (практический вариант)
    RI, R3I = A.evaluate(D, A.ver("R6"), interest=True, lag=False), A.evaluate(D, A.ver("R3"), interest=True, lag=False)
    print("\nрезерв в 3-мес. векселях: R6 " + A.line(RI, keys) + "\n   R6 к R3 (оба с доходом): " + A.fb(A.cmp(RI, R3I)).replace(" | сдвиг", ""))
    # (в) маржа на R6
    from metals_agent2_loop14 import check
    tot, MR, rs = check(D, 0.5, A.ver("R6"))
    print(f"\n(в) МАРЖА на R6: прогонов {tot['runs']}, ликвидаций {tot['liq']}, мин. обеспечение без стресса {tot['worst']:.2f}, в стрессе {tot['worst_st']:.2f}; "
          f"старты: медиана к R6 без маржи {np.median(rs):+.1f}%, худшие 10% {np.percentile(rs, 10):+.1f}%")
    print("  R6 + маржа: " + ", ".join(f"{A.NAME[k]} " + "/".join(f"{MR[k][p]:+.0f}" if p in MR[k] else "—" for p in ("before", "after", "full")) for k in keys))
    print("  к R6 без маржи: " + ", ".join(f"{A.NAME[k]} " + "/".join(f"{A.rel(MR[k][p], RB[k][p]):+.0f}" if p in MR[k] else "—" for p in ("before", "after", "full")) for k in keys))
    M3 = json.load(open(os.path.join(HERE, "found", "metals-agent-best-margin.json"), encoding="utf-8"))["results_vs_dca"]
    print("  маржа первого агента на R3 (для сравнения): " + ", ".join(f"{nm} " + "/".join(f"{v[p]:+.0f}" if p in v else "—" for p in ("before", "after", "full")) for nm, v in M3.items()))
    # текущие сигналы
    print("\nТЕКУЩИЕ СИГНАЛЫ R6 (данные последнего месяца → действие в следующем месяце):")
    now = {}
    for k in keys:
        d = D[k]
        p = A.ver("R6")(d)
        a = p[-1]
        act = "обычный взнос" if a == 1.0 else (f"продать {-a * 100:.0f}% позиции" if a < 0 else f"взнос и {(a - 1) * 100:.0f}% резерва")
        hot = (np.nan_to_num(A.feat(d, A.P3)) > 1.81) & (np.nan_to_num(A.feat(d, A.Y1)) > 86)
        r = A.rise(d, p)[-1]
        now[k] = {"month": f"{d['t'][-1]:%Y-%m}", "top_markers": f"{d['tn3'][-1]}/{d['nt']}", "bottom_markers": f"{d['bn3'][-1]}/{d['nb']}", "overheat": bool(hot[-1]),
                  "overheat_months": int(A.runs(hot)[-1]), "rise_from_last_series": round(float(r), 2), "action_next_month": act}
        print(f"  {A.NAME[k]:9} {d['t'][-1]:%Y-%m}: вершина {d['tn3'][-1]}/{d['nt']}, дно {d['bn3'][-1]}/{d['nb']}, перегрев {'да' if hot[-1] else 'нет'} ({A.runs(hot)[-1]} мес.), "
              f"рост от последней серии ×{r:.2f} → {act}")
    # сохранение
    t = D["_thr3"]
    F10, GO, II = A.F10, A.GO, A.II
    best = {
        "name": "Металлы: маркеры вершин и дна + растянутые докупки + групповые поправки + продажи по росту и затяжному перегреву (агент 2, R6)",
        "base": "found/metals.json (R3, первый агент)",
        "thresholds": "80-й / 20-й процентиль по восьми металлам, 1965–1998 (как в основе)",
        "top_markers": [f for f, _ in TOP],
        "top_markers_by_group": {
            "промышленные (медь, алюминий, никель, свинец, цинк, олово)": f"+ «Цена к средней за 10 лет» высоко (> {t[(F10, 'hi')]:.2f})",
            "золото и серебро": f"+ «Золото к нефти: соотношение к средней за 10 лет» высоко (> {t[(GO, 'hi')]:.2f})",
            "платина и палладий": "без добавочного маркера (7 маркеров)"},
        "bottom_markers": [f for f, _ in BOT] + [f"Пром. индекс (медь, алюминий, никель, свинец, цинк) к средней за 3 года низко (< {t[(II, 'lo')]:.3f})"],
        "rules": [
            "n — число маркеров вершины у металла (8 у промышленных, золота и серебра; 7 у платины и палладия); маркеров дна — 8",
            "маркеров дна ≥ 5 из 8, или ≥ 4 из 8 четыре месяца подряд → начинается серия докупок: взнос и 50% резерва каждый месяц; серия держится, пока маркеров дна ≥ 4",
            "маркеров вершины ≥ n−1 → продать 50%",
            "маркеров вершины = n−2 → продать 15%",
            "цена выше средней за 3 года в 1,81 раза И рост за год > 86% → продать 20% (если по маркерам продажа меньше)",
            "медь прошла вершину (за 6 мес. у меди было ≥ 5 из 7 маркеров вершины, а её цена ниже средней за 12 мес.) и у металла ≥ n−3 маркеров вершины → продать 20%",
            "если цена ≥ 2,5 × средней цены месяцев последней серии докупок (до первой серии — минимума за 36 мес.) — продажи по правилам выше × 1,3 "
            "(15% → 19,5%, 50% → 65%, 20% → 26%)",
            "если ценовой перегрев держится 2 месяца подряд и дольше — продать 50% (или больше, если по правилам выше продажа больше)",
            "иначе — обычный взнос",
            "исполнение — по средней цене следующего месяца; резерв разумно держать в 3-месячных векселях (сигналы не меняются, итог выше)"],
        "changes": [
            "агент 2, круг 3: страховка — серия докупок начинается и при ≥ 4 из 8 маркеров дна 4 месяца подряд (на истории нейтральна; при более слабом макро-сигнале дна возвращает +106 по сумме до 1999)",
            "агент 2, круг 5: продажи × 1,3, если цена ≥ 2,5 × средней цены последней серии докупок (до 1999 8/8, +20,7 по сумме; после 1999 7/8, +12,1)",
            "агент 2, круг 17: затяжной перегрев (≥ 2 мес. подряд) → продать 50% (до 1999 8/8, +18,6; после 1999 6/8, +5,3)",
            "проверено и отвергнуто (агент 2): нижняя ступень перегрева, в т.ч. с макро-фильтром и данными делового цикла (круги 1, 6, 7); возврат резерва по цене (2); "
            "доля докупки по глубине (4); «не продавать дёшево» (5); упорство и рост сигнала вершины (8); откуп на пробое и перегрев по реальной цене (9); "
            "размеры при доходе резерва (10); общий резерв на все металлы (11, +11% к портфелю до 1999, но 1972–81 −2%); парабола за 6 мес. и вторая ступень пузыря (17); "
            "«остывание» после продажи (19, мал и без плато); индивидуальные версии по металлам (18)"],
        "results_vs_dca": {A.NAME[k]: {"base_v1": rnd(B, k), "R3": rnd(R3, k), "agent2_R6": rnd(RB, k), "agent2_R6_reserve_in_tbills": rnd(RI, k)} for k in keys},
        "checks": {
            "protocol": "решения — только по 8 металлам до 1999 (и по половинам 1965–81 / 1982–98, и со сдвигом исполнения); после 1999 — вето; экзамен (палладий, олово) — только в сводках",
            "vs_R3_8_metals": {p: {"not_worse": s3[p]["ok"], "median_pct": round(s3[p]["med"], 1), "worst_pct": round(s3[p]["worst"], 1), "logsum": round(s3[p]["logsum"], 1)} for p in ("before", "h1", "h2", "after", "full")},
            "vs_base_v1_8_metals": {p: {"not_worse": sb[p]["ok"], "median_pct": round(sb[p]["med"], 1), "worst_pct": round(sb[p]["worst"], 1)} for p in ("before", "after", "full")},
            "exam_vs_R3_pct": {A.NAME[k]: {p: (None if not np.isfinite(R3[k][p]) else round(A.rel(RB[k][p], R3[k][p]), 1)) for p in ("before", "after", "full")} for k in A.EXAM},
            "starts_vs_R3": {"1966_1988_to_1999_not_worse_pct": round(float((sbf >= -0.5).mean() * 100), 0), "1999_2016_to_end_not_worse_pct": round(float((saf >= -0.5).mean() * 100), 0)},
            "lag1_vs_R3_before_logsum": round(s3["before_lag1"]["logsum"], 1),
            "proximity_R3": {kk: (round(v, 1) if isinstance(v, float) else v) for kk, v in A.agg(R3, A.SEL).items()},
            "proximity_R6": {kk: (round(v, 1) if isinstance(v, float) else v) for kk, v in A.agg(RB, A.SEL).items()},
            "proximity_R6_exam": {kk: (round(v, 1) if isinstance(v, float) else v) for kk, v in A.agg(RB, A.EXAM).items()},
            "plateau_new_params_ok": bool(plat_ok),
            "weak_spots": "олово (экзамен) после 1999 хуже R3 (затяжной перегрев и крупные продажи в долгих подъёмах); пропуски вершин не уменьшились (20/53); "
                          "пороги продаж и серии по числу макромаркеров хрупки на ±1 маркер"},
        "signals_now": {A.NAME[k]: v for k, v in now.items()},
        "scripts": ["metals_agent2_lib.py", "metals_agent2_loop0.py … metals_agent2_loop20.py"]}
    json.dump(best, open(os.path.join(HERE, "found", "metals-agent2-best.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=lambda o: int(o) if isinstance(o, np.integer) else float(o))
    margin = {
        "strategy": "found/metals-agent2-best.json (R6, агент 2)",
        "account": "отдельный счёт на каждый металл, кросс-маржа внутри счёта (монеты, деньги резерва, долг, шорт)",
        "leverage": {"when": "месяцы серии докупок И ставка ФРС в месяц решения < 3%", "size": "заём 0,5 × суммы, которая в этот месяц берётся из резерва",
                     "rate": "ставка ФРС + 2% годовых", "repay": "выручкой продаж, свободным резервом и взносами обычных месяцев (вместо покупки), пока долг не погашен",
                     "why_not_more": "0,75× уже даёт 48 ликвидаций в стрессе, 1× — 237 (круг 14)",
                     "why_not_real_rate": "условие «реальная ставка < 0» до 1999 давало ликвидации (1975: номинальная ставка 5–6%), круг 12"},
        "short": {"when": "маркеров вершины ≥ n−1 (сильная вершина)", "size": "30% капитала счёта, если цена ≥ 2,5 × средней цены последней серии докупок, иначе 10%; один шорт за раз",
                  "exit": "начало серии докупок (дно) или 24 месяца", "cost": "ставка ФРС + 2% годовых от стоимости шорта; деньги от продажи без дохода",
                  "change_vs_agent1": "агент 1 — всегда 20%; новый размер до 1999 к нему +8,5 по сумме (7/8), после 1999 не хуже 7/8 (круг 13)"},
        "liquidation_model": "уровень (монеты по минимуму месяца + деньги) / (долг + шорт по максимуму месяца) ≤ 1,1; минимум/максимум — дневные закрытия ×0,97/×1,03, "
                             "иначе из средней и полусумм с соседними месяцами ∓10%; стресс — минимумы ×0,8/×0,7 и максимумы ×1,2/×1,3 одновременно",
        "checks": {"runs": tot["runs"], "liquidations": tot["liq"], "min_collateral_level": round(float(tot["worst"]), 2), "min_collateral_level_stress": round(float(tot["worst_st"]), 2),
                   "starts_median_vs_R6_pct": round(float(np.median(rs)), 1), "starts_worst10_vs_R6_pct": round(float(np.percentile(rs, 10)), 1)},
        "results_vs_dca": {A.NAME[k]: {p: round(float(MR[k][p]), 1) for p in MR[k]} for k in keys},
        "caveat": "до 1999 дешёвых денег на дне почти не было (2 месяца при ставке < 3%), поэтому выигрыш плеча проверен только на 1999–2026; "
                  "шорты опираются на 1–4 эпизода на металл; минимумы/максимумы внутри месяца до 2000 года оценены консервативно."}
    json.dump(margin, open(os.path.join(HERE, "found", "metals-agent2-best-margin.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("\nсохранено: found/metals-agent2-best.json, found/metals-agent2-best-margin.json")


if __name__ == "__main__":
    main()
