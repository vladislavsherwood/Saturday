"""Круг 5: свой набор маркеров для каждого металла. Основа сравнения — R2.
H5a — устойчивы ли «личные» маркеры: для каждого металла AUC каждого признака для зоны вершины и зоны дна (зоны — как в metals_long)
      до 1999 и после 1999; связь «до» и «после» по признакам у каждого металла.
H5b — индивидуальный набор: для каждого металла одна замена (убрать один из 14 маркеров или добавить один из 22 запасных признаков,
      пороги 80/20 общие), выбранная по ЕГО итогу до 1999 (выигрыш ≥ 3%); пороги счёта масштабируются: продажи при n−2 / n−1 из n
      маркеров вершины, серия докупок при n−3 из n маркеров дна (держится при n−4). Проверка — после 1999. Олово — подбор по его 1965–1998.
H5c — то же для группы (драгоценные / промышленные): замена выбирается по сумме по группе до 1999.
Запуск: python3 app/metals_agent_loop5.py"""
import numpy as np
import pandas as pd

import metals_agent_lib as L
import metals_long as ml
from metals_monthly import BOT, TOP

EXTRA = ["Цена к средней за 10 лет", "Изменение за 3 года, %", "Рост от минимума за 5 лет, раз", "До исторического максимума, %",
         "Реальная цена (с поправкой на инфляцию) к средней за 20 лет", "Инфляция за год, %", "Ставка ФРС, %", "Реальная ставка ФРС (ставка минус инфляция), %",
         "Отклонение реальной ставки от нейтральной r*, п.п.", "Реальная доходность 10 лет (минус инфляция), %", "Безработица: изменение за год, п.п.",
         "Акции: изменение за год, %", "Акции: до максимума, %", "Акции к золоту: соотношение к средней за 10 лет", "Золото к нефти: соотношение к средней за 10 лет",
         "Медь к золоту: соотношение к средней за 3 года", "Металл к золоту: соотношение к средней за 3 года", "Связь металла с акциями (корреляция за 3 года)",
         "Связь акций и облигаций (корреляция за 3 года)", "Нефть: изменение за год, %", "Доллар к средней за 5 лет", "Золото к серебру: уровень"]
GROUPS = {"драг": ["gold", "silver", "platinum"], "пром": ["copper", "aluminum", "nickel", "lead", "zinc"]}


def zones(d):
    c = d["c"]
    pv = ml.pivots(c, d["factor"])
    top = np.zeros(len(c), bool); bot = np.zeros(len(c), bool)
    for i, s in pv:
        seg = np.arange(max(0, i - 6), min(len(c), i + 7))
        if s > 0:
            top[seg[c[seg] >= c[i] / (1 + (d["factor"] - 1) * 0.25)]] = True
        else:
            bot[seg[c[seg] <= c[i] * (1 + (d["factor"] - 1) * 0.25)]] = True
    return top, bot


def auc(x, y, mn=8):
    m = np.isfinite(x)
    x, y = x[m], y[m]
    n1, n0 = y.sum(), (~y).sum()
    if n1 < mn or n0 < mn:
        return np.nan
    rk = pd.Series(x).rank().values
    return (rk[y].sum() - n1 * (n1 + 1) / 2) / (n1 * n0)


def plan_sets(top, bot, thr):
    def f(d):
        tn, bn = L.count(d, thr, top), L.count(d, thr, bot)
        nt, nb = len(top), len(bot)
        return L.plan_generic(d, tn, bn, k_on=nb - 3, k_hold=nb - 4, k5=nt - 2, k6=nt - 1)
    return f


def changes():
    out = [("—", TOP, BOT)]
    for j, m in enumerate(TOP):
        out.append((f"вершина без «{m[0]}»", TOP[:j] + TOP[j + 1:], BOT))
    for j, m in enumerate(BOT):
        out.append((f"дно без «{m[0]}»", TOP, BOT[:j] + BOT[j + 1:]))
    for f in EXTRA:
        for dr in ("hi", "lo"):
            if (f, dr) not in TOP:
                out.append((f"вершина + «{f}» {'высоко' if dr == 'hi' else 'низко'}", TOP + [(f, dr)], BOT))
            if (f, dr) not in BOT:
                out.append((f"дно + «{f}» {'высоко' if dr == 'hi' else 'низко'}", TOP, BOT + [(f, dr)]))
    return out


