"""imp6: проверка, что sim5 при параметрах по умолчанию считает как sim4."""
from imp6_common import LP, SETS, S_BEST, L_BEST, SH_BEST, run5
P = LP(SETS["P9"])
A, G = P.mats(S_BEST)
o4 = P.runm(A, G, L_BEST, SH_BEST, stress=True)
o5 = run5(P, A, G, L_BEST, SH_BEST)
print(o4["med"], o4["liq"], o4.get("l30"), o4["lvl"]); print(o5["med"], o5["liq"], o5.get("l30"), o5["lvl"])
