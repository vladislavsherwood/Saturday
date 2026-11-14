"""Круг 18: каждый металл по отдельности — особенности цены, вклад частей R6 по металлам, индивидуальный выбор версии по своей истории до 1999.
Сохраняет found/metals-agent2-per-metal.json (обновляется в круге 20). Запуск: python3 app/metals_agent2_loop18.py"""
import json
import os

import numpy as np
import pandas as pd

import metals_agent2_lib as A
import metals_agent_lib as L

HERE = os.path.dirname(os.path.abspath(__file__))
R6 = A.VERS["R6"]
OPTS = {"R3": {}, "R5": A.VERS["R5"], "R6": R6, "R6 без ×1,3 после роста": {**R6, "rise_h": 0.0}, "R6 без затяжного перегрева": {**R6, "hot2": 0.0},
        "R6 без растягивания серии": {**R6, "g": 1.0}}


def traits(D, k):
    d = D[k]
    c, t, m = d["c"], d["t"], d["m"]
    lr = np.diff(np.log(c))
    out = {"vol_before": float(np.std(lr[: m - 1]) * np.sqrt(12) * 100) if m > 24 else None, "vol_after": float(np.std(lr[m:]) * np.sqrt(12) * 100)}
    pv = d["pv"]
    tops = [i for i, s in pv if s > 0]
    bots = [i for i, s in pv if s < 0]
    amp = [c[i] / c[j] for i in tops for j in [max([b for b in bots if b < i], default=None)] if j is not None]
    out["major_tops"], out["major_bottoms"] = len(tops), len(bots)
    out["median_rise_bottom_to_top"] = float(np.median(amp)) if amp else None
    dur = [i - j for i in tops for j in [max([b for b in bots if b < i], default=None)] if j is not None]
    out["median_months_bottom_to_top"] = float(np.median(dur)) if dur else None
    X = D["_X"]
    s = pd.Series(c, index=t)
    for ref in ("gold", "copper"):
        if ref == k:
            continue
        r = pd.Series(D[ref]["c"], index=D[ref]["t"])
        j = pd.concat([np.log(s).diff(), np.log(r).diff()], axis=1).dropna()
        out[f"corr_{ref}_before"] = float(j[j.index < "1999-01-01"].corr().iloc[0, 1]) if (j.index < "1999-01-01").sum() > 24 else None
        out[f"corr_{ref}_after"] = float(j[j.index >= "1999-01-01"].corr().iloc[0, 1])
    return out


