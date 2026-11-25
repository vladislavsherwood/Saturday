"""Круг 4 mvd: устройство копилки против DCA (базовый вариант) — трата только ниже средней цены накопления (pmax), принудительная «утечка»
(срок ожидания), предел копилки; value averaging (целевая траектория стоимости позиции). Запуск: python3 app/mvd_r4.py"""
import numpy as np

import mvd_lib as V

INDS = ["rr", "z3y", "ma200", "rsi_w"]


def line(S):
    o = V.check(S, starts=True, epis=True, after=True)
    good, why = V.ok(o)
    return o, good, why


def main():
    V.tee("r4.txt")
    V.load()
    rows = []
    print("=== А. Шкала (лин k1, перцентиль 5 лет) + устройство копилки: pmax (тратить ≤ средней цены накопления × (1+pmax)), утечка (доля копилки в день), предел ===")
    for nm in INDS:
        for pmax in (-1.0, 0.0, 0.05):
            for leak in (0.0, 1 / 63, 1 / 21):
                out = []
                for cap in (126, 252, 504):
                    S = V.Scale(V.U(nm), V.lin(1.0), cap=cap * 10.0, pmax=pmax, leak=leak,
                                name=f"{nm} лин k1 pmax {pmax if pmax >= 0 else '—'} утечка {leak:.3f} cap{cap}")
                    o, good, why = line(S)
                    rows.append((S, o, good, why))
                    out.append(f"{cap}: {o['sum']:+.1f} (A {o['A']:+.1f} B {o['B']:+.1f}, {o['ok']}/8)")
                print(f"{nm} pmax {pmax if pmax >= 0 else '—'} утечка 1/{round(1 / leak) if leak else '∞'}: " + " | ".join(out))
    print("\n=== Б. Value averaging: цель = взносы с ростом g годовых; покупка = цель − стоимость позиции в [0, vamax × взнос]; копилка ≤ предела ===")
    for g in (0.0, 0.05, 0.10, 0.15):
        for vm in (2.0, 3.0):
            out = []
            for cap in (126, 252, 10 ** 6):
                S = V.Scale(V.U("ma200"), V.lin(0.0), cap=cap * 10.0, va=1, vag=g, vamax=vm, name=f"VA g{g:.0%} max×{vm:.0f} cap{cap}")
                o, good, why = line(S)
                rows.append((S, o, good, why))
                out.append(f"{'∞' if cap > 10 ** 5 else cap}: {o['sum']:+.1f} (A {o['A']:+.1f} B {o['B']:+.1f}, {o['ok']}/8, 25г {o['fsum']:+.1f})")
            print(f"VA g {g:.0%} max ×{vm:.0f}: " + " | ".join(out))
    print("\nЛУЧШИЕ 8 по сумме:")
    for S, o, good, why in sorted(rows, key=lambda r: -r[1]["sum"])[:8]:
        extra = ""
        if not S.va:
            cs, cb, cf = V.control(S, nseed=20)
            g = o["sum"] > np.percentile(cs, 80) and o["B"] > np.percentile(cb, 80)
            extra = f" | контроль {np.median(cs):+.1f}/{np.percentile(cs, 80):+.1f}, B {np.median(cb):+.1f}/{np.percentile(cb, 80):+.1f} → (г) {'✓' if g else '✗'}"
        print(f"  {S.name}: {V.fmt(o)}{extra} | {'ПРОХОДИТ' if good else '✗ ' + why}")
        print(f"     {V.fafter(o)}")


if __name__ == "__main__":
    main()
