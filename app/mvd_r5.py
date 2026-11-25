"""Круг 5 mvd: макро-индикаторы и композиты (реальная ставка, доллар, золото/серебро для серебра; средние перцентилей) в формах без долга
против DCA. Запуск: python3 app/mvd_r5.py"""
import numpy as np

import mvd_lib as V

UF = {
    "реальная ставка": V.U("rr"),
    "доллар": V.U("dxy"),
    "реальн. + доллар": V.Ucomp(["rr", "dxy"]),
    "реальн. + z3y": V.Ucomp(["rr", "z3y"]),
    "реальн. + SMA200": V.Ucomp(["rr", "ma200"]),
    "реальн. + доллар + z3y": V.Ucomp(["rr", "dxy", "z3y"]),
    "реальн. + доллар + z3y + RSI нед.": V.Ucomp(["rr", "dxy", "z3y", "rsi_w"]),
}


def u_gsr(X):
    """Серебро — золото/серебро вместе с реальной ставкой; остальные — реальная ставка."""
    if X.k == "silver":
        return V.Ucomp(["rr", "gsr"])(X)
    return V.U("rr")(X)


UF["реальн. (+ золото/серебро у серебра)"] = u_gsr
FORMS = {
    "копить ≥ 0,9 ×0,5 / докупать ≤ 0,3 ×2, предел 63": dict(mapf=V.steps(0.3, 0.9, 2.0, 0.5), cap=630.0),
    "то же, предел 126": dict(mapf=V.steps(0.3, 0.9, 2.0, 0.5), cap=1260.0),
    "ступени 0,2/0,8 ×2/×0,5, предел 63": dict(mapf=V.steps(0.2, 0.8, 2.0, 0.5), cap=630.0),
    "лин k1, утечка 1/63, предел 252": dict(mapf=V.lin(1.0), cap=2520.0, leak=1 / 63),
}


def main():
    V.tee("r5.txt")
    V.load()
    rows = []
    for un, uf in UF.items():
        for fn, kw in FORMS.items():
            S = V.Scale(uf, name=f"{un} | {fn}", **kw)
            o = V.check(S)
            good, why = V.ok(o)
            rows.append((S, o, good, why))
            print(f"{S.name}: {V.fmt(o, short=True)} | 2005–25 {o['fsum']:+.1f} ({o['fok']}/4) | {'✓' if good else '✗ ' + why}")
    print("\nЛУЧШИЕ 6 (с контролем 20 сдвигов):")
    for S, o, good, why in sorted(rows, key=lambda r: -r[1]["sum"])[:6]:
        cs, cb, cf = V.control(S, nseed=20)
        g = o["sum"] > np.percentile(cs, 80) and o["B"] > np.percentile(cb, 80)
        print(f"  {S.name}: {V.fmt(o)} | контроль {np.median(cs):+.1f}/{np.percentile(cs, 80):+.1f}, B {np.median(cb):+.1f}/{np.percentile(cb, 80):+.1f} → (г) {'✓' if g else '✗'}"
              f" | {'ПРОХОДИТ' if good and g else '✗ ' + why}")
        print(f"     {V.fafter(o)}")


if __name__ == "__main__":
    main()