def main():
    D = L.load()
    keys = L.SEL + ["tin"]
    R2 = L.run(D, L.r2_plan)
    # общие пороги 80/20 для всех признаков по 8 металлам до 1999
    thr = dict(D["_thr"])
    for f in EXTRA:
        for dr in ("hi", "lo"):
            if (f, dr) not in thr:
                thr[(f, dr)] = L.pooled(D, f, 0.8 if dr == "hi" else 0.2)
    chk = plan_sets(TOP, BOT, thr)
    assert all(abs(L.edges(D[k], chk(D[k]))["full"] - R2[k]["full"]) < 1e-9 for k in keys)

    # H5a — устойчивость AUC по металлам
    print("=== H5a: AUC маркеров основы по металлам, до 1999 / после 1999 (вершина: >0,5 — признак выше в зоне вершины; дно — так же для зоны дна) ===")
    feats = [f for f in D["gold"]["F"].columns]
    for side, marks in (("вершина", TOP), ("дно", BOT)):
        print(f"\n{side}: " + " | ".join(m[0][:28] for m in marks))
        for k in keys + ["palladium"]:
            d = D[k]
            zt, zb = zones(d)
            y = zt if side == "вершина" else zb
            m = d["m"]
            vals = []
            for f, dr in marks:
                x = d["F"][f].values
                a1, a2 = auc(x[:m], y[:m]), auc(x[m:], y[m:])
                if dr == "lo":
                    a1, a2 = 1 - a1, 1 - a2
                vals.append(f"{a1:.2f}/{a2:.2f}")
            print(f"  {L.NAME[k]:9} " + "  ".join(vals))
    print("\nсвязь AUC до и после 1999 по всем признакам (корреляция; 1 — личный профиль металла устойчив, 0 — шум):")
    pool_pre = {s: [] for s in ("top", "bot")}
    for k in keys:
        d = D[k]
        zt, zb = zones(d)
        m = d["m"]
        line = []
        for s, y in (("top", zt), ("bot", zb)):
            a1 = np.array([auc(d["F"][f].values[:m], y[:m]) for f in feats])
            a2 = np.array([auc(d["F"][f].values[m:], y[m:]) for f in feats])
            ok = np.isfinite(a1) & np.isfinite(a2)
            line.append(f"{'вершина' if s == 'top' else 'дно'} {np.corrcoef(a1[ok], a2[ok])[0, 1]:+.2f}")
            pool_pre[s].append(a1)
        print(f"  {L.NAME[k]}: " + ", ".join(line))
    # связь личного AUC металла с общим (средним по остальным): если личный профиль ≈ общий, индивидуальный набор не нужен
    print("связь AUC металла до 1999 с AUC остальных металлов до 1999 (средний):")
    for s in ("top", "bot"):
        A = np.array(pool_pre[s])
        print(f"  {'вершина' if s == 'top' else 'дно'}: " + ", ".join(
            f"{L.NAME[k]} {np.corrcoef(np.nan_to_num(A[i], nan=0.5), np.nan_to_num(np.nanmean(np.delete(A, i, 0), 0), nan=0.5))[0, 1]:+.2f}" for i, k in enumerate(keys)))

    # H5b — одна индивидуальная замена на металл, выбор по его итогу до 1999
    CH = changes()
    print(f"\n=== H5b: одна индивидуальная замена маркера для каждого металла ({len(CH) - 1} вариантов), выбор по итогу до 1999 ===")
    res = {}
    for k in keys:
        d = D[k]
        base = R2[k]
        rows = []
        for name, top, bot in CH:
            e = L.edges(d, plan_sets(top, bot, thr)(d))
            rows.append((L.rel(e["before"], base["before"]), L.rel(e["after"], base["after"]), L.rel(e["full"], base["full"]), name))
        rows.sort(key=lambda r: -r[0])
        best = rows[0] if rows[0][0] >= 3 else (0.0, 0.0, 0.0, "—")
        res[k] = (best, rows)
        good = [r for r in rows if r[0] >= 3]
        corr = np.corrcoef([r[0] for r in rows], [r[1] for r in rows])[0, 1]
        print(f"  {L.NAME[k]}: выбрано «{best[3]}» до 1999 {best[0]:+.1f}% → после 1999 {best[1]:+.1f}%, вся {best[2]:+.1f}% | вариантов с выигрышем ≥3% до 1999: {len(good)}, "
              f"из них после 1999 не хуже: {sum(r[1] >= -0.5 for r in good)}; связь до/после по всем заменам {corr:+.2f}")
        for r in rows[1:4]:
            print(f"      далее: «{r[3]}» {r[0]:+.1f} → {r[1]:+.1f}")
    sel = [res[k][0] for k in L.SEL]
    print(f"  итог по 8 металлам: изменено {sum(b[3] != '—' for b in sel)}, после 1999 лучше {sum(b[1] > 0.5 for b in sel)}, хуже {sum(b[1] < -0.5 for b in sel)}; "
          f"медиана после 1999 {np.median([b[1] for b in sel]):+.1f}%, сумма лог-разниц {np.log1p(np.array([b[1] for b in sel]) / 100).sum() * 100:+.0f}")

    # H5c — замена по группе
    print("\n=== H5c: одна замена для группы, выбор по сумме лог-разниц группы до 1999 ===")
    for g, ks in GROUPS.items():
        rows = []
        for name, top, bot in CH:
            fn = plan_sets(top, bot, thr)
            e = {k: L.edges(D[k], fn(D[k])) for k in ks}
            b = np.array([L.rel(e[k]["before"], R2[k]["before"]) for k in ks]); a = np.array([L.rel(e[k]["after"], R2[k]["after"]) for k in ks])
            rows.append((np.log1p(b / 100).sum() * 100, np.log1p(a / 100).sum() * 100, b.min(), a.min(), name, b, a))
        rows.sort(key=lambda r: -r[0])
        for r in rows[:4]:
            print(f"  {g}: «{r[4]}» до 1999 сумма {r[0]:+.0f} (худший {r[2]:+.1f}), после {r[1]:+.0f} (худший {r[3]:+.1f}) | по металлам до/после: "
                  + ", ".join(f"{L.NAME[k]} {x:+.0f}/{y:+.0f}" for k, x, y in zip(ks, r[5], r[6])))
        good = [r for r in rows if r[0] > 5 and r[2] > -1]
        print(f"  {g}: замен с выигрышем до 1999 (> +5, никто не хуже −1): {len(good)}, после 1999 сумма > 0 у {sum(r[1] > 0 for r in good)}")


