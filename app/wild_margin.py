"""wild: грубая проверка маржи для финалиста (combo4 + «эйфория в стейблах» для зелёных монет) в схеме combo4 (pxm_final): плечо паники ×1,5 и край ×1,6,
пять портфелей, сдвиги −1/0/+1, стресс −20/−30%, ставка 11%, без дохода на резерв. Новое правило — последним (продажа 5% монеты; в схеме маржи — группа продаж).
Запуск: python3 app/wild_margin.py <выход.json>"""
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo_margin import SETS  # noqa: E402
import numpy as np, pandas as pd  # noqa: E402
import agent4d_margin as A4D  # noqa: E402

_ind = A4D.Book.ind


def _ind_age(self, k):  # в стенде маржи нет age — дней с начала истории монеты (как age быстрого оценщика)
    I = _ind(self, k)
    if "age" not in I:
        close = self.I[k][0]; I["age"] = pd.Series(np.arange(len(close), dtype=float), index=close.index)
    return I


A4D.Book.ind = _ind_age

PX.POL.update(on=True, k=0.0, m=2.0)
HERE = os.path.dirname(os.path.abspath(__file__))
ST0 = json.load(open(os.path.join(HERE, "found", "combo3-best.json")))
NEW = json.load(open(os.path.join(HERE, "found", "wild-best.json")))["new_rule"]["rule"]
ST1 = json.loads(json.dumps(ST0)); ST1["rules"].append(NEW)
PS = {k: I6.LP(v) for k, v in SETS.items()}
out = sys.argv[1]; RES = {}; t0 = time.time()
for nm, mm in (("ИТОГ ×1,5", {"lp": 1.5}), ("край ×1,6", {"lp": 1.6}), ("без плеча", {"lev": False})):
    for tag, ST in (("combo4", ST0), ("wild", ST1)):
        S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", **mm); row = {}
        shw = 0.0 if mm.get("lev") is False else 0.2; WT = (1.0,) if mm.get("lev") is False else (0.5, 0.5)
        for pn, P in PS.items():
            row[pn] = C3M.full6(P, S, L, shw, 0.11 / 365, WT, 0.0)
        ok = all(o["safe"] for o in row.values()); RES[f"{nm} | {tag}"] = {"ok": ok, "row": row}
        json.dump(RES, open(out, "w"), ensure_ascii=False, default=float)
        print(f"{'OK' if ok else '✘ '} {nm} | {tag} [{time.time() - t0:.0f} с]", flush=True)
        for pn, o in row.items():
            print(f"   {pn:7s} −1/0/+1: {o['m-1']:+.0f}/{o['m0']:+.0f}/{o['m+1']:+.0f} | худший старт {o['worst_start']:+.0f} | запас {o['lvl']:.2f} | "
                  f"{'0 ликв.' if o['safe'] else 'ЛИКВ ' + str(o['liq'])}", flush=True)
