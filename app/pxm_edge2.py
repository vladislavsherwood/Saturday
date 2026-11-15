"""Маржа для panicx2 (k 0: паника на росте usdt не покупает сверх взноса, всё в долг; выдача на развороте × m) — плечо паники 50/50 ×1,25…1,5,
шорт 20% (×1,25 — шорт 10%, осторожная), без плеча; пять портфелей, сдвиги −1/0/+1, стресс −20/−30%, ставка 11%.
Запуск: python3 app/pxm_edge2.py <m>   (m = 1 — k 0 без надбавки, m = 2 — финалист panicx2)"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo_margin import SETS  # noqa: E402

m = float(sys.argv[1]) if len(sys.argv) > 1 else 2.0
PX.POL.update(on=True, k=0.0, m=m)
ST = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "combo3-best.json")))
PS = {k: I6.LP(v) for k, v in SETS.items()}
for nm, mm, shw, WT in (("без плеча", {"lev": False}, 0.0, (1.0,)), ("50/50 ×1,25 шорт 10%", {"lp": 1.25}, 0.1, (0.5, 0.5)),
                        ("50/50 ×1,3", {"lp": 1.3}, 0.2, (0.5, 0.5)), ("50/50 ×1,4", {"lp": 1.4}, 0.2, (0.5, 0.5)), ("50/50 ×1,5", {"lp": 1.5}, 0.2, (0.5, 0.5))):
    S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", **mm); bad, ms, lv = [], [], 99
    for pn, P in PS.items():
        o = C3M.full6(P, S, L, shw, 0.11 / 365, WT, 0.0)
        ms.append(f"{pn} {o['m-1']:+.0f}/{o['m0']:+.0f}/{o['m+1']:+.0f}"); lv = min(lv, o["lvl"])
        if not o["safe"]: bad.append(f"{pn} {o['liq']}")
    print(f"k0 ×{m:g} | {nm}: {'0 ликв.' if not bad else 'ЛИКВ ' + '; '.join(bad)} | запас {lv:.2f} | " + " | ".join(ms), flush=True)