if __name__ == "__main__":
    main()


def plateau():
    """Часть Б: плато для двух групповых кандидатов — порог нового маркера вершины (процентиль по 8 металлам до 1999)."""
    D = L.load()
    R2 = L.run(D, L.r2_plan)
    base = dict(D["_thr"])
    for f, ks_name in (("Цена к средней за 10 лет", "пром"), ("Золото к нефти: соотношение к средней за 10 лет", "драг")):
        print(f"\n=== вершина + «{f}» высоко: по группе «{ks_name}» и по всем 8 металлам (разница к R2 до / после по металлам) ===")
        for q in (0.7, 0.75, 0.8, 0.85, 0.9):
            thr = dict(base)
            thr[(f, "hi")] = L.pooled(D, f, q)
            fn = plan_sets(TOP + [(f, "hi")], BOT, thr)
            out = []
            for k in L.SEL + ["tin"]:
                e = L.edges(D[k], fn(D[k]))
                out.append((k, L.rel(e["before"], R2[k]["before"]), L.rel(e["after"], R2[k]["after"])))
            g = [x for x in out if x[0] in GROUPS[ks_name]]
            a8 = [x for x in out if x[0] in L.SEL]
            print(f"  q{int(q * 100)} (> {thr[(f, 'hi')]:.2f}): группа до {np.median([x[1] for x in g]):+.1f} (худш. {min(x[1] for x in g):+.1f}), после {np.median([x[2] for x in g]):+.1f} (худш. {min(x[2] for x in g):+.1f}); "
                  f"все 8: до {np.median([x[1] for x in a8]):+.1f} (не хуже {sum(x[1] >= -0.5 for x in a8)}), после {np.median([x[2] for x in a8]):+.1f} (не хуже {sum(x[2] >= -0.5 for x in a8)}) | "
                  + ", ".join(f"{L.NAME[k]} {b:+.0f}/{a:+.0f}" for k, b, a in out))


if __name__ == "__main__":
    plateau()
