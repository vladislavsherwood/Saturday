"""Круг 9: осторожные шорты на вершинах. Основа — R3 (без плеча).
Модель (`sim_short`): шорт того же металла на долю f капитала счёта при сигнале вершины; плата за заём — ставка ФРС + 2% годовых;
деньги от продажи без дохода; комиссия 0,1% на вход и выход; ликвидация, если (монеты + деньги) / (шорт по максимуму месяца) ≤ 1,1
(максимум — из дневных закрытий ×1,03 или из средней и полусумм с соседями +10%); стресс — максимум ещё ×1,2 и ×1,3.
H9a — вход: сильный сигнал вершины (≥ n−1 маркеров) / перегрев цены / любой из них; выход: начало серии докупок (дно), срок T,
      фиксация прибыли при падении на tp.
H9b — вход только при «вершина подтверждена»: сигнал вершины за 6 мес. и цена ниже средней за 12 мес.
Запуск: python3 app/metals_agent_loop9.py"""
import itertools

import numpy as np

import metals_agent_lib as L


def signals(D, thr):
    from metals_agent_loop7 import F10, GO, GROUP, II
    from metals_monthly import BOT, TOP
    for k in L.metals(D):
        d = D[k]
        top, bot = list(TOP), list(BOT) + [(II, "lo")]
        if GROUP[k] == "ind":
            top.append((F10, "hi"))
        elif k in ("gold", "silver"):
            top.append((GO, "hi"))
        tn, bn = L.count(d, thr, top), L.count(d, thr, bot)
        hot = (np.nan_to_num(d["F"][L.P3].values) > 1.81) & (np.nan_to_num(d["F"][L.Y1].values) > 86)
        d["_strong"] = tn >= len(top) - 1
        d["_hot"] = hot
        d["_ep"] = L.episode(bn, len(bot) - 3, len(bot) - 4)
        c = d["c"]
        m12 = np.array([c[max(0, i - 11): i + 1].mean() for i in range(len(c))])
        sig6 = np.array([(d["_strong"] | hot)[max(0, i - 5): i + 1].any() for i in range(len(c))])
        d["_conf"] = sig6 & (c < m12) & ~d["_ep"]


def run(D, plans, entry, f, T, tp, stress=1.0, lag=0, starts=False):
    res = {"rel": {}, "liq": 0, "n": 0, "pnl": [], "rs": []}
    for k, plan in plans.items():
        d = D[k]
        c, hi, ff, n, m = d["c"], d["hi"], d["ff"], len(d["c"]), d["m"]
        ent = {"strong": d["_strong"], "hot": d["_hot"], "any": d["_strong"] | d["_hot"], "conf": d["_conf"]}[entry]
        ext = d["_ep"].copy()
        no = np.zeros(n, bool)
        res["rel"][k] = {}
        segs = [("before", 0, m), ("after", m, n), ("full", 0, n)] if m > 24 else [("after", m, n), ("full", 0, n)]
        for nm, a0, a1 in segs:
            e0 = L.sim_short(c, hi, plan, no, ext, ff, a0, a1, f, T, tp, 1.0, 2.0, 1.1, lag)[0]
            e, lq, ns, pnl = L.sim_short(c, hi, plan, ent, ext, ff, a0, a1, f, T, tp, stress, 2.0, 1.1, lag)
            res["rel"][k][nm] = L.rel(e, e0)
            res["liq"] += lq
            if nm == "full":
                res["n"] += ns; res["pnl"].append(pnl)
        if starts:
            for y in range(1966, 2017):
                a0 = int(np.searchsorted(d["t"].values, np.datetime64(f"{y}-01-01")))
                if (a0 <= 0 and y > d["t"][0].year) or a0 >= n - 60:
                    continue
                e0 = L.sim_short(c, hi, plan, no, ext, ff, a0, n, f, T, tp, 1.0, 2.0, 1.1, lag)[0]
                e, lq, _, _ = L.sim_short(c, hi, plan, ent, ext, ff, a0, n, f, T, tp, stress, 2.0, 1.1, lag)
                res["rs"].append(L.rel(e, e0)); res["liq"] += lq
    return res


