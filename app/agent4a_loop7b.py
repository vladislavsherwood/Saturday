"""Агент 4A, круг 7б: контроль и плато для находки H7b (паника без плеча в молодом медвежьем рынке, иначе плечо больше).
Контроль — то же плечо паники без защиты; плато — порог 30…150 дней × плечо 1,4…1,75; по годам старта и худший старт;
тот же приём для дна и разворота (их плечо тоже без плеча в молодом медвежьем рынке). Запуск: python3 app/agent4a_loop7b.py <out.json>"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4a_loop7 import W25, LEV, base_scheme, split, plan_of, port2, fmt2, c
from agent2_margin import starts, idx

years = np.array([idx[s].year for s in starts])
if __name__ == "__main__":
    out, res = sys.argv[1], []
    B = base_scheme(W25)
    def rep(tag, S, lev, xs=False):
        A, G, _ = plan_of(S); o = port2(A, G, tuple(lev), sep=True, xs=xs); o["tag"] = tag
        if xs:
            x = np.array(o.pop("_x")); o["by_year"] = {int(y): float(np.median(x[years == y])) for y in sorted(set(years))}; o["worst"] = float(x.min())
        res.append(o); print(f"{tag}: {fmt2(o)}" + (f" | худший старт {o['worst']:+.0f}% | по годам " + " ".join(f"{y}:{v:+.0f}" for y, v in o["by_year"].items()) if xs else ""), flush=True)
        json.dump(res, open(out, "w"), ensure_ascii=False)
    rep("W25, схема агента 2", B, LEV, True)
    print("\nконтроль: плечо паники без защиты")
    for lp in (1.4, 1.5, 1.6):
        L = list(LEV); L[2] = lp; L[7] = lp; rep(f"плечо паники ×{lp} без защиты", B, L)
    print("\nплато: порог молодого медвежьего рынка × плечо паники")
    for D in (30, 45, 60, 75, 90, 120, 150):
        for lp in (1.25, 1.4, 1.5, 1.6):
            L = list(LEV); L[2] = lp; L[7] = lp; L[5] = 1.0
            rep(f"< {D} дн: паника без плеча, иначе ×{lp}", split(B, c("btcdays", "<", D), 5, 1.0), L, xs=(lp == 1.5 and D in (60, 90)))
