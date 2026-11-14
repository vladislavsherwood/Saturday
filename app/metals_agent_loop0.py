"""Круг 0: пересчёт основы (found/metals.json) на стенде metals_agent_lib и метрики близости к дну и вершине.
Запуск: python3 app/metals_agent_loop0.py"""
import numpy as np

import metals_agent_lib as L


def main():
    D = L.load(fresh=True)
    keys = L.metals(D)
    B = L.run(D, L.base_plan)
    print("ОСНОВА (итог к DCA, %): до 1999 / после 1999 / вся история; в скобках — исполнение ещё на месяц позже (вся история)")
    for k in keys:
        r = B[k]
        print(f"  {L.NAME[k]:9} {r['before']:+6.0f} {r['after']:+6.0f} {r['full']:+6.0f}  ({r['full_lag1']:+.0f}) | докупки выше мин. {r['above']:.0f}%, в зоне {r['zone']:.0f}%, "
              f"доньев {r['b1']}/{r['b2']}/{r['bots']}, продажи {r['sell_top']:.0f}% от макс., пропущено вершин {r['miss']}/{r['tops']}, мес. докупок {r['buy_months']}, продаж {r['sell_months']}")
    print("\nотбор (8):", L.fmt_prox(L.agg_prox(B, L.SEL)))
    print("экзамен (2):", L.fmt_prox(L.agg_prox(B, L.EXAM)))
    I = L.run(D, L.base_plan, interest=True, prox=False)
    print("\nесли резерв приносит доход 3-мес. векселей (только справка): " + L.line(I, keys))
    # где основа покупает и продаёт относительно крупных разворотов
    import metals_long as ml
    for k in keys:
        d = D[k]
        c, t = d["c"], d["t"]
        pv = ml.pivots(c, d["factor"])
        bx, sx = B[k]["bx"], B[k]["sx"]
        s = []
        for i, kind in pv:
            j = np.arange(max(0, i - 24), min(len(c), i + 25))
            if kind < 0:
                b = [f"{t[x]:%y-%m}" for x in j if bx[x] > 0]
                s.append(f"дно {t[i]:%Y-%m}: докупки {len(b)} ({', '.join(b[:4])}{'…' if len(b) > 4 else ''})")
            else:
                q = [f"{t[x]:%y-%m}:{c[x] / c[i] * 100:.0f}%" for x in j if sx[x] > 0]
                s.append(f"верш. {t[i]:%Y-%m}: продаж {len(q)} ({', '.join(q[:4])}{'…' if len(q) > 4 else ''})")
        print(f"\n{L.NAME[k]}: " + "; ".join(s))


if __name__ == "__main__":
    main()
