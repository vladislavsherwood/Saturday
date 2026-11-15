"""Край плеча паники с отложенной паникой (pxm_margin): 50/50 ×1,3…1,5 и без размазывания ×1,35…1,5, шорт 20%, ставка 11%.
Запуск: python3 app/pxm_edge.py"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo_margin import SETS  # noqa: E402

ST = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "combo3-best.json")))
PS = {k: I6.LP(v) for k, v in SETS.items()}
for pol in ((True,) if len(sys.argv) > 1 else (False, True)):
    PX.POL["on"] = pol
    for lp, WT in (((1.6, (0.5, 0.5)), (1.75, (0.5, 0.5)), (2.0, (0.5, 0.5)), (1.75, (1.0,))) if len(sys.argv) > 1 else ((1.35, (0.5, 0.5)), (1.4, (0.5, 0.5)), (1.5, (0.5, 0.5)), (1.4, (1.0,)), (1.5, (1.0,)))):
        S, L = C3M.scheme6(ST, lp=lp, sr=1.0, t1grp="off"); bad, ms, lv = [], [], 99
        for pn, P in PS.items():
            o = C3M.full6(P, S, L, 0.2, 0.11 / 365, WT, 0.0)
            ms.append(f"{pn} {o['m-1']:+.0f}/{o['m0']:+.0f}/{o['m+1']:+.0f}"); lv = min(lv, o["lvl"])
            if not o["safe"]: bad.append(f"{pn} {o['liq']}")
        print(f"{'отложенная' if pol else 'основа    '} {'50/50' if len(WT) > 1 else 'целиком'} ×{lp}: {'0 ликв.' if not bad else 'ЛИКВ ' + '; '.join(bad)} | запас {lv:.2f} | " + " | ".join(ms), flush=True)
