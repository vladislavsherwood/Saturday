"""combo4 (= panicx2: combo3 без tune1 + отложенная паника k 0, выдача ×2) — итоговая маржа по решению пользователя: плечо паники ×1,5, сделки 50/50,
разворот 100% ×1,5, дно 25% ×2, шорт BTC 20%. Пять портфелей, сдвиги −1/0/+1, стресс −20/−30%, ставки 11/15%, резерв 0 и 4,5% годовых.
Плюс край: ×1,6 и ×1,75. Запуск: python3 app/pxm_final.py <выход.json>"""
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo_margin import SETS  # noqa: E402

PX.POL.update(on=True, k=0.0, m=2.0)
HERE = os.path.dirname(os.path.abspath(__file__))
ST = json.load(open(os.path.join(HERE, "found", "combo3-best.json")))
PS = {k: I6.LP(v) for k, v in SETS.items()}
out = sys.argv[1]; RES = {}; t0 = time.time()
JOBS = [("ИТОГ ×1,5", {"lp": 1.5}, 0.2, (0.5, 0.5), [0.11, 0.15], [0.0, 0.045]),
        ("без плеча", {"lev": False}, 0.0, (1.0,), [0.11], [0.0, 0.045]),
        ("край ×1,6", {"lp": 1.6}, 0.2, (0.5, 0.5), [0.11], [0.0]),
        ("край ×1,75", {"lp": 1.75}, 0.2, (0.5, 0.5), [0.11], [0.0]),
        ("край ×1,5 шорт 25%", {"lp": 1.5}, 0.25, (0.5, 0.5), [0.11], [0.0]),
        ("×1,5 целиком (без 50/50)", {"lp": 1.5}, 0.2, (1.0,), [0.11], [0.0])]
for nm, mm, shw, WT, rates, ylds in JOBS:
    S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", **mm); row = {}
    for pn, P in PS.items():
        for rate in rates:
            for y in ylds:
                row[f"{pn} | {int(rate * 100)}% | доход {y * 100:g}%"] = C3M.full6(P, S, L, shw, rate / 365, WT, y)
    ok = all(o["safe"] for o in row.values()); RES[nm] = {"ok": ok, "row": row, "group_leverage": L}
    json.dump(RES, open(out, "w"), ensure_ascii=False, default=float)
    print(f"{'OK' if ok else '✘ '} {nm} [{time.time() - t0:.0f} с]", flush=True)
    for k, o in row.items():
        print(f"   {k:26s} −1/0/+1: {o['m-1']:+.0f}/{o['m0']:+.0f}/{o['m+1']:+.0f} | худший старт {o['worst_start']:+.0f} | запас {o['lvl']:.2f} | "
              f"{'0 ликв.' if o['safe'] else 'ЛИКВ ' + str(o['liq'])}", flush=True)
