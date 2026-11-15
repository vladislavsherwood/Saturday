"""imp6, круг 1: какие правила чувствительны к исполнению на день позже. Для каждого семейства — сдвиг только его решений на +1 день
(и на −1: исполнение по закрытию дня решения, как у исполнителя в 00:10 UTC); медиана 105 стартов на пяти портфелях."""
import time, json, os
import numpy as np
from imp6_common import LP, SETS, S_BEST, L_BEST, SH_BEST, families, HERE

t = time.time()
PS = {k: LP(v) for k, v in SETS.items()}
FAM = families(S_BEST)
print({k: v for k, v in FAM.items()})
out = {}
def run(tag, **kw):
    row = {}
    for nm, P in PS.items():
        shl = kw.pop("sh_lag", None) if False else kw.get("sh_lag", 0)
        A, G = P.mats(S_BEST, kw.get("rules"), kw.get("lag", 1), kw.get("all", 0))
        row[nm] = P.runm(A, G, L_BEST, SH_BEST, sh_lag=shl)["med"]
    out[tag] = row
    print(f"{tag:40s} " + " ".join(f"{nm} {v:+6.0f}" for nm, v in row.items()), f"[{time.time()-t:.0f} с]", flush=True)
run("в срок")
run("всё +1 день", all=1, sh_lag=1)
run("всё −1 день (по закрытию дня решения)", all=-1, sh_lag=-1)
run("только шорт +1", sh_lag=1)
for f, idx in FAM.items():
    run(f"только {f} +1", rules=idx, lag=1)
for f, idx in FAM.items():
    run(f"только {f} −1", rules=idx, lag=-1)
run("всё +2 дня", all=2, sh_lag=2)
json.dump(out, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp6/r1.json", "w"), ensure_ascii=False)
