"""Круг 2 mvd: базовый вариант (без продаж и серий) — линейная шкала mult = 1 + k(1 − 2u) × индикаторы × предел копилки против DCA
и против контроля со сдвинутым индикатором. Запуск: python3 app/mvd_r2.py"""
import numpy as np

import mvd_lib as V

INDS = ["ma200", "ma50", "z3y", "rsi_d", "rsi_w", "rsi_m", "dd1y", "pct3", "pct5", "dxy", "rr"]
KS = (0.5, 1.0)
CAPS = (63, 252, 10 ** 7)


def capname(c):
    return "∞" if c >= 10 ** 6 else f"{c}"


def main():
    V.tee("r2.txt")
    V.load()
    print("Базовый вариант против DCA, до 2025-12. Предел копилки — в дневных взносах (21 ≈ месяц, 252 ≈ год).")
    print("контроль: сумма 8 ячеек / половина B у 20 вариантов со сдвинутым индикатором — медиана и 80-й перцентиль; (г) — реальный выше 80-го по обоим\n")
    rows = []
    for nm in INDS:
        for k in KS:
            for cap in CAPS:
                S = V.Scale(V.U(nm), V.lin(k), cap=cap * 10.0, name=f"{nm} k{k} cap{capname(cap)}")
                o = V.check(S, starts=True, epis=True, after=True)
                cs, cb, cf = V.control(S, nseed=20)
                g = o["sum"] > np.percentile(cs, 80) and o["B"] > np.percentile(cb, 80)
                good, why = V.ok(o)
                rows.append((S.name, o, cs, cb, g, good))
                print(f"{S.name}: {V.fmt(o)} | контроль {np.median(cs):+.1f}/{np.percentile(cs, 80):+.1f}, B {np.median(cb):+.1f}/{np.percentile(cb, 80):+.1f} "
                      f"→ (г) {'✓' if g else '✗'} | {'ПРОХОДИТ' if good and g else '✗ ' + why}")
                print(f"     {V.fafter(o)}")
    print("\nЛУЧШИЕ по сумме 8 ячеек:")
    for nm, o, cs, cb, g, good in sorted(rows, key=lambda r: -r[1]["sum"])[:12]:
        print(f"  {nm}: сумма {o['sum']:+.1f} (A {o['A']:+.1f}, B {o['B']:+.1f}), 2005–25 {o['fsum']:+.1f}, контроль-медиана {np.median(cs):+.1f}, (г) {'✓' if g else '✗'}")


if __name__ == "__main__":
    main()
