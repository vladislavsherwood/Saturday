"""Круг 8: плечо на сигналах дна. Основа — R3 без плеча.
Модель (один металл — один счёт): в месяц серии докупок к покупке из резерва добавляется заём b × (сумма из резерва); проценты —
ставка ФРС + 2% годовых; долг гасится выручкой продаж, свободным резервом и взносами обычных месяцев (вместо покупки);
ликвидация, если (позиция по минимуму месяца + деньги) / долг ≤ 1,1. Минимум месяца — из дневных закрытий (×0,97 на тени),
где их нет — минимум из средней и полусумм с соседними месяцами −10%. Стресс: минимум ещё ×0,8 и ×0,7.
H8a — размер займа b = 0,25…2 на всех месяцах серии; H8b — заём только при сильном сигнале (маркеров дна ≥ n−2);
H8c — заём только в первые k месяцев серии (не наращивать долг, если дно затянулось).
Проверка: стандартные периоды (до 1999 / после / вся) и старты каждый январь с 1966 по 2016 (до конца истории) на 10 металлах.
Запуск: python3 app/metals_agent_loop8.py"""
import numpy as np

import metals_agent_lib as L


def lev_arr(d, plan, b, mode, k=None):
    ep = plan > 1.0
    lev = np.where(ep, b, 0.0)
    if mode == "strong":
        nb = d["_nb"]
        lev = np.where(ep & (d["_bn"] >= nb - 2), b, 0.0)
    elif mode == "first":
        r = L.runs(ep)
        lev = np.where(ep & (r <= k), b, 0.0)
    return lev


def evaluate(D, plans, b, mode, k=None, starts=True):
    out = {"liq": 0, "liq20": 0, "liq30": 0, "worst": 1e9, "mx": 0.0, "rel": {}, "rel_starts": [], "n_starts": 0}
    for key, plan in plans.items():
        d = D[key]
        c, lo, ff, n, m = d["c"], d["lo"], d["ff"], len(d["c"]), d["m"]
        lev = lev_arr(d, plan, b, mode, k)
        zero = np.zeros(n)
        segs = [("before", 0, m), ("after", m, n), ("full", 0, n)] if m > 24 else [("after", m, n), ("full", 0, n)]
        out["rel"][key] = {}
        for nm, a0, a1 in segs:
            e0 = L.sim_margin(c, lo, plan, zero, ff, a0, a1, 1.0, 2.0, 1.1, 0)[0]
            e, lq, w, mx = L.sim_margin(c, lo, plan, lev, ff, a0, a1, 1.0, 2.0, 1.1, 0)
            out["rel"][key][nm] = L.rel(e, e0)
            out["liq"] += lq
            out["worst"] = min(out["worst"], w); out["mx"] = max(out["mx"], mx)
            for st, f in ((0.8, "liq20"), (0.7, "liq30")):
                out[f] += L.sim_margin(c, lo, plan, lev, ff, a0, a1, st, 2.0, 1.1, 0)[1]
            out["liq"] += L.sim_margin(c, lo, plan, lev, ff, a0, a1, 1.0, 2.0, 1.1, 1)[1]
        if starts:
            for y in range(1966, 2017):
                a0 = int(np.searchsorted(d["t"].values, np.datetime64(f"{y}-01-01")))
                if a0 <= 0 and y > d["t"][0].year or a0 >= n - 60:
                    continue
                e0 = L.sim_margin(c, lo, plan, zero, ff, a0, n, 1.0, 2.0, 1.1, 0)[0]
                e, lq, w, mx = L.sim_margin(c, lo, plan, lev, ff, a0, n, 1.0, 2.0, 1.1, 0)
                out["rel_starts"].append(L.rel(e, e0)); out["liq"] += lq; out["n_starts"] += 1
                out["worst"] = min(out["worst"], w); out["mx"] = max(out["mx"], mx)
                out["liq20"] += L.sim_margin(c, lo, plan, lev, ff, a0, n, 0.8, 2.0, 1.1, 0)[1]
                out["liq30"] += L.sim_margin(c, lo, plan, lev, ff, a0, n, 0.7, 2.0, 1.1, 0)[1]
    return out


