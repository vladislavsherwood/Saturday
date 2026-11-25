"""Круг 6 mvd: «аванс» — дёшево по индикатору → купить больше взноса в долг (до N дневных взносов, ставка ФРС + 2%), дорого → гасить долг
недокупленными взносами. Контроли: сдвинутый индикатор и «постоянный аванс» (×1,5 до предела долга без индикатора). Запуск: python3 app/mvd_r6.py"""
import numpy as np

import mvd_lib as V

INDS = ["rr", "z3y", "ma200", "dd1y", "rsi_w", "pct5"]
MAPS = {"лин k1": V.lin(1.0), "лин k0,5": V.lin(0.5), "≤ 0,3 ×2 / ≥ 0,9 ×0,5": V.steps(0.3, 0.9, 2.0, 0.5)}
ADV = (21, 63, 126)


def const(adv, ffmax=None):
    return V.Scale(V.U("rr"), lambda u: np.full_like(u, 1.5), cap=0.0, adv=adv * 10.0, ffmax=ffmax, name=f"постоянный аванс ×1,5, долг ≤ {adv}")


def mincov(S, keys=V.DSEL):
    _, _, MM, _ = V.load()
    w = 1e9
    for k in keys:
        X = MM[k]
        sg = V.segs(X)
        for seg in (sg["A"], sg["B"], (sg["A"][0], sg["B"][1])):
            w = min(w, V.run(S, X, seg)[-1])
    return w


def main():
    V.tee("r6.txt")
    V.load()
    base = {}
    for adv in ADV:
        for ff in (None, 3.0):
            C0 = const(adv, ff)
            o = V.check(C0)
            base[(adv, ff)] = o
            print(f"КОНТРОЛЬ {C0.name}{' (только ФРС < 3%)' if ff else ''}: {V.fmt(o)} | мин. покрытие долга {mincov(C0):.2f}")
    rows = []
    print()
    for nm in INDS:
        for mn, mf in MAPS.items():
            for ff in (None, 3.0):
                line = []
                for adv in ADV:
                    S = V.Scale(V.U(nm), mf, cap=0.0, adv=adv * 10.0, ffmax=ff, name=f"{nm} {mn} долг ≤ {adv}{' ФРС<3' if ff else ''}")
                    o = V.check(S)
                    good, why = V.ok(o)
                    c0 = base[(adv, ff)]
                    rows.append((S, o, good, why, c0))
                    line.append(f"{adv}: {o['sum']:+.1f} (A {o['A']:+.1f} B {o['B']:+.1f}, {o['ok']}/8; к пост. {o['sum'] - c0['sum']:+.1f}, B {o['B'] - c0['B']:+.1f})")
                print(f"{nm} {mn}{' ФРС<3' if ff else ''}: " + " | ".join(line))
    print("\nПРОХОДЯТ протокол против DCA (затем контроли):")
    for S, o, good, why, c0 in sorted(rows, key=lambda r: -r[1]["sum"]):
        if not good:
            continue
        cs, cb, cf = V.control(S, nseed=20)
        g = o["sum"] > np.percentile(cs, 80) and o["B"] > np.percentile(cb, 80)
        g2 = o["sum"] - c0["sum"] >= 2 and o["B"] - c0["B"] >= 0
        print(f"  {S.name}: {V.fmt(o)} | сдвиг-контроль {np.median(cs):+.1f}/{np.percentile(cs, 80):+.1f}, B {np.median(cb):+.1f}/{np.percentile(cb, 80):+.1f} → (г) {'✓' if g else '✗'}"
              f" | к постоянному авансу {o['sum'] - c0['sum']:+.1f} (B {o['B'] - c0['B']:+.1f}) → {'✓' if g2 else '✗'} | мин. покрытие {mincov(S):.2f}")
        print(f"     {V.fafter(o)}")


if __name__ == "__main__":
    main()
