"""Круг 3 mvd: формы шкалы против DCA (базовый вариант) — окно перцентиля 1 год / 5 лет, ступени, асимметрия (среднее ≥ 1),
сохранение только на крайнем «дорого». Запуск: python3 app/mvd_r3.py"""
import numpy as np

import mvd_lib as V

INDS = ["rr", "z3y", "dxy", "ma200", "ma50", "rsi_w"]
MAPS = {
    "лин k1": V.lin(1.0),
    "лин k1, ≥ 0,5": V.lin(1.0, lo=0.5),
    "ступени 0,2/0,8 ×2/×0,5": V.steps(0.2, 0.8, 2.0, 0.5),
    "ступени 0,1/0,9 ×3/×0": V.steps(0.1, 0.9, 3.0, 0.0),
    "дорого только ≥ 0,9 ×0,5; дёшево ≤ 0,3 ×2": V.steps(0.3, 0.9, 2.0, 0.5),
}
WS = (252, 1260)
CAPS = (21, 63, 126)


def main():
    V.tee("r3.txt")
    V.load()
    rows = []
    for nm in INDS:
        for W in WS:
            for mn, mf in MAPS.items():
                line = []
                for cap in CAPS:
                    S = V.Scale(V.U(nm, W), mf, cap=cap * 10.0, name=f"{nm} W{W} {mn} cap{cap}")
                    o = V.check(S, starts=True, epis=True, after=True)
                    good, why = V.ok(o)
                    rows.append((S, o, good, why))
                    line.append(f"{cap}: {o['sum']:+.1f} (A {o['A']:+.1f} B {o['B']:+.1f}, {o['ok']}/8, 25г {o['fsum']:+.1f})")
                print(f"{nm} W{W} {mn}: " + " | ".join(line))
    print("\nЛУЧШИЕ 12 по сумме (с контролем 20 сдвигов):")
    for S, o, good, why in sorted(rows, key=lambda r: -r[1]["sum"])[:12]:
        cs, cb, cf = V.control(S, nseed=20)
        g = o["sum"] > np.percentile(cs, 80) and o["B"] > np.percentile(cb, 80)
        print(f"  {S.name}: {V.fmt(o)} | контроль {np.median(cs):+.1f}/{np.percentile(cs, 80):+.1f}, B {np.median(cb):+.1f}/{np.percentile(cb, 80):+.1f} → (г) {'✓' if g else '✗'}"
              f" | {'ПРОХОДИТ' if good and g else '✗ ' + why}")
        print(f"     {V.fafter(o)}")


if __name__ == "__main__":
    main()