def main():
    D = L.load()
    r3, thr = L.r3_setup(D)
    from metals_agent_loop7 import II, GROUP, F10, GO
    from metals_monthly import BOT, TOP
    plans = {}
    for k in L.metals(D):
        d = D[k]
        plans[k] = r3(d)
        bot = list(BOT) + [(II, "lo")]
        d["_bn"], d["_nb"] = L.count(d, thr, bot), len(bot)
    # проверка: без займа совпадает с обычным симулятором
    for k in L.metals(D):
        d = D[k]
        e0 = L.sim_margin(d["c"], d["lo"], plans[k], np.zeros(len(d["c"])), d["ff"], 0, len(d["c"]), 1.0, 2.0, 1.1, 0)[0]
        assert abs(e0 - L.edges(d, plans[k])["full"]) < 1e-6, k
    print("без займа счёт совпадает с обычной моделью на всех 10 металлах")
    rows = []
    for mode, ks in (("all", [None]), ("strong", [None]), ("first", [2, 3, 6])):
        for k in ks:
            for b in (0.25, 0.5, 1.0, 1.5, 2.0, 3.0):
                o = evaluate(D, plans, b, mode, k)
                name = {"all": "все месяцы серии", "strong": "только сильный сигнал (дна ≥ n−2)", "first": f"первые {k} мес. серии"}[mode] + f", заём {b:g}× суммы из резерва"
                rows.append((name, o))
                sel = [o["rel"][x] for x in L.SEL]
                ex = [o["rel"][x] for x in L.EXAM]
                rs = np.array(o["rel_starts"])
                print(f"  {name}: ликвидаций {o['liq']} (стресс −20%: {o['liq20']}, −30%: {o['liq30']}), мин. обеспечение {o['worst']:.2f}, макс. долг/позиция {o['mx']:.2f}\n"
                      f"     к R3 без займа, 8 металлов: до 1999 мед. {np.median([r['before'] for r in sel]):+.1f} (худш. {min(r['before'] for r in sel):+.1f}), "
                      f"после мед. {np.median([r['after'] for r in sel]):+.1f} (худш. {min(r['after'] for r in sel):+.1f}), вся мед. {np.median([r['full'] for r in sel]):+.1f}; "
                      f"экзамен после/вся: " + ", ".join(f"{r['after']:+.0f}/{r['full']:+.0f}" for r in ex)
                      + f" | старты ({o['n_starts']}): мед. {np.median(rs):+.1f}, худшие 10% {np.percentile(rs, 10):+.1f}, хуже без займа {np.mean(rs < 0) * 100:.0f}%")
    return rows


if __name__ == "__main__":
    main()


def part_b():
    """H8d — заём только при дешёвых деньгах: ставка ФРС в месяц решения < X% (стоимость займа = ставка + 2%)."""
    D = L.load()
    r3, thr = L.r3_setup(D)
    from metals_agent_loop7 import II
    from metals_monthly import BOT
    plans = {}
    for k in L.metals(D):
        d = D[k]
        plans[k] = r3(d)
        bot = list(BOT) + [(II, "lo")]
        d["_bn"], d["_nb"] = L.count(d, thr, bot), len(bot)
    print("\n=== H8d: заём только при ставке ФРС < X% (к R3 без займа) ===")
    orig = lev_arr
    for X in (2.0, 3.0, 4.0, 5.0, 6.0):
        for b in (0.25, 0.5, 1.0, 1.5):
            globals()["lev_arr"] = (lambda X: lambda d, plan, b, mode, k=None: np.where((plan > 1.0) & (d["ff"] < X), b, 0.0))(X)
            o = evaluate(D, plans, b, "all")
            globals()["lev_arr"] = orig
            sel = [o["rel"][x] for x in L.SEL]
            ex = [o["rel"][x] for x in L.EXAM]
            rs = np.array(o["rel_starts"])
            nb = sum(int(((plans[x] > 1) & (D[x]["ff"] < X))[: D[x]["m"]].sum()) for x in L.SEL)
            na = sum(int(((plans[x] > 1) & (D[x]["ff"] < X))[D[x]["m"]:].sum()) for x in L.SEL)
            print(f"  ФРС < {X:g}%, заём {b:g}×: месяцев с займом до/после 1999 {nb}/{na}; ликвидаций {o['liq']} (стресс −20%: {o['liq20']}, −30%: {o['liq30']}), мин. обесп. {o['worst']:.2f}\n"
                  f"     8 металлов: до 1999 мед. {np.median([r['before'] for r in sel]):+.1f} (худш. {min(r['before'] for r in sel):+.1f}, не хуже {sum(r['before'] >= -0.5 for r in sel)}/8), "
                  f"после мед. {np.median([r['after'] for r in sel]):+.1f} (худш. {min(r['after'] for r in sel):+.1f}, не хуже {sum(r['after'] >= -0.5 for r in sel)}/8), вся {np.median([r['full'] for r in sel]):+.1f}; "
                  f"экзамен после/вся: " + ", ".join(f"{r['after']:+.0f}/{r['full']:+.0f}" for r in ex)
                  + f" | старты: мед. {np.median(rs):+.1f}, худшие 10% {np.percentile(rs, 10):+.1f}, хуже без займа {np.mean(rs < -0.5) * 100:.0f}%")


if __name__ == "__main__":
    part_b()
