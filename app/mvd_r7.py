"""Круг 7 mvd: слой поверх mb1 — шкала только вне серий и вне остывания; в остывании вместо «копить 100%» (покупать надбавку на дешёвых днях /
min(mult, 1)); копилка в серии (лежит / тратится долей серии / сливается в макро-резерв). Против mb1; отдельно — к DCA. Запуск: python3 app/mvd_r7.py"""
import numpy as np

import mvd_lib as V

FORMS = {
    "реальн. «≤ 0,3 ×2 / ≥ 0,9 ×0,5»": (V.U("rr"), V.steps(0.3, 0.9, 2.0, 0.5)),
    "реальн. лин k1, утечка 1/63": (V.U("rr"), V.lin(1.0)),
    "z3y «≤ 0,3 ×2 / ≥ 0,9 ×0,5»": (V.U("z3y"), V.steps(0.3, 0.9, 2.0, 0.5)),
    "SMA200 «≤ 0,3 ×2 / ≥ 0,9 ×0,5»": (V.U("ma200"), V.steps(0.3, 0.9, 2.0, 0.5)),
    "RSI нед. ступени 0,1/0,9 ×3/×0": (V.U("rsi_w"), V.steps(0.1, 0.9, 3.0, 0.0)),
}


def dca_line(o, keys=V.DSEL):
    """Итог к DCA по металлам (A / B / 2005–25) для слоя — из o['abs']."""
    return " ".join(f"{V.NAME[k][:3]} " + "/".join(f"{o['abs'].get((k, h), np.nan):+.0f}" for h in ("A", "B", "full")) for k in keys)


def main():
    V.tee("r7.txt")
    _, _, MM, _ = V.load()
    print("mb1 к DCA (A / B / 2005–25): " + " ".join(f"{V.NAME[k][:3]} " + "/".join(f"{V.run_mb1(MM[k], s):+.0f}" for s in
          (V.segs(MM[k])['A'], V.segs(MM[k])['B'], (V.segs(MM[k])['A'][0], V.segs(MM[k])['B'][1]))) for k in V.DSEL))
    rows = []
    for fn, (uf, mf) in FORMS.items():
        leak = 1 / 63 if "утечка" in fn else 0.0
        for cool in (0, 1, 2):
            for ser in (0, 1, 2):
                if cool == 0 and ser == 0:
                    pass
                for cap in (63, 126):
                    S = V.Scale(uf, mf, cap=cap * 10.0, base="mb1", cool=cool, ser=ser, leak=leak,
                                name=f"{fn} | остывание {['как mb1', 'min(mult,1)', 'надбавка'][cool]} | копилка в серии {['лежит', 'тратится', 'в резерв'][ser]} | предел {cap}")
                    o = V.check(S)
                    good, why = V.ok(o)
                    rows.append((S, o, good, why))
                    print(f"{S.name}: {V.fmt(o, short=True)} | 2005–25 {o['fsum']:+.1f} ({o['fok']}/4) | {'✓' if good else '✗ ' + why}")
    print("\nЛУЧШИЕ 8 (с контролем):")
    for S, o, good, why in sorted(rows, key=lambda r: -r[1]["sum"])[:8]:
        cs, cb, cf = V.control(S, nseed=20)
        g = o["sum"] > np.percentile(cs, 80) and o["B"] > np.percentile(cb, 80)
        print(f"  {S.name}: {V.fmt(o)} | контроль {np.median(cs):+.1f}/{np.percentile(cs, 80):+.1f}, B {np.median(cb):+.1f}/{np.percentile(cb, 80):+.1f} → (г) {'✓' if g else '✗'}"
              f" | {'ПРОХОДИТ' if good and g else '✗ ' + why}")
        print(f"     к DCA (A/B/2005–25): {dca_line(o)}")
        print(f"     {V.fafter(o)}")


if __name__ == "__main__":
    main()