def main():
    D = A.load()
    RV = {nm: A.evaluate(D, (lambda kw: lambda d: A.r3(d, **kw))(kw)) for nm, kw in OPTS.items()}
    print("=== Особенности металлов (годовая волатильность до/после 1999; крупных вершин; медианный рост дно→вершина и месяцев; корреляция мес. изменений с золотом и медью до/после) ===")
    TR = {}
    for k in A.metals(D):
        tr = traits(D, k)
        TR[k] = tr
        f = lambda x, p="{:.0f}": "—" if x is None else p.format(x)   # noqa: E731
        print(f"  {A.NAME[k]:9}: волатильность {f(tr['vol_before'])}/{f(tr['vol_after'])}%, вершин {tr['major_tops']}, рост ×{f(tr['median_rise_bottom_to_top'], '{:.1f}')} за {f(tr['median_months_bottom_to_top'])} мес.; "
              f"корр. с золотом {f(tr.get('corr_gold_before'), '{:.2f}')}/{f(tr.get('corr_gold_after'), '{:.2f}')}, с медью {f(tr.get('corr_copper_before'), '{:.2f}')}/{f(tr.get('corr_copper_after'), '{:.2f}')}")
    print("\n=== Вклад частей R6 по металлам (до 1999 / после 1999, разница итога к R6, %; отрицательное — часть полезна) ===")
    for nm in OPTS:
        if nm == "R6":
            continue
        s = A.cmp(RV[nm], RV["R6"], keys=A.metals(D))
        print(f"  {nm}: " + ", ".join(f"{A.NAME[k][:4]} {('—' if k not in s['before']['by'] else format(s['before']['by'][k], '+.1f'))}/{s['after']['by'][k]:+.1f}" for k in A.metals(D)))
    # индивидуальный выбор по своей истории до 1999 (олово — тоже; палладий — R6)
    pick = {}
    for k in A.SEL + ["tin"]:
        pick[k] = max(OPTS, key=lambda nm: RV[nm][k]["before"])
    pick["palladium"] = "R6"
    better = [k for k in A.SEL if RV[pick[k]][k]["after"] >= RV["R6"][k]["after"] + 0.5 * (1 + RV["R6"][k]["after"] / 100)]
    print("\n=== Индивидуальный выбор версии по своей истории до 1999 ===")
    for k in A.metals(D):
        nm = pick[k]
        print(f"  {A.NAME[k]:9}: {nm:28} до {RV[nm][k]['before']:+5.0f} (R6 {RV['R6'][k]['before']:+5.0f}) | после {RV[nm][k]['after']:+5.0f} (R6 {RV['R6'][k]['after']:+5.0f}) | вся {RV[nm][k]['full']:+5.0f} (R6 {RV['R6'][k]['full']:+5.0f})")
    worse = [k for k in A.SEL if A.rel(RV[pick[k]][k]["after"], RV["R6"][k]["after"]) < -0.5]
    print(f"\nпосле 1999 индивидуальный выбор лучше R6 на {len(better)}/8, хуже на {len(worse)}/8 ({', '.join(A.NAME[k] for k in worse)}) → "
          f"{'индивидуальные версии полезны' if len(better) >= 5 else 'индивидуальные версии НЕ рекомендуются'}")
    # метрики близости по металлам (R6)
    print("\n=== Метрики близости R6 по металлам (вся история) ===")
    for k in A.metals(D):
        pr = RV["R6"][k]["prox"]
        print(f"  {A.NAME[k]:9}: докупки выше мин. {pr['above']:.0f}%, в зоне {pr['zone']:.0f}%, доньев с докупкой {pr['b1']}/{pr['bots']} (≥2 мес. {pr['b2']}), "
              f"продажи {pr['sell_top']:.0f}% от макс., пропущено вершин {pr['miss']}/{pr['tops']} ({', '.join(f'{D[k][chr(116)][i]:%Y-%m}' for i in pr['missed'])})")
    rnd = lambda R, k: {p: (None if not np.isfinite(R[k][p]) else round(float(R[k][p]), 1)) for p in ("before", "after", "full")}   # noqa: E731
    per = {"note": "Второй агент, круг 18 (обновляется в круге 20). Особенности каждого металла, вклад частей R6 по металлам и индивидуальный выбор версии "
                   "по своей истории до 1999 (олово — по 1965–1998, палладий — общая R6, истории до 1999 нет). Итог к DCA, %: до 1999 / после 1999 / вся история.",
           "individual_verdict": (f"индивидуальный выбор после 1999 лучше R6 на {len(better)}/8, хуже на {len(worse)}/8 — "
                                  + ("полезен" if len(better) >= 5 else "не рекомендуется; рекомендуем общую версию R6 (агент 2)")),
           "metals": {}}
    for k in A.metals(D):
        per["metals"][k] = {"name": A.NAME[k], "group": "драгоценные" if A.GROUP[k] == "prec" else "промышленные", "exam": k in A.EXAM,
                            "traits": {kk: (round(v, 2) if isinstance(v, float) else v) for kk, v in TR[k].items()},
                            "versions": {nm: rnd(RV[nm], k) for nm in OPTS},
                            "individual_pick_by_own_history_before_1999": pick[k],
                            "proximity_R6": {kk: (round(v, 1) if isinstance(v, float) else v) for kk, v in RV["R6"][k]["prox"].items() if kk != "missed"},
                            "missed_tops_R6": [f"{D[k]['t'][i]:%Y-%m}" for i in RV["R6"][k]["prox"]["missed"]]}
    json.dump(per, open(os.path.join(HERE, "found", "metals-agent2-per-metal.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1,
              default=lambda o: int(o) if isinstance(o, np.integer) else float(o))
    print("\nсохранено: found/metals-agent2-per-metal.json")


if __name__ == "__main__":
    main()
