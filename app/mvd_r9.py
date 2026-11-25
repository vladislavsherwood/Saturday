"""Круг 9 mvd: последние проверки ближайшей шкалы — серебро по золото/серебро (одно, без mb1 и поверх mb1), недельное решение (множитель
недели по закрытию пятницы), 2026 после решения по дням. Запуск: python3 app/mvd_r9.py"""
import numpy as np
import pandas as pd

import mvd_lib as V
from mvd_r8 import near

ASYM = V.steps(0.3, 0.9, 2.0, 0.5)


def weekly(ufn):
    """u, обновляемый раз в неделю: значение на закрытие пятницы (последний торговый день недели) держится всю следующую неделю."""
    def f(X):
        u = pd.Series(ufn(X), index=X.t)
        wk = u.resample("W-FRI").last()
        return wk.reindex(X.t, method="ffill").values
    return f


def main():
    V.tee("r9.txt")
    _, _, MM, _ = V.load()
    print("=== А. Серебро: шкала по золото/серебро (перцентиль 5 лет), «≤ 0,3 ×2 / ≥ 0,9 ×0,5» и лин k1 ===")
    for mn, mf in (("≤ 0,3 ×2 / ≥ 0,9 ×0,5", ASYM), ("лин k1", V.lin(1.0)), ("ступени 0,2/0,8 ×2/×0,5", V.steps(0.2, 0.8, 2.0, 0.5))):
        for base in ("dca", "mb1"):
            for cap in (63, 126, 252):
                S = V.Scale(V.U("gsr"), mf, cap=cap * 10.0, base=base, name=f"gsr {mn} {base} {cap}")
                o = V.check(S, keys=["silver"], starts=True, epis=True)
                cs, cb, cf = V.control(S, keys=["silver"], nseed=20)
                print(f"  {S.name}: A {o['cells'][('silver', 'A')]:+.1f}, B {o['cells'][('silver', 'B')]:+.1f}, 2005–25 {o['full']['silver']:+.1f} | сдвиг {o['l1']:+.1f}/{o['l2']:+.1f} | "
                      f"без эпиз. мин {min(o['epsum'].values()):+.1f} | старты {o['share']:.0f}% | контроль сумма {np.median(cs):+.1f}/{np.percentile(cs, 80):+.1f}, B {np.median(cb):+.1f} | "
                      f"после решения 2005–26 {o['full26']['silver']:+.1f}, 2000–26 {o['all26']['silver']:+.1f}")
    print("\n=== Б. Недельное решение (u на закрытие пятницы держится неделю) для ближайшей шкалы и её вариантов ===")
    for nm, W in (("rr", 1260), ("rr", 2520)):
        for cap in (63, 126):
            S = V.Scale(weekly(V.U(nm, W)), ASYM, cap=cap * 10.0, name=f"недельно {nm} окно {W} предел {cap}")
            o = V.check(S)
            good, why = V.ok(o)
            print(f"  {S.name}: {V.fmt(o)} | {'✓' if good else '✗ ' + why}")
    print("\n=== В. 2026 после решения: ближайшая шкала по металлам, 2026-01…11 отдельно (старт с нуля 2005; разница итогов 2005–26.11 и 2005–25) ===")
    N0 = near()
    o = V.check(N0, keys=V.ALL5, starts=False, epis=False)
    for k in V.ALL5:
        print(f"  {V.NAME[k]}: 2005–25 {o['full'][k]:+.2f}, 2005–26.11 {o['full26'][k]:+.2f}, вся история 2000–26 {o['all26'][k]:+.2f}")


if __name__ == "__main__":
    main()
