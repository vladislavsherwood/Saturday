"""Круг 1 mb: диагностика покупок Q2 (месячная, вся история) и Q2д (дневная, 2000–26).
H1a: Q2 покупает рано (цена докупок выше минимума эпизода ≥ 10%, ≥ 50% денег до минимума). H1b: дневная — «рано» ≥ 10%, но к DCA резерва ≤ 0
у ≥ 3/4. H1c: пропуски доньев — в основном нет серии. Запуск: python3 app/mb_r1.py"""
import json
import os

import numpy as np

import mb_lib as B
import metals_agent_lib as L


def main():
    B.tee("r1.txt")
    D, DD, MM = B.load()
    out = {"monthly": {}, "daily": {}}
    print("=== МЕСЯЧНАЯ МОДЕЛЬ: Q2, вся история (старт с начала ряда), эпизоды докупок резерва ===")
    print("металл | начало–конец серии | денег из резерва, $ | средняя цена | минимум эпизода (дата) | цена выше мин. | старт выше мин. | мес. до мин. | денег до мин. | к DCA резерва 24 мес.")
    agg = {"pre": [], "post": []}
    for k in B.ALLM:
        d = D[k]
        c = d["c"]
        n = len(c)
        p = B.Q2M(d)
        _, bx, _ = L.sim(c, p, 0, n, 0, np.zeros(n))
        P = B.precision(c, bx, d["t"], 0, n, 12, 24, 3)
        out["monthly"][k] = P
        for e in P["eps"]:
            per = "pre" if e["start"].year < 1999 else "post"
            if k in B.A.SEL:
                agg[per].append(e)
            print(f"  {B.NAME[k]:9s} {str(e['start'])[:7]}–{str(e['end'])[:7]} | {e['money']:8.0f} | {e['avg']:9.1f} | {e['low']:9.1f} ({str(e['low_t'])[:7]}) | "
                  f"{e['above_low']:+5.0f}% | {e['start_above_low']:+5.0f}% | {e['steps_to_low']:+3d} | {e['before_low']:4.0f}% | {e['vsdca']:+5.0f}%")
        print(f"  {B.NAME[k]}: рано (к мин. 12 мес. вперёд) {P['early']:.1f}%, к DCA резерва {P['vsdca']:+.1f}%, выше мин. эпизода {P.get('above_low', np.nan):.1f}%, до мин. {P.get('before_low', np.nan):.0f}% денег")
    for per, eps in agg.items():
        w = np.array([e["money"] for e in eps])
        f = lambda key: float((w * np.array([e[key] for e in eps])).sum() / w.sum())  # noqa: E731
        print(f"\n  8 металлов отбора, серии {'до' if per == 'pre' else 'после'} 1999 ({len(eps)} эпизодов): выше мин. эпизода {f('above_low'):.1f}%, "
              f"старт серии выше мин. {f('start_above_low'):.1f}%, до мин. потрачено {f('before_low'):.0f}% денег, к DCA резерва {f('vsdca'):+.1f}%, "
              f"мес. от старта до мин. — медиана {np.median([e['steps_to_low'] for e in eps]):.0f}")
    eps = agg["pre"] + agg["post"]
    w = np.array([e["money"] for e in eps])
    above = float((w * np.array([e["above_low"] for e in eps])).sum() / w.sum())
    before = float((w * np.array([e["before_low"] for e in eps])).sum() / w.sum())
    h1a = above >= 10 and before >= 50
    print(f"\n  H1a (все серии, 8 металлов): выше мин. {above:.1f}%, до мин. {before:.0f}% денег → {'подтверждена' if h1a else 'не подтверждена'}")
    # распределение «месяцев от старта серии до минимума»
    st = np.array([e["steps_to_low"] for e in eps])
    print(f"  мес. от старта серии до минимума эпизода: {np.percentile(st, [10, 25, 50, 75, 90])} (отрицательные — минимум был ДО старта серии)")
    print(f"  доля эпизодов, где минимум до старта серии: {(st < 0).mean() * 100:.0f}%; в первые 3 мес.: {((st >= 0) & (st <= 3)).mean() * 100:.0f}%; позже 6 мес.: {(st > 6).mean() * 100:.0f}%")

    # пропущенные доньи
    print("\n=== ПРОПУЩЕННЫЕ КРУПНЫЕ ДОНЬЯ (месячная, 8 металлов, вся история) ===")
    miss_nos = miss_nores = miss_late = hit = 0
    for k in B.A.SEL:
        d = D[k]
        c = d["c"]
        n = len(c)
        p = B.Q2M(d)
        _, bx, _ = L.sim(c, p, 0, n, 0, np.zeros(n))
        for i, s in d["pv"]:
            if s >= 0:
                continue
            j = np.arange(max(0, i - 12), min(n, i + 13))
            if ((bx[j] > 0) & (c[j] <= c[i] * 1.25)).any():
                hit += 1
                continue
            ser = (p[np.clip(j - 1, 0, n - 1)] > 1).any()
            if not ser:
                miss_nos += 1; why = "нет серии"
            elif (bx[j] > 0).any():
                miss_late += 1; why = "серия была, куплено выше +25% от дна"
            else:
                miss_nores += 1; why = "серия была, резерва не было"
            print(f"  {B.NAME[k]} {str(d['t'][i])[:7]} дно {c[i]:.1f}: {why}; маркеров дна (макс. ±12 мес.) {d['bn3'][j].max()}")
    tot = miss_nos + miss_nores + miss_late
    print(f"  доньев {hit + tot}: с докупкой {hit}; пропущено {tot}: нет серии {miss_nos}, пустой резерв {miss_nores}, куплено выше +25% {miss_late}")
    h1c = tot > 0 and miss_nos / tot > 0.5
    print(f"  H1c: доля «нет серии» {miss_nos / max(tot, 1) * 100:.0f}% → {'подтверждена' if h1c else 'не подтверждена'}")

    print("\n=== ДНЕВНАЯ МОДЕЛЬ: Q2д, 2000-09…2026-11 (весь отрезок, старт с нуля) ===")
    q2d = lambda X: B.q2d(D, X)  # noqa: E731
    nb = 0
    early = []
    for k in B.DSEL + B.DEXAM:
        X = MM[k]
        p = q2d(X)
        r = X.run(p, "full")
        P = B.precision(X.c, r[1], X.t, 0, X.n, 252, 504, 63)
        out["daily"][k] = P
        if k in B.DSEL:
            early.append((P["money"], P["early"]))
            nb += P["vsdca"] <= 0
        print(f"  {B.NAME[k]}: денег из резерва ${P['money']:.0f}; рано {P['early']:.1f}%; к DCA резерва 24 мес. {P['vsdca']:+.1f}%; выше мин. эпизода {P.get('above_low', np.nan):.1f}%; до мин. {P.get('before_low', np.nan):.0f}%")
        for e in P["eps"]:
            print(f"     {str(e['start'])[:10]}–{str(e['end'])[:10]}: ${e['money']:.0f}, средняя {e['avg']:.2f}, мин. {e['low']:.2f} ({str(e['low_t'])[:10]}), "
                  f"выше мин. {e['above_low']:+.0f}%, старт выше мин. {e['start_above_low']:+.0f}%, дней до мин. {e['steps_to_low']}, до мин. {e['before_low']:.0f}% денег, к DCA рез. {e['vsdca']:+.0f}%")
    w = np.array([a for a, _ in early])
    ea = float((w * np.array([b for _, b in early])).sum() / w.sum())
    h1b = ea >= 10 and nb >= 3
    print(f"  H1b: рано (агрегат 4 металлов) {ea:.1f}%, к DCA резерва ≤ 0 у {nb}/4 → {'подтверждена' if h1b else 'не подтверждена'}")

    # идеал: что дало бы «весь резерв серии по минимуму эпизода» — верхняя граница выигрыша от точности
    print("\n=== ВЕРХНЯЯ ГРАНИЦА: те же деньги из резерва, но по минимуму эпизода (дневная, к Q2д, итог к DCA) ===")
    for k in B.DSEL + B.DEXAM:
        X = MM[k]
        p = q2d(X)
        base = X.run(p, "full")
        P = out["daily"][k]
        # прибавка монет: деньги/мин − деньги/средняя → в долях итога
        gain_units = sum(e["money"] * (1 / e["low"] - 1 / e["avg"]) for e in P["eps"])
        fin = base[4] * X.c[-1] + base[3]
        print(f"  {B.NAME[k]}: итог к DCA {base[0]:+.1f}% → с покупками по минимуму {((fin + gain_units * X.c[-1] * 0.999) / fin * (1 + base[0] / 100) - 1) * 100:+.1f}%")
    json.dump(B.clean(out), open(os.path.join(B.LOGDIR, "r1.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
