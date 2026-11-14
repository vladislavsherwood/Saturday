"""Круг 10: итог. Q2 — финальная проверка: плато параметров, сдвиг на 1–2 мес., комиссия 0,5%, старты, вклад частей по металлам, экзамен
(впервые), метрики близости, маржа; сохраняет found/metals-agent3-best.json, -margin.json, -per-metal.json.
H10 (записана до запуска): Q2 стоит на плато — каждый параметр на шаг в обе стороны не хуже R3 на ≥ 7/8 в 1982–98 и проходит вето 1999–2026;
со сдвигом на 2 мес. и комиссией 0,5% Q2 не хуже R3 на ≥ 7/8 в 1982–98; старты 1999–2016 до конца — не хуже R3 в ≥ 70%.
Запуск: python3 app/metals_agent3_loop10.py"""
import json
import os

import numpy as np

import metals_agent2_lib as A
import metals_agent3_lib as T
import metals_agent_lib as L
from metals_agent3_loop5 import cool
from metals_agent3_loop9 import check, stat

HERE = os.path.dirname(os.path.abspath(__file__))


def qv(hot2=0.5, v=0.2, N=24):
    def f(d):
        return cool(lambda dd: A.r3(dd, hot2=hot2), v, N)(d)
    return f


def clean(o):
    """NaN → null, numpy-числа → обычные (для JSON)."""
    if isinstance(o, dict):
        return {k: clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if hasattr(o, "item"):
        o = o.item()
    if isinstance(o, float) and not np.isfinite(o):
        return None
    return o


def rnd(R, k, parts=("h2", "after", "full")):
    return {p: (None if not np.isfinite(R[k].get(p, np.nan)) else round(float(R[k][p]), 1)) for p in parts}


def main():
    D = T.load()
    keys = A.metals(D)
    q2 = qv()
    B, R3, R6, Q1, Q = (T.run(D, f) for f in (L.base_plan, A.ver("R3"), A.ver("R6"), lambda d: A.r3(d, hot2=0.5), q2))
    print("ИТОГ К DCA, % (1982–98 / 1999–2026 / вся история):")
    for nm, R in (("основа v1", B), ("R3", R3), ("R6", R6), ("Q1", Q1), ("Q2", Q)):
        print(f"  {nm}: " + T.line(R, keys))
    for nm, R in (("R3", R3), ("R6", R6)):
        s = T.cmp(Q, R)
        print(f"\nQ2 против {nm}: {T.fs(s)}\n   {T.fv(s)}\n   по металлам 1982–98 / 1999–2026: {T.bym(s, 'h2')} | {T.bym(s, 'after')}\n   экзамен (1982–98 / после / вся): {T.exam(Q, R)}")
    print("\nМЕТРИКИ БЛИЗОСТИ (8 металлов; 1982–98 / 1999–2026 / экзамен 1999–2026):")
    for nm, R in (("основа v1", B), ("R3", R3), ("R6", R6), ("Q2", Q)):
        print(f"  {nm}: {T.fprox(T.agg(R))}\n      {T.fprox(T.agg(R, which='prox_after'))}\n      экзамен: {T.fprox(T.agg(R, T.EXAM, 'prox_after'))}")
    print("  пропущенные вершины Q2 1982–98: " + ", ".join(f"{T.NAME[k]} {str(D[k]['t'][i])[:7]}" for k in T.SEL for i in Q[k]["prox_h2"]["missed"])
          + "\n  1999–2026: " + ", ".join(f"{T.NAME[k]} {str(D[k]['t'][i])[:7]}" for k in keys for i in Q[k]["prox_after"]["missed"]))
    # плато
    print("\nПЛАТО (к R3: не хуже из 8 в 1982–98 / вето 1999–2026; к Q2: сумма 1982–98 / медиана 1999–2026):")
    plat = True
    for nm, f in (("затяжной перегрев 40%", qv(hot2=0.4)), ("затяжной перегрев 60%", qv(hot2=0.6)), ("остывание после продажи ≥ 50%", qv(v=0.5)),
                  ("остывание 12 мес.", qv(N=12)), ("остывание 36 мес.", qv(N=36))):
        R = T.run(D, f)
        a, b = T.cmp(R, R3), T.cmp(R, Q)
        vo = T.veto_ok(a)[0]
        plat &= a["h2"]["ok"] >= 7 and vo
        print(f"  {nm}: к R3 {a['h2']['ok']}/8, вето {'да' if vo else 'НЕТ'} (мед. {a['after']['med']:+.1f}, худш. {a['after']['worst']:+.1f}) | к Q2 {b['h2']['logsum']:+.1f} / {b['after']['med']:+.1f}")
    # сдвиг, комиссия, старты
    for nm, lag, fee in (("сдвиг 1 мес.", 1, 0.001), ("сдвиг 2 мес.", 2, 0.001), ("комиссия 0,5%", 0, 0.005)):
        v = np.array([A.rel(A.sim_fee(D[k]["c"], q2(D[k]), D[k]["h82"], D[k]["m"], lag, fee), A.sim_fee(D[k]["c"], A.ver("R3")(D[k]), D[k]["h82"], D[k]["m"], lag, fee)) for k in T.SEL])
        w = np.array([A.rel(A.sim_fee(D[k]["c"], q2(D[k]), D[k]["m"], len(D[k]["c"]), lag, fee), A.sim_fee(D[k]["c"], A.ver("R3")(D[k]), D[k]["m"], len(D[k]["c"]), lag, fee)) for k in T.SEL])
        print(f"  {nm}: Q2 к R3 1982–98 не хуже {(v >= -0.5).sum()}/8, медиана {np.median(v):+.1f}; 1999–2026 не хуже {(w >= -0.5).sum()}/8, медиана {np.median(w):+.1f}")
    sa = []
    for k in T.SEL:
        d = D[k]; c, n = d["c"], len(d["c"]); z = np.zeros(n)
        for y in range(1999, 2017):
            a0 = int(np.searchsorted(d["t"].values, np.datetime64(f"{y}-01-01")))
            sa.append(A.rel(L.sim(c, q2(d), a0, n, 0, z)[0], L.sim(c, A.ver("R3")(d), a0, n, 0, z)[0]))
    sa = np.array(sa)
    s3 = T.cmp(Q, R3)
    print(f"  старты 1982–1990 до 1999 — не хуже R3 в {s3['starts']['share']:.0f}%; старты 1999–2016 до конца ({len(sa)}) — в {(sa >= -0.5).mean() * 100:.0f}% (медиана {np.median(sa):+.1f})")
    print(f"  H10 (плато): {'выполнена' if plat else 'НЕ выполнена'}")
    # вклад частей по металлам
    print("\nВКЛАД ЧАСТЕЙ Q2 ПО МЕТАЛЛАМ (к R3, 1982–98 / 1999–2026):")
    parts = {"затяжной перегрев": Q1, "остывание (поверх Q1)": Q}
    prev = R3
    contrib = {}
    for nm, R in parts.items():
        contrib[nm] = {k: (round(A.rel(R[k]["h2"], prev[k]["h2"]), 1) if np.isfinite(R[k]["h2"]) else None, round(A.rel(R[k]["after"], prev[k]["after"]), 1)) for k in keys}
        print(f"  {nm}: " + ", ".join(f"{T.NAME[k]} {'—' if v[0] is None else f'{v[0]:+.1f}'}/{v[1]:+.1f}" for k, v in contrib[nm].items()))
        prev = R
    # маржа
    tot, MR, M0, rs = check(D, q2, 0.5, 0.0, 0.0)
    tos, MS, _, rss = check(D, q2, 0.5, 0.3, 0.1)
    sa_m, ss_m = stat(MR, M0, "after"), stat(MS, M0, "after")
    print(f"\nМАРЖА на Q2: заём 0,5× при ФРС < 3% — прогонов {tot['runs']}, ликвидаций {tot['liq']}, мин. обеспечение {tot['worst']:.2f} (стресс {tot['worst_st']:.2f}); "
          f"1999–2026 к Q2 без маржи: мед. {sa_m['med']:+.1f}, худш. {sa_m['worst']:+.1f}\n  + шорт 30%/10%: ликвидаций {tos['liq']}, мед. {ss_m['med']:+.1f}")
    print("  Q2 + заём (1982–98 / 1999–2026 / 1982–2026): " + ", ".join(f"{A.NAME[k]} " + "/".join(f"{MR[k][p]:+.0f}" if p in MR[k] else "—" for p in ("h2", "after", "from82")) for k in keys))
    print("  Q2 + заём + шорт: " + ", ".join(f"{A.NAME[k]} " + "/".join(f"{MS[k][p]:+.0f}" if p in MS[k] else "—" for p in ("h2", "after", "from82")) for k in keys))
    m6 = json.load(open(os.path.join(HERE, "found", "metals-agent2-best-margin.json"), encoding="utf-8"))
    # сигналы сейчас
    print("\nТЕКУЩИЕ СИГНАЛЫ Q2 (данные последнего месяца → действие в следующем месяце):")
    now = {}
    for k in keys:
        d = D[k]; p = q2(d)[-1]
        act = "взнос + 50% резерва (серия докупок)" if p > 1 else ("копить взнос в резерв (остывание)" if p == 0 else (f"продать {-p:.0%}" if p < 0 else "обычный взнос"))
        now[d["name"]] = {"month": str(d["t"][-1])[:7], "top_markers": int(d["tn3"][-1]), "n_top": int(d["nt"]), "bottom_markers": int(d["bn3"][-1]), "action": act}
        print(f"  {d['name']} ({str(d['t'][-1])[:7]}): вершины {d['tn3'][-1]}/{d['nt']}, дна {d['bn3'][-1]}/{d['nb']} → {act}")
    # файлы
    best = json.load(open(os.path.join(HERE, "found", "metals-agent2-best.json"), encoding="utf-8"))
    out = {"name": "Металлы: R3 + затяжной перегрев + остывание после продажи (агент 3, Q2; отбор 1982–1998)",
           "base": "found/metals.json (R3, первый агент)",
           "protocol": "отбор — 8 металлов, 1982–1998 (старт с нуля в 1982; 1965–81 не участвует); вето — 1999–2026 против R3 (медиана ≥ 0, не хуже ≥ 5/8, худший ≥ −10%); экзамен — палладий, олово",
           "thresholds": best["thresholds"] + "; пересчёт по 1982–98 проверен и отвергнут (круг 1)",
           "top_markers": best["top_markers"], "top_markers_by_group": best["top_markers_by_group"], "bottom_markers": best["bottom_markers"],
           "rules": [
               "n — число маркеров вершины у металла (8 у промышленных, золота и серебра; 7 у платины и палладия); маркеров дна — 8",
               "маркеров дна ≥ 5 из 8 → серия докупок: взнос и 50% резерва каждый месяц; серия держится, пока маркеров дна ≥ 4",
               "маркеров вершины ≥ n−1 → продать 50%; = n−2 → продать 15%",
               "цена выше средней за 3 года в 1,81 раза И рост за год > 86% → продать 20% (если по маркерам продажа меньше)",
               "если этот перегрев держится 2 месяца подряд и дольше — продать 50%",
               "медь прошла вершину (за 6 мес. у меди было ≥ 5 из 7 маркеров вершины, а её цена ниже средней за 12 мес.) и у металла ≥ n−3 маркеров вершины → продать 20%",
               "после месяца с продажей ≥ 20% следующие 24 месяца взнос не покупается, а копится в резерв (если не началась серия докупок)",
               "иначе — обычный взнос; исполнение — по средней цене следующего месяца; резерв разумно держать в 3-месячных векселях"],
           "changes_vs_R6": ["убраны (на 1982–98 не нужны): страховка серии «4 из 8 четыре месяца» (ровно 0) и «продажи ×1,3 после роста ×2,5» (поверх затяжного перегрева +2,5 < порога +4)",
                             "добавлено: остывание после продажи (круг 5; 1982–98 +18 к Q1, 8/8; 1999–2026 к Q1 ≈ 0)"],
           "rejected": "тёплая ступень перегрева (+177 на 1982–98, вето −34%), она же с макро- и трендовыми фильтрами (вето −25%), общий резерв (+6% / −4,8%), парабола (вето −34% серебро), усреднение вниз, вторая ступень пузыря, упорство вершины, хвост серии, ширина дна/вершины; пороги по 1982–98",
           "results_vs_dca": {T.NAME[k]: {"base_v1": rnd(B, k), "R3": rnd(R3, k), "R6": rnd(R6, k), "Q2": rnd(Q, k)} for k in keys},
           "vs_R3": {"h2": {x: round(v, 1) if isinstance(v, float) else v for x, v in s3["h2"].items() if x != "by"},
                     "after": {x: round(v, 1) if isinstance(v, float) else v for x, v in s3["after"].items() if x != "by"}},
           "proximity": {"1982-98": T.agg(Q), "1999-2026": T.agg(Q, which="prox_after"), "exam_1999-2026": T.agg(Q, T.EXAM, "prox_after")},
           "signals_now": now,
           "journal": "research/metals_agent3_journal.md"}
    json.dump(clean(out), open(os.path.join(HERE, "found", "metals-agent3-best.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, "item") else float(o))
    mg = {k: v for k, v in m6.items() if k not in ("results_vs_dca", "checks", "strategy")}
    mg.update({"strategy": "found/metals-agent3-best.json (Q2, агент 3)",
               "recommended": "заём 0,5× при ставке ФРС < 3%; шорт — необязательно (на 1982–98 польза не видна: −0,1; после 1999 +7% к медиане)",
               "checks": {"runs_since_1982": tot["runs"], "liquidations": tot["liq"], "min_collateral_level": round(tot["worst"], 2),
                          "min_collateral_level_stress": round(tot["worst_st"], 2), "liquidations_with_short": tos["liq"],
                          "after_vs_Q2_median_pct": round(sa_m["med"], 1), "after_vs_Q2_median_with_short_pct": round(ss_m["med"], 1),
                          "loan_0_75x_liquidations": 31},
               "results_vs_dca_loan": {A.NAME[k]: {p: round(MR[k][p], 1) for p in ("h2", "after", "from82") if p in MR[k]} for k in keys},
               "results_vs_dca_loan_short": {A.NAME[k]: {p: round(MS[k][p], 1) for p in ("h2", "after", "from82") if p in MS[k]} for k in keys}})
    json.dump(clean(mg), open(os.path.join(HERE, "found", "metals-agent3-best-margin.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, "item") else float(o))
    pm = {"note": "Агент 3: Q2 по каждому металлу против R3 и R6 (итог к DCA, %: 1982–98 / 1999–2026 / вся история), вклад частей Q2, метрики близости. "
                  "Индивидуальные версии не подбирались (прошлые агенты: переобучение); здесь — разбор общей Q2 по металлам.",
          "metals": {k: {"name": T.NAME[k], "exam": k in T.EXAM, "R3": rnd(R3, k), "R6": rnd(R6, k), "Q2": rnd(Q, k),
                         "contrib": {nm: {"h2": v[k][0], "after": v[k][1]} for nm, v in contrib.items()},
                         "prox_h2": {x: y for x, y in Q[k].get("prox_h2", {}).items() if x != "missed"},
                         "prox_after": {x: y for x, y in Q[k]["prox_after"].items() if x != "missed"},
                         "missed_tops": [str(D[k]["t"][i])[:7] for i in Q[k]["prox_full"]["missed"]]} for k in keys}}
    json.dump(clean(pm), open(os.path.join(HERE, "found", "metals-agent3-per-metal.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1, default=lambda o: o.item() if hasattr(o, "item") else float(o))
    print("\nсохранено: found/metals-agent3-best.json, found/metals-agent3-best-margin.json, found/metals-agent3-per-metal.json")


if __name__ == "__main__":
    main()
