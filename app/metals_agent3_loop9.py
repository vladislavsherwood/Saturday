"""Круг 9: перепроверка маржи (плечо и шорты) на новой основе Q2. Модель — sim_combo2 2-го агента (один счёт на металл: стратегия + заём на докупках +
шорт; проценты ставка ФРС + 2%; ликвидация при (монеты по минимуму месяца + деньги) / (долг + шорт по максимуму месяца) ≤ 1,1;
минимум/максимум — дневные закрытия ×0,97/×1,03, иначе из средних соседних месяцев ∓10%).
H9a: схема 2-го агента (заём 0,5× суммы докупки при ставке ФРС < 3%; шорт на сильной вершине 30% капитала при росте ≥ 2,5× от средней цены
     последней серии, иначе 10%; выход — начало серии или 24 мес.) на Q2 — ноль ликвидаций.
H9b: размер займа b = 0,25/0,5/0,75 и шорт 10/20/30% (без зависимости от роста) против схемы 2-го агента.
Критерий: ноль ликвидаций во всех прогонах с 1982 года (1982–98, 1999–2026, 1982–2026, старты каждый январь 1982–2016;
стресс минимумов ×0,8/×0,7 и максимумов ×1,2/×1,3 одновременно; сдвиг исполнения 0/1), мин. обеспечение без стресса ≥ 1,5;
из прошедших — наибольшая сумма к Q2 без маржи на 1982–98 (8 металлов), при равенстве — меньший риск. Вето: 1999–2026 не хуже Q2 без маржи на ≥ 5 из 8.
Запуск: python3 app/metals_agent3_loop9.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent3_lib as T
from metals_agent3_loop6 import q2


def arrays(d, plan, b, fhi, flo):
    lev = np.where((plan > 1.0) & (d["ff"] < 3.0), b, 0.0)
    ent = d["tn3"] >= d["nt"] - 1
    ext = plan > 1.0
    f = np.where(A.rise(d, plan) >= 2.5, fhi, flo)
    return lev, ent, ext, f


def check(D, plan, b, fhi, flo, keys=None):
    tot = {"liq": 0, "runs": 0, "worst": 1e9, "worst_st": 1e9}
    MR, M0, rs = {}, {}, []
    for k in keys or A.metals(D):
        d = D[k]
        c, n, m, h = d["c"], len(d["c"]), d["m"], d["h82"]
        p = plan(d)
        lev, ent, ext, f = arrays(d, p, b, fhi, flo)
        z, zb = np.zeros(n), np.zeros(n, bool)
        MR[k], M0[k] = {}, {}
        segs = [("h2", h, m), ("after", m, n), ("from82", h, n), ("full", 0, n)] if m > 24 else [("after", m, n), ("full", 0, n)]
        for nm, a0, a1 in segs:
            M0[k][nm] = A.sim_combo2(c, d["lo"], d["hi"], p, z, zb, ext, d["ff"], a0, a1, 1.0, 2.0, 1.1, 0, z, 24)[0]
            for st in (1.0, 0.8, 0.7):
                for lag in (0, 1):
                    e, lq, w = A.sim_combo2(c, d["lo"], d["hi"], p, lev, ent, ext, d["ff"], a0, a1, st, 2.0, 1.1, lag, f, 24)
                    if nm != "full":
                        tot["liq"] += lq; tot["runs"] += 1
                        if st == 1.0:
                            tot["worst"] = min(tot["worst"], w)
                        else:
                            tot["worst_st"] = min(tot["worst_st"], w)
                    if st == 1.0 and lag == 0:
                        MR[k][nm] = e
        for y in range(1982, 2017):
            a0 = int(np.searchsorted(d["t"].values, np.datetime64(f"{y}-01-01")))
            if (a0 <= 0 and y > d["t"][0].year) or a0 >= n - 60:
                continue
            e0 = A.sim_combo2(c, d["lo"], d["hi"], p, z, zb, ext, d["ff"], a0, n, 1.0, 2.0, 1.1, 0, z, 24)[0]
            for st in (1.0, 0.8, 0.7):
                e, lq, w = A.sim_combo2(c, d["lo"], d["hi"], p, lev, ent, ext, d["ff"], a0, n, st, 2.0, 1.1, 0, f, 24)
                tot["liq"] += lq; tot["runs"] += 1
                if st == 1.0:
                    rs.append(A.rel(e, e0)); tot["worst"] = min(tot["worst"], w)
    return tot, MR, M0, np.array(rs)


def stat(MR, M0, part, keys=T.SEL):
    v = np.array([A.rel(MR[k][part], M0[k][part]) for k in keys if part in MR[k]])
    return {"ok": int((v >= -0.5).sum()), "med": float(np.median(v)), "worst": float(v.min()), "logsum": float(np.log1p(v / 100).sum() * 100), "v": v}


def main():
    D = T.load()
    rows = []
    for nm, b, fhi, flo in (("H9a схема 2-го агента: заём 0,5×, шорт 30%/10%", 0.5, 0.3, 0.1),
                            ("заём 0,25×, шорт 30%/10%", 0.25, 0.3, 0.1), ("заём 0,75×, шорт 30%/10%", 0.75, 0.3, 0.1),
                            ("заём 0,5×, без шорта", 0.5, 0.0, 0.0), ("заём 0,5×, шорт 10%", 0.5, 0.1, 0.1),
                            ("заём 0,5×, шорт 20%", 0.5, 0.2, 0.2), ("заём 0,5×, шорт 30%", 0.5, 0.3, 0.3), ("без займа, шорт 30%/10%", 0.0, 0.3, 0.1)):
        tot, MR, M0, rs = check(D, q2, b, fhi, flo)
        s2, sa = stat(MR, M0, "h2"), stat(MR, M0, "after")
        ok = tot["liq"] == 0 and tot["worst"] >= 1.5
        rows.append((nm, ok, s2, sa, tot, MR, M0, rs, (b, fhi, flo)))
        print(f"  {'✓' if ok else '·'} {nm}: прогонов {tot['runs']}, ликвидаций {tot['liq']}, мин. обеспечение {tot['worst']:.2f} (стресс {tot['worst_st']:.2f}); "
              f"1982–98 к Q2: не хуже {s2['ok']}/8, мед. {s2['med']:+.1f}, сумма {s2['logsum']:+.1f}; старты 1982–2016: медиана {np.median(rs):+.1f}, худшие 10% {np.percentile(rs, 10):+.1f}")
    good = sorted([r for r in rows if r[1]], key=lambda r: -r[2]["logsum"])
    if not good:
        print("ни одна схема не прошла")
        return
    nm, ok, s2, sa, tot, MR, M0, rs, prm = good[0]
    print(f"\nВЫБРАНА: {nm}\n  ВЕТО 1999–2026 к Q2 без маржи: не хуже {sa['ok']}/8, мед. {sa['med']:+.1f}, худш. {sa['worst']:+.1f} → {'проходит' if sa['ok'] >= 5 else 'ОТКЛОНЕНА'}")
    for nm2, *_ in rows:
        pass
    print("  Q2 + маржа (итог к DCA, 1982–98 / 1999–2026 / 1982–2026): " + ", ".join(
        f"{A.NAME[k]} " + "/".join(f"{MR[k][p]:+.0f}" if p in MR[k] else "—" for p in ("h2", "after", "from82")) for k in A.metals(D)))
    print("  Q2 без маржи:                                         " + ", ".join(
        f"{A.NAME[k]} " + "/".join(f"{M0[k][p]:+.0f}" if p in M0[k] else "—" for p in ("h2", "after", "from82")) for k in A.metals(D)))
    print("  справочно 1999–2026 к Q2 по схемам: " + "; ".join(f"{r[0]}: мед. {r[3]['med']:+.1f}, худш. {r[3]['worst']:+.1f}" for r in rows))
    return good[0]


if __name__ == "__main__":
    main()
