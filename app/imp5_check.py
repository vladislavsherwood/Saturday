"""imp5: проверка, что simP при нулевых опциях совпадает с sim4 (combo_margin.full), и время расчёта."""
import time
from imp5_port import *
from combo_margin import full
t = time.time(); Pt = Port(SETS["P9"]); print("load", time.time() - t)
for cn in ("без плеча", "лучшая"):
    kw, sh = CFGS[cn]; S, L = scheme(S_BEST, **kw)
    t = time.time(); a = full(Pt, S, L, sh); t1 = time.time(); b = fullP(Pt, S, L, sh); t2 = time.time()
    print(cn, a["m0"], a["m1"], a["p10"], a["worst_start"], a["liq"], f"{t1-t:.0f}s")
    print(cn, b["m0"], b["m1"], b["p10"], b["worst"], b["liq"], f"{t2-t1:.0f}s")
