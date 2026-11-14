"""Круг 12: плечо — условие по реальной ставке и по глубине цены. Основа — R5 без плеча; модель — sim_margin первого агента.
H12a — реальная ставка ФРС < r0 → заём b. H12b — (ФРС < 3% или реальная < 0) и цена к ср. 3 г. < q → заём b. H12c — ФРС < 3% или реальная < 0 → заём b.
Схема первого агента (ФРС < 3%, 0,5×) — для сравнения. Критерий и вето — в журнале.
Запуск: python3 app/metals_agent2_loop12.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L


def real_rate(d):
    return d["ff"] - np.nan_to_num(A.feat(d, "Инфляция за год, %"), nan=99.0)


def main():
    D = A.load()
    plan = A.ver("R5")
    a20, a30 = L.pooled(D, A.P3, 0.2), L.pooled(D, A.P3, 0.3)
    C = {"схема первого агента: ФРС < 3% → 0,5×": lambda d, p: np.where((p > 1) & (d["ff"] < 3), 0.5, 0.0)}
    for r0 in (-2.0, 0.0, 1.0):
        for b in (0.25, 0.5, 1.0):
            C[f"H12a: реальная ставка < {r0:+g}% → {b}×"] = (lambda r0, b: lambda d, p: np.where((p > 1) & (real_rate(d) < r0), b, 0.0))(r0, b)
    for a, qn in ((a20, "q20"), (a30, "q30")):
        for b in (0.5, 1.0):
            C[f"H12b: (ФРС < 3% или реальная < 0) и цена к ср. 3 г. < {a:.2f} ({qn}) → {b}×"] = (lambda a, b: lambda d, p: np.where(
                (p > 1) & ((d["ff"] < 3) | (real_rate(d) < 0)) & (np.nan_to_num(A.feat(d, A.P3), nan=9) < a), b, 0.0))(a, b)
    for b in (0.25, 0.5):
        C[f"H12c: ФРС < 3% или реальная < 0 → {b}×"] = (lambda b: lambda d, p: np.where((p > 1) & ((d["ff"] < 3) | (real_rate(d) < 0)), b, 0.0))(b)
    rows = []
    for nm, fn in C.items():
        o = A.margin_eval(D, plan, fn)
        nb = sum(int(((plan(D[k]) > 1) & (fn(D[k], plan(D[k])) > 0))[: D[k]["m"]].sum()) for k in A.SEL)
        na = sum(int(((plan(D[k]) > 1) & (fn(D[k], plan(D[k])) > 0))[D[k]["m"]:].sum()) for k in A.SEL)
        sb, s1, s2 = A.mstat(o, "before"), A.mstat(o, "h1"), A.mstat(o, "h2")
        st = np.array(o["starts"])
        ok = o["liq"] == 0 and sb["ok"] >= 7 and sb["logsum"] >= 0 and s1["logsum"] >= 0 and s2["logsum"] >= 0 and np.percentile(st, 10) >= -1
        rows.append({"name": nm, "o": o, "ok": ok, "sb": sb})
        print(f"  {'✓' if ok else '·'} {nm}: мес. с займом до/после 1999 {nb}/{na}; ликвидаций {o['liq']} из {o['runs']} прогонов, мин. обеспечение {o['worst']:.2f}\n"
              f"      до 1999 к R5: не хуже {sb['ok']}/8, мед. {sb['med']:+.1f}, худш. {sb['worst']:+.1f}, сумма {sb['logsum']:+.1f} (половины {s1['logsum']:+.1f}/{s2['logsum']:+.1f}); "
              f"старты ({len(st)}): мед. {np.median(st):+.1f}, худшие 10% {np.percentile(st, 10):+.1f}")
    good = [r for r in rows if r["ok"]]
    good.sort(key=lambda r: -r["sb"]["logsum"])
    print(f"\nпрошли критерий: {len(good)} из {len(rows)}")
    if not good:
        return
    best = good[0] if good[0]["sb"]["logsum"] > 0.5 else next(r for r in rows if r["name"].startswith("схема первого"))
    sa = A.mstat(best["o"], "after")
    print(f"ВЫБРАН: {best['name']}\n  ВЕТО после 1999: не хуже {sa['ok']}/8, мед. {sa['med']:+.1f}, худш. {sa['worst']:+.1f} → {'проходит' if sa['ok'] >= 6 else 'ОТКЛОНЁН'}")
    print("  к R5 без плеча (до/после/вся): " + ", ".join(f"{A.NAME[k]} " + "/".join(f"{best['o']['rel'][k][p]:+.0f}" if p in best["o"]["rel"][k] else "—" for p in ("before", "after", "full")) for k in A.metals(D)))
    print("  итог к DCA с плечом: " + ", ".join(f"{A.NAME[k]} " + "/".join(f"{best['o']['res'][k][p]:+.0f}" if p in best["o"]["res"][k] else "—" for p in ("before", "after", "full")) for k in A.metals(D)))


if __name__ == "__main__":
    main()