def main():
    D = L.load()
    r3, thr = L.r3_setup(D)
    signals(D, thr)
    plans = {k: r3(D[k]) for k in L.metals(D)}
    for k in L.metals(D):
        d = D[k]
        e0 = L.sim_short(d["c"], d["hi"], plans[k], np.zeros(len(d["c"]), bool), d["_ep"], d["ff"], 0, len(d["c"]), 0.1, 12, 0.0, 1.0, 2.0, 1.1, 0)[0]
        assert abs(e0 - L.edges(d, plans[k])["full"]) < 1e-6, k
    print("без шорта совпадает с обычной моделью; сигналов входа на 8 металлах (мес.): сильная вершина "
          f"{sum(int(D[k]['_strong'].sum()) for k in L.SEL)}, перегрев {sum(int(D[k]['_hot'].sum()) for k in L.SEL)}, подтверждённая вершина {sum(int(D[k]['_conf'].sum()) for k in L.SEL)}")
    rows = []
    for entry, f, T, tp in itertools.product(("strong", "hot", "any", "conf"), (0.1, 0.2, 0.3, 0.5), (6, 12, 24), (0.0, 0.25, 0.4)):
        r = run(D, plans, entry, f, T, tp)
        sel = [r["rel"][k] for k in L.SEL]
        b = np.array([x["before"] for x in sel]); a = np.array([x["after"] for x in sel])
        rows.append({"cfg": (entry, f, T, tp), "b": b, "a": a, "liq": r["liq"], "n": r["n"], "ex": [r["rel"][k] for k in L.EXAM],
                     "sb": np.log1p(b / 100).sum() * 100, "sa": np.log1p(a / 100).sum() * 100})
    rows.sort(key=lambda x: -x["sb"])
    name = lambda c: f"вход {dict(strong='сильная вершина', hot='перегрев цены', any='сильная вершина или перегрев', conf='подтверждённая вершина')[c[0]]}, {c[1]:.0%} капитала, срок {c[2]} мес." + (f", фикс. прибыли −{c[3]:.0%}" if c[3] else "")   # noqa: E731
    print(f"\nвариантов {len(rows)}; лучшие по сумме лог-разниц к R3 до 1999 (8 металлов):")
    for x in rows[:12]:
        print(f"  {name(x['cfg'])}: до 1999 сумма {x['sb']:+.0f}, мед. {np.median(x['b']):+.1f}, худш. {x['b'].min():+.1f}, не хуже {(x['b'] >= -0.5).sum()}/8 | после сумма {x['sa']:+.0f}, "
              f"мед. {np.median(x['a']):+.1f}, худш. {x['a'].min():+.1f}, не хуже {(x['a'] >= -0.5).sum()}/8 | ликвидаций {x['liq']}, шортов {x['n']} | экзамен после: "
              + ", ".join(f"{e['after']:+.0f}" for e in x["ex"]))
    print("\nпо входу (медиана по всем вариантам с этим входом, сумма до / после):")
    for en in ("strong", "hot", "any", "conf"):
        g = [x for x in rows if x["cfg"][0] == en]
        print(f"  {en}: {np.median([x['sb'] for x in g]):+.0f} / {np.median([x['sa'] for x in g]):+.0f}; лучших до 1999 с суммой > 0: {sum(x['sb'] > 0 for x in g)}/{len(g)}, из них после > 0: {sum(x['sb'] > 0 and x['sa'] > 0 for x in g)}")
    # стресс и старты для трёх лучших
    print("\nПЛАТО для входа «сильная вершина» (сумма лог-разниц до / после; не хуже до/после из 8):")
    for f in (0.1, 0.2, 0.3, 0.5):
        print(f"  {f:.0%} капитала: " + " | ".join(f"срок {T}, tp {tp:.0%}: {x['sb']:+3.0f}/{x['sa']:+3.0f} ({(x['b'] >= -0.5).sum()}/{(x['a'] >= -0.5).sum()})"
                                                for T in (6, 12, 24) for tp in (0.0, 0.25, 0.4) for x in rows if x["cfg"] == ("strong", f, T, tp)))
    print("\nстресс, сдвиг исполнения и 510 стартов для лучших по «до 1999» (не хуже ≥ 7/8, худший ≥ −6%):")
    good = [x for x in rows if (x["b"] >= -0.5).sum() >= 7 and x["b"].min() >= -6][:5]
    good += [x for x in rows if x["cfg"] in (("strong", 0.2, 24, 0.0), ("strong", 0.3, 24, 0.0), ("strong", 0.2, 12, 0.0))]
    for x in good:
        e, f, T, tp = x["cfg"]
        s20 = run(D, plans, e, f, T, tp, stress=1.2); s30 = run(D, plans, e, f, T, tp, stress=1.3); lg = run(D, plans, e, f, T, tp, lag=1)
        st = run(D, plans, e, f, T, tp, starts=True)
        rs = np.array(st["rs"])
        print(f"  {name(x['cfg'])}: ликвидаций {x['liq']} / стресс +20% {s20['liq']} / +30% {s30['liq']} / сдвиг {lg['liq']}; "
              f"старты: мед. {np.median(rs):+.1f}, худшие 10% {np.percentile(rs, 10):+.1f}, хуже без шорта {np.mean(rs < -0.5) * 100:.0f}%; итог шортов (сумма по металлам и стартам) ${np.sum(st['pnl']):,.0f}")


if __name__ == "__main__":
    main()


def detail():
    D = L.load()
    r3, thr = L.r3_setup(D)
    signals(D, thr)
    plans = {k: r3(D[k]) for k in L.metals(D)}
    for cfg in (("strong", 0.2, 24, 0.0), ("strong", 0.3, 24, 0.0)):
        r = run(D, plans, *cfg)
        print(f"\n{cfg}: разница к R3 по металлам (до / после / вся): " + ", ".join(
            f"{L.NAME[k]} " + "/".join(f"{r['rel'][k].get(p, float('nan')):+.1f}" for p in ("before", "after", "full")) for k in L.metals(D)))
        for k in L.SEL[:3] + ["copper", "nickel"]:
            d = D[k]
            print(f"   {L.NAME[k]}: месяцы входа " + ", ".join(f"{t:%Y-%m}" for t in d["t"][d["_strong"]]))


if __name__ == "__main__":
    detail()
