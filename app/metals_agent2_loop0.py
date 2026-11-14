"""Круг 0 второго агента: пересчёт R3 (found/metals.json) на замороженных данных, метрики близости, разбор пропущенных вершин.
Запуск: python3 app/metals_agent2_loop0.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L


def main():
    D = A.load(fresh=True)
    keys = A.metals(D)
    B = A.evaluate(D, L.base_plan)
    R3 = A.evaluate(D, A.r3)
    # проверка: совпадает с расчётом первого агента (loop10.r3p)
    from metals_agent_loop10 import r3p
    chk = L.run(D, r3p(D, D["_thr3"]), prox=False)
    assert all(abs(chk[k]["full"] - R3[k]["full"]) < 1e-9 and (not np.isfinite(chk[k]["before"]) or abs(chk[k]["before"] - R3[k]["before"]) < 1e-9) for k in keys)
    print("R3 совпадает с расчётом первого агента (loop10) на всех 10 металлах")
    print("\nИТОГ К DCA, % (до 1999 / после 1999 / вся история; половины 1965–81 / 1982–98; вся со сдвигом на месяц):")
    for nm, R in (("основа v1", B), ("R3", R3)):
        print(f"  {nm}:")
        for k in keys:
            r = R[k]
            print(f"    {A.NAME[k]:9} {r['before']:+6.0f} {r['after']:+6.0f} {r['full']:+6.0f} | половины {r['h1']:+5.0f} {r['h2']:+5.0f} | сдвиг {r['full_lag1']:+5.0f}")
    s = A.cmp(R3, B)
    print("\nR3 против основы v1: " + A.fb(s) + "\n   " + A.fa(s))
    print("\nМЕТРИКИ БЛИЗОСТИ R3:\n  отбор, вся история: " + A.fprox(A.agg(R3, A.SEL)) + "\n  отбор, до 1999: " + A.fprox(A.agg(R3, A.SEL, "prox_b"))
          + "\n  экзамен: " + A.fprox(A.agg(R3, A.EXAM)))
    # пропущенные вершины R3: дата, рост от прошлого дна, маркеры вершины в окне ±6 мес., перегрев
    print("\nПРОПУЩЕННЫЕ ВЕРШИНЫ R3 (нет продажи в ±12 мес. по цене ≥ 75% вершины):")
    for k in keys:
        d = D[k]
        c, t = d["c"], d["t"]
        miss = R3[k]["prox"]["missed"]
        tops = [i for i, s_ in d["pv"] if s_ > 0]
        parts = []
        for i in tops:
            w = np.arange(max(0, i - 6), min(len(c), i + 7))
            mt = d["tn3"][w].max()
            p3 = np.nanmax(A.feat(d, A.P3)[w]); y1 = np.nanmax(A.feat(d, A.Y1)[w]); f10 = np.nanmax(A.feat(d, A.F10)[w])
            prev = [j for j, s_ in d["pv"] if s_ < 0 and j < i]
            up = c[i] / c[prev[-1]] if prev else np.nan
            sold = R3[k]["sx"][max(0, i - 12): i + 13].sum() > 0
            parts.append(f"{'✗' if i in miss else '✓'}{t[i]:%Y-%m} (×{up:.1f} от дна, маркеров ≤{mt}/{d['nt']}, к ср.3г {p3:.2f}, за год {y1:+.0f}%, к ср.10л {f10:.2f}{', продажи есть, но ниже 75%' if (i in miss and sold) else ''})")
        print(f"  {A.NAME[k]}: " + "; ".join(parts))
    # продажи и докупки R3 после 1999 у золота, алюминия, олова
    for k in ("gold", "aluminum", "tin"):
        d = D[k]
        c, t = d["c"], d["t"]
        m = d["m"]
        sx, bx = R3[k]["sx"], R3[k]["bx"]
        print(f"\n{A.NAME[k]} после 1999: продажи " + ", ".join(f"{t[i]:%y-%m}({c[i]:.0f})" for i in range(m, len(c)) if sx[i] > 0)
              + " | докупки " + ", ".join(f"{t[i]:%y-%m}({c[i]:.0f})" for i in range(m, len(c)) if bx[i] > 0)
              + f" | цена 1999-01 {c[m]:.0f}, макс. {c[m:].max():.0f} ({t[m + np.argmax(c[m:])]:%Y-%m}), сейчас {c[-1]:.0f}")


if __name__ == "__main__":
    main()
