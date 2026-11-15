"""Маржа combo4 + «эйфория в стейблах» (отложенная паника для всех монет, A 0): плечо паники ×1,5 и край ×1,6, 50/50, шорт BTC 20%; без плеча.
Пять портфелей, сдвиги −1/0/+1, стресс −20/−30%, ставка 11%. Запуск: python3 app/euph_margin.py"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo_margin import SETS  # noqa: E402

PX.POL.update(on=True, k=0.0, m=2.0, A=0)
HERE = os.path.dirname(os.path.abspath(__file__))
C3 = json.load(open(os.path.join(HERE, "found", "combo3-best.json")))
EU = {"act": -0.05, "conds": [{"ind": "usdt", "op": "<", "v": 0.9}, {"ind": "age", "op": ">", "v": 540}, {"ind": "meme", "op": "<", "v": 0.5}, {"ind": "beta180", "op": ">", "v": 0.9}]}
PS = {k: I6.LP(v) for k, v in SETS.items()}
for nm, ST in (("combo4", C3), ("combo4 + эйфория", dict(C3, rules=C3["rules"] + [EU]))):
    for lab, mm, shw, WT in (("×1,5", {"lp": 1.5}, 0.2, (0.5, 0.5)), ("×1,6", {"lp": 1.6}, 0.2, (0.5, 0.5)), ("без плеча", {"lev": False}, 0.0, (1.0,))):
        S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", **mm); bad, ms, lv = [], [], 99
        for pn, P in PS.items():
            o = C3M.full6(P, S, L, shw, 0.11 / 365, WT, 0.0)
            ms.append(f"{pn} {o['m-1']:+.0f}/{o['m0']:+.0f}/{o['m+1']:+.0f}"); lv = min(lv, o["lvl"])
            if not o["safe"]: bad.append(pn)
        print(f"{nm} | {lab}: {'0 ликв.' if not bad else 'ЛИКВ ' + ', '.join(bad)} | запас {lv:.2f} | " + " | ".join(ms), flush=True)
