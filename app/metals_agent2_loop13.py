"""Круг 13: шорты — размер по росту от последней серии, ранний выход у справедливой цены, только промышленные. Основа — R5; эталон — схема первого агента.
Критерий и вето — в журнале. Запуск: python3 app/metals_agent2_loop13.py"""
import numpy as np

import metals_agent2_lib as A


def ref(d, p):
    n = len(p)
    return d["tn3"] >= d["nt"] - 1, p > 1.0, np.full(n, 0.2)


def by_rise(flo, fhi):
    def f(d, p):
        ent, ext, _ = ref(d, p)
        r = A.rise(d, p)
        return ent, ext, np.where(r >= 2.5, fhi, flo)
    return f


def early(x):
    def f(d, p):
        ent, ext, fr = ref(d, p)
        p3 = np.nan_to_num(A.feat(d, A.P3), nan=9.0)
        return ent, ext | (p3 < x), fr
    return f


def ind_only(d, p):
    ent, ext, fr = ref(d, p)
    return ent & (A.GROUP[d["key"]] == "ind"), ext, fr


def main():
    D = A.load()
    plan = A.ver("R5")
    o0 = A.short_eval(D, plan, ref)
    s0 = A.sstat(o0, "before")
    st0 = np.array(o0["starts"])
    print(f"эталон (сильная вершина, 20%, до серии или 24 мес.): ликвидаций {o0['liq']} из {o0['runs']}, шортов {o0['n']}; к R5 без шорта до 1999: не хуже {s0['ok']}/8, "
          f"мед. {s0['med']:+.1f}, худш. {s0['worst']:+.1f}, сумма {s0['logsum']:+.1f} (половины {A.sstat(o0, 'h1')['logsum']:+.1f}/{A.sstat(o0, 'h2')['logsum']:+.1f}); "
          f"старты мед. {np.median(st0):+.1f}, худшие 10% {np.percentile(st0, 10):+.1f}")
    C = {}
    for flo, fhi in ((0.0, 0.2), (0.0, 0.3), (0.1, 0.3), (0.2, 0.3)):
        C[f"H13b: рост ≥ 2,5 → {fhi:.0%}, иначе {flo:.0%}"] = by_rise(flo, fhi)
    for x in (0.8, 0.9, 1.0):
        C[f"H13c: выход и при цене < {x} × ср. 3 г."] = early(x)
    C["H13d: только промышленные"] = ind_only
    rows = []
    for nm, fn in C.items():
        o = A.short_eval(D, plan, fn, ref=ref)
        sr, s1, s2 = A.sstat(o, "before", "relref"), A.sstat(o, "h1", "relref"), A.sstat(o, "h2", "relref")
        sb = A.sstat(o, "before")
        st = np.array(o["starts"])
        ok = o["liq"] == 0 and sr["logsum"] >= 4 and sr["ok"] >= 7 and s1["logsum"] >= 0 and s2["logsum"] >= 0 and sb["ok"] >= 7 and np.percentile(st, 10) >= -1
        rows.append({"name": nm, "o": o, "ok": ok, "sr": sr})
        print(f"  {'✓' if ok else '·'} {nm}: ликвидаций {o['liq']}, шортов {o['n']}\n      до 1999 к эталону: не хуже {sr['ok']}/8, мед. {sr['med']:+.1f}, худш. {sr['worst']:+.1f}, сумма {sr['logsum']:+.1f} "
              f"(половины {s1['logsum']:+.1f}/{s2['logsum']:+.1f}); к R5 без шорта: не хуже {sb['ok']}/8, сумма {sb['logsum']:+.1f}; старты: мед. {np.median(st):+.1f}, худшие 10% {np.percentile(st, 10):+.1f}")
        print("      до 1999 к эталону по металлам: " + ", ".join(f"{A.NAME[k][:4]} {o['relref'][k]['before']:+.1f}" for k in A.SEL))
    good = sorted([r for r in rows if r["ok"]], key=lambda r: -r["sr"]["logsum"])
    print(f"\nпрошли критерий: {len(good)} из {len(rows)}")
    if good:
        best = good[0]
        sa = A.sstat(best["o"], "after", "relref")
        print(f"ВЫБРАН: {best['name']}; ВЕТО (к эталону после 1999): не хуже {sa['ok']}/8, мед. {sa['med']:+.1f}, худш. {sa['worst']:+.1f}")
    else:
        sa = A.sstat(o0, "after")
        print(f"остаётся эталон; вето эталона к R5 без шорта после 1999: не хуже {sa['ok']}/8, мед. {sa['med']:+.1f}, худш. {sa['worst']:+.1f}")
        print("  эталон к R5 без шорта (до/после/вся): " + ", ".join(f"{A.NAME[k]} " + "/".join(f"{o0['rel'][k][p]:+.1f}" if p in o0["rel"][k] else "—" for p in ("before", "after", "full")) for k in A.metals(D)))


if __name__ == "__main__":
    main()
