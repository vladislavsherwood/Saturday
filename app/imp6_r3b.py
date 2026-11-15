"""imp6, круг 3б: что безопасно реализуемо на Hyperliquid (ликвидация по залогу USDC + PnL перпов). Варианты: шорт отдельно, залог плеча,
всё на перпах при фандинге 6% и 10% годовых, без плеча. Сдвиги −1/0/+1, стресс −20/−30%."""
import time
import numpy as np
from imp6_common import LP, SETS, BEST, run5, scheme

t = time.time()
PS = {k: LP(v) for k, v in SETS.items()}
S0 = {"base": BEST["base"], "rules": BEST["rules"]}
SPLIT = [1 if g in (1, 2, 5, 7, 4) else 0 for g in range(8)]
HL = dict(hlx=True, hl=2, shr=0.0, mino=10.0, minb=11.0)
V = [("без плеча, спот, без шорта", dict(lev=False), 0.0, (1.0,), dict(HL, fund=0.1 / 365)),
     ("без плеча, спот, шорт 20%", dict(lev=False), 0.2, (1.0,), dict(HL, fund=0.1 / 365)),
     ("без плеча, спот, шорт 10%", dict(lev=False), 0.1, (1.0,), dict(HL, fund=0.1 / 365)),
     ("×1,35, залог 1:1, без шорта", dict(D=60, lp=1.35, lr=1.5), 0.0, (1.0,), dict(HL, fund=0.1 / 365, xc=1.0)),
     ("×1,35, залог 2:1, без шорта", dict(D=60, lp=1.35, lr=1.5), 0.0, (1.0,), dict(HL, fund=0.1 / 365, xc=2.0)),
     ("×1,35, всё на перпах, фандинг 10%, шорт 20%", dict(D=60, lp=1.35, lr=1.5), 0.2, (1.0,), dict(HL, fund=0.1 / 365, perp_all=True)),
     ("×1,35, всё на перпах, фандинг 6%, шорт 20%", dict(D=60, lp=1.35, lr=1.5), 0.2, (1.0,), dict(HL, fund=0.06 / 365, perp_all=True)),
     ("×1,4, всё на перпах, фандинг 6%, шорт 20%", dict(D=60, lp=1.4, lr=1.5), 0.2, (1.0,), dict(HL, fund=0.06 / 365, perp_all=True)),
     ("50/50 ×1,3, всё на перпах, фандинг 6%, шорт 20%", dict(D=60, lp=1.3, lr=1.5), 0.2, (0.5, 0.5), dict(HL, fund=0.06 / 365, perp_all=True)),
     ("50/50 ×1,4, всё на перпах, фандинг 6%, шорт 20%", dict(D=60, lp=1.4, lr=1.5), 0.2, (0.5, 0.5), dict(HL, fund=0.06 / 365, perp_all=True)),
     ("модель: ×1,35 (sim4-условия)", dict(D=60, lp=1.35, lr=1.5), 0.2, (1.0,), {})]
for tag, sk, shw, WT, kw in V:
    S, L = scheme(S0, **sk)
    SPL = SPLIT if len(WT) > 1 else [0] * 8
    out = []
    for nm, P in PS.items():
        ms, bad, lv = [], [], 99
        for lag in (-1, 0, 1):
            A, G = P.mats(S, all_lag=lag)
            o = run5(P, A, G, L, shw, sh_lag=lag, WT=WT, SPL=SPL, **kw)
            ms.append(o["med"]); lv = min(lv, o["lvl"])
            if o["liq"] or o.get("l20") or o.get("l30"): bad.append((lag, o["liq"], o.get("l20"), o.get("l30")))
        out.append(f"{nm} {ms[0]:+.0f}/{ms[1]:+.0f}/{ms[2]:+.0f} {'✘' + str(bad) if bad else 'ok'} {min(lv, 99):.2f}")
    print(f"{tag:46s} | " + " | ".join(out), f"[{time.time() - t:.0f} с]", flush=True)
