"""Круг 15: устойчивость прироста R5 к R3 по стартам, задержке исполнения на 2 мес. и комиссии 0,5%; сводка кругов 11–15 (с экзаменом).
Запуск: python3 app/metals_agent2_loop15.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L


def main():
    D = A.load()
    r3, r5 = A.ver("R3"), A.ver("R5")
    rate = None
    sb, sa = [], []
    for k in A.SEL:
        d = D[k]
        c, n, m = d["c"], len(d["c"]), d["m"]
        p3, p5 = r3(d), r5(d)
        z = np.zeros(n)
        for y in range(1966, 2017):
            a0 = int(np.searchsorted(d["t"].values, np.datetime64(f"{y}-01-01")))
            if a0 <= 0 and y > d["t"][0].year:
                continue
            if y <= 1988:
                e3, e5 = L.sim(c, p3, a0, m, 0, z)[0], L.sim(c, p5, a0, m, 0, z)[0]
                sb.append(A.rel(e5, e3))
            elif y >= 1999 and a0 < n - 60:
                e3, e5 = L.sim(c, p3, a0, n, 0, z)[0], L.sim(c, p5, a0, n, 0, z)[0]
                sa.append(A.rel(e5, e3))
    sb, sa = np.array(sb), np.array(sa)
    okA = (sb >= -0.5).mean() >= 0.8
    print(f"H15a старты 1966–1988 до 1999-01 ({len(sb)}): R5 не хуже R3 в {(sb >= -0.5).mean() * 100:.0f}% стартов, медиана {np.median(sb):+.1f}%, худшие 10% {np.percentile(sb, 10):+.1f}%, "
          f"худший {sb.min():+.1f}% → {'выполнено' if okA else 'НЕ выполнено'}")
    res = {}
    for nm, lag, fee in (("сдвиг 2 мес.", 2, 0.001), ("комиссия 0,5%", 0, 0.005), ("сдвиг 2 мес. и комиссия 0,5%", 2, 0.005)):
        dd = {}
        for k in A.SEL:
            d = D[k]
            c, m, h = d["c"], d["m"], d["h82"]
            dd[k] = {part: A.rel(A.sim_fee(c, r5(d), a0, a1, lag, fee), A.sim_fee(c, r3(d), a0, a1, lag, fee)) for part, a0, a1 in (("before", 0, m), ("h1", 0, h), ("h2", h, m))}
        v = np.array([dd[k]["before"] for k in A.SEL])
        s = np.log1p(v / 100).sum() * 100
        res[nm] = ((v >= -0.5).sum() >= 7 and s >= 0)
        print(f"H15b {nm}: до 1999 не хуже {(v >= -0.5).sum()}/8, мед. {np.median(v):+.1f}, худш. {v.min():+.1f}, сумма {s:+.1f} (половины "
              f"{np.log1p(np.array([dd[k]['h1'] for k in A.SEL]) / 100).sum() * 100:+.1f}/{np.log1p(np.array([dd[k]['h2'] for k in A.SEL]) / 100).sum() * 100:+.1f}) → {'выполнено' if res[nm] else 'НЕ выполнено'}")
    okB = all(res.values())
    print(f"\nкритерий {'выполнен — R5 остаётся' if okA and okB else 'НЕ выполнен — откат поправки круга 5'}")
    print(f"ВЕТО: старты 1999–2016 до конца истории ({len(sa)}): R5 не хуже R3 в {(sa >= -0.5).mean() * 100:.0f}% стартов, медиана {np.median(sa):+.1f}%, худшие 10% {np.percentile(sa, 10):+.1f}%")
    # сводка кругов 11–15
    R3, R5 = A.evaluate(D, r3), A.evaluate(D, r5)
    s = A.cmp(R5, R3)
    print("\n=== СВОДКА КРУГОВ 11–15: R5 против R3 ===\n  " + A.fb(s) + "\n  " + A.fa(s) + "\n  экзамен к R3 (до/после/вся): " + A.exam(R5, R3))
    for nm, fn in (("R3", r3), ("R5", r5)):
        lst = []
        for k in A.EXAM:
            d = D[k]
            c, n = d["c"], len(d["c"])
            z = np.zeros(n)
            v = [A.rel(L.sim(c, r5(d), a0, n, 0, z)[0], L.sim(c, r3(d), a0, n, 0, z)[0]) for y in range(1999, 2017)
                 for a0 in [int(np.searchsorted(d["t"].values, np.datetime64(f"{y}-01-01")))] if 0 < a0 < n - 60]
            lst.append(f"{A.NAME[k]}: R5 не хуже R3 в {(np.array(v) >= -0.5).mean() * 100:.0f}% стартов 1999–2016")
        if nm == "R5":
            print("  экзамен по стартам: " + "; ".join(lst))


if __name__ == "__main__":
    main()
