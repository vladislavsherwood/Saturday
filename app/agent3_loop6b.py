"""Агент 3, круг 6б: карта плато «плечо по бете монеты» для C4 — порог беты 1,2…2,0 и «все монеты», плечо паники/дна/разворота в дни
с низкой бетой, два варианта для высокой беты; полный стресс −20/−30% для каждой схемы. Запуск: python3 app/agent3_loop6b.py <out.json>"""
import sys, os, json, itertools, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent3_margin import C4, plan_of, fmt2, lev_scheme, ind_matrix, beta_split, port3

if __name__ == "__main__":
    out = sys.argv[1]; t0 = time.time()
    A, G, _ = plan_of(lev_scheme(C4)); B = np.nan_to_num(ind_matrix("beta180"), nan=9.0); rows = []
    for b in (1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0, 99):
        Gs = beta_split(G, B > b)
        for lp, lb, lr, hi in itertools.product((1.25, 1.5, 1.75), (2, 2.5), (2, 2.5), ("2/2/1,25", "1,5/1,5/1")):
            hb, hr, hp = (2, 2, 1.25) if hi == "2/2/1,25" else (1.5, 1.5, 1)
            o = port3(A, Gs, [1, lb, lp, lr, 1, 1, 1, lp] + [1, hb, hp, hr, 1, 1, 1, hp]); del o["_x"]
            o["cfg"] = dict(b=b, lp=lp, lb=lb, lr=lr, hi=hi); o["safe"] = o["liq"] == 0 and o.get("l20", 1) == 0 and o.get("l30", 1) == 0; rows.append(o)
    print(f"{len(rows)} схем, {time.time() - t0:.0f} с\n")
    for hi in ("2/2/1,25", "1,5/1,5/1"):
        print(f"высокая бета: дно/разворот/паника {hi}; клетка — медиана (✔ безопасно / ликвидаций при −20/−30%)")
        for lb, lr in itertools.product((2, 2.5), (2, 2.5)):
            print(f"  низкая бета: дно ×{lb}, разворот ×{lr}")
            for lp in (1.25, 1.5, 1.75):
                cells = []
                for b in (1.2, 1.3, 1.4, 1.5, 1.6, 1.8, 2.0, 99):
                    o = next(o for o in rows if o["cfg"] == dict(b=b, lp=lp, lb=lb, lr=lr, hi=hi))
                    cells.append(f"{o['med']:5.0f}{'✔' if o['safe'] else ' '}{'' if o['safe'] else str(o['liq']) + '/' + str(o.get('l20', '-')) + '/' + str(o.get('l30', '-'))}")
                print(f"    паника ×{lp}: " + " | ".join(f"b{b}: {x}" for b, x in zip(("1.2", "1.3", "1.4", "1.5", "1.6", "1.8", "2.0", "все"), cells)))
    json.dump(rows, open(out, "w"))
