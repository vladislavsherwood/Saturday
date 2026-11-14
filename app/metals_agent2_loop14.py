"""Круг 14: маржа в одном счёте (R5 + заём на докупках при ФРС < 3% + шорт 30%/10% по росту) и запас по размеру займа b.
Критерий — в журнале. Запуск: python3 app/metals_agent2_loop14.py"""
import numpy as np

import metals_agent2_lib as A


def check(D, b, plan):
    tot = {"liq": 0, "runs": 0, "worst": 1e9, "worst_st": 1e9}
    MR, rs = {}, []
    for k in A.metals(D):
        d = D[k]
        c, n, m = d["c"], len(d["c"]), d["m"]
        p = plan(d)
        lev, ent, ext, f = A.margin_arrays(d, p, b=b)
        z, zb = np.zeros(n), np.zeros(n, bool)
        MR[k] = {}
        segs = [("before", 0, m), ("after", m, n), ("full", 0, n)] if m > 24 else [("after", m, n), ("full", 0, n)]
        for nm, a0, a1 in segs:
            e0 = A.sim_combo2(c, d["lo"], d["hi"], p, z, zb, ext, d["ff"], a0, a1, 1.0, 2.0, 1.1, 0, z, 24)[0]
            assert abs(e0 - A.edges(d, p)[nm]) < 1e-6
            for st in (1.0, 0.8, 0.7):
                for lag in (0, 1):
                    e, lq, w = A.sim_combo2(c, d["lo"], d["hi"], p, lev, ent, ext, d["ff"], a0, a1, st, 2.0, 1.1, lag, f, 24)
                    tot["liq"] += lq; tot["runs"] += 1
                    if st == 1.0:
                        tot["worst"] = min(tot["worst"], w)
                    else:
                        tot["worst_st"] = min(tot["worst_st"], w)
                    if st == 1.0 and lag == 0:
                        MR[k][nm] = e
        for y in range(1966, 2017):
            a0 = int(np.searchsorted(d["t"].values, np.datetime64(f"{y}-01-01")))
            if (a0 <= 0 and y > d["t"][0].year) or a0 >= n - 60:
                continue
            e0 = A.sim_combo2(c, d["lo"], d["hi"], p, z, zb, ext, d["ff"], a0, n, 1.0, 2.0, 1.1, 0, z, 24)[0]
            for st in (1.0, 0.8, 0.7):
                e, lq, w = A.sim_combo2(c, d["lo"], d["hi"], p, lev, ent, ext, d["ff"], a0, n, st, 2.0, 1.1, 0, f, 24)
                tot["liq"] += lq; tot["runs"] += 1
                if st == 1.0:
                    rs.append(A.rel(e, e0)); tot["worst"] = min(tot["worst"], w)
    return tot, MR, np.array(rs)


def main():
    D = A.load()
    plan = A.ver("R5")
    R5 = A.evaluate(D, plan)
    from metals_agent_lib import base_plan
    B = A.evaluate(D, base_plan)
    good = []
    out = {}
    for b in (0.5, 0.75, 1.0):
        tot, MR, rs = check(D, b, plan)
        ok = tot["liq"] == 0 and tot["worst"] >= 1.5 and np.percentile(rs, 10) >= 0
        out[b] = (tot, MR, rs)
        print(f"  {'✓' if ok else '·'} заём {b}×: прогонов {tot['runs']}, ликвидаций {tot['liq']}, мин. обеспечение без стресса {tot['worst']:.2f}, в стрессе {tot['worst_st']:.2f}; "
              f"старты ({len(rs)}): медиана к R5 без маржи {np.median(rs):+.1f}%, худшие 10% {np.percentile(rs, 10):+.1f}%, хуже без маржи {np.mean(rs < -0.5) * 100:.0f}%")
        if ok:
            good.append(b)
    if not good:
        print("ни один размер не прошёл")
        return
    b = max(good)
    tot, MR, rs = out[b]
    print(f"\nВЫБРАН заём {b}×. R5 + маржа (итог к DCA, до/после/вся): " + ", ".join(f"{A.NAME[k]} " + "/".join(f"{MR[k][p]:+.0f}" if p in MR[k] else "—" for p in ("before", "after", "full")) for k in A.metals(D)))
    print("  к R5 без маржи: " + ", ".join(f"{A.NAME[k]} " + "/".join(f"{A.rel(MR[k][p], R5[k][p]):+.0f}" if p in MR[k] else "—" for p in ("before", "after", "full")) for k in A.metals(D)))
    print("  к основе v1 без маржи: " + ", ".join(f"{A.NAME[k]} " + "/".join(f"{A.rel(MR[k][p], B[k][p]):+.0f}" if p in MR[k] else "—" for p in ("before", "after", "full")) for k in A.metals(D)))
    # для сравнения: схема первого агента (шорт 20%) на R5
    import metals_agent_lib as L
    MR1 = {}
    for k in A.metals(D):
        d = D[k]
        p = plan(d)
        lev, ent, ext, f = A.margin_arrays(d, p, b=0.5, fhi=0.2, flo=0.2)
        n, m = len(d["c"]), d["m"]
        MR1[k] = {nm: A.sim_combo2(d["c"], d["lo"], d["hi"], p, lev, ent, ext, d["ff"], a0, a1, 1.0, 2.0, 1.1, 0, f, 24)[0]
                  for nm, a0, a1 in ([("before", 0, m), ("after", m, n), ("full", 0, n)] if m > 24 else [("after", m, n), ("full", 0, n)])}
    print("  схема первого агента (шорт 20%) на R5: " + ", ".join(f"{A.NAME[k]} " + "/".join(f"{MR1[k][p]:+.0f}" if p in MR1[k] else "—" for p in ("before", "after", "full")) for k in A.metals(D)))
    return out


if __name__ == "__main__":
    main()
