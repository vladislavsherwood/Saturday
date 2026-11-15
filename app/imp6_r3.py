"""imp6, круг 3: стратегия в условиях Hyperliquid (sim5). Шаги: модель → комиссии HL (спот 0,07%, перп 0,045%) → DOGE/PEPE на перпе
с фандингом на весь номинал (плечевые ноги тоже платят фандинг вместо 11% по долгу; шорт BTC без платы за заём) → минимальный ордер $10
(взносы копятся до $11) → ликвидация по залогу USDC + PnL перпов (спот залогом не считается). Сдвиги −1 / 0 / +1, стресс −20/−30%."""
import sys, time
import numpy as np
from imp6_common import LP, SETS, BEST, run5, scheme

t = time.time()
PS = {k: LP(v) for k, v in SETS.items()}
S0 = {"base": BEST["base"], "rules": BEST["rules"]}
SPLIT = [1 if g in (1, 2, 5, 7, 4) else 0 for g in range(8)]
FY = float(sys.argv[1]) if len(sys.argv) > 1 else 0.10
STEPS = [("модель", {}), ("+ комиссии HL", dict(hlx=True, perp=None)),
         (f"+ DOGE/PEPE перп, фандинг {FY:.0%}", dict(hlx=True, hl=1, fund=FY / 365, shr=0.0)),
         ("+ минимум $10", dict(hlx=True, hl=1, fund=FY / 365, shr=0.0, mino=10.0, minb=11.0)),
         ("+ ликвидация HL", dict(hlx=True, hl=2, fund=FY / 365, shr=0.0, mino=10.0, minb=11.0)),
         ("+ ликвидация HL, залог плеча 1:1 (XC=1)", dict(hlx=True, hl=2, fund=FY / 365, shr=0.0, mino=10.0, minb=11.0, xc=1.0)),
         ("+ ликвидация HL, залог плеча 1:3 (XC=0,33)", dict(hlx=True, hl=2, fund=FY / 365, shr=0.0, mino=10.0, minb=11.0, xc=1 / 3)),
         ("+ ликвидация HL, все альты на перпах", dict(hlx=True, hl=2, fund=FY / 365, shr=0.0, mino=10.0, minb=11.0, perp_all=True))]
SCH = [("основа ×1,4", 1.4, (1.0,), [0] * 8), ("основа ×1,35", 1.35, (1.0,), [0] * 8), ("50/50 ×1,3", 1.3, (0.5, 0.5), SPLIT)]
for stag, lp, WT, SPL in SCH:
    S, L = scheme(S0, D=60, lp=lp, lr=1.5)
    print(f"\n=== {stag}")
    for tag, kw in STEPS:
        kw = {k: v for k, v in kw.items() if k != "perp" or v is not None}
        out = []
        for nm, P in PS.items():
            ms, bad, lv, sk = [], [], 99, []
            for lag in (-1, 0, 1):
                A, G = P.mats(S, all_lag=lag)
                o = run5(P, A, G, L, 0.2, sh_lag=lag, WT=WT, SPL=SPL, **kw)
                ms.append(o["med"]); lv = min(lv, o["lvl"]); sk.append(o["skip"])
                if o["liq"] or o.get("l20") or o.get("l30"): bad.append((lag, o["liq"], o.get("l20"), o.get("l30")))
            out.append(f"{nm} {ms[0]:+.0f}/{ms[1]:+.0f}/{ms[2]:+.0f} {'✘' + str(bad) if bad else 'ok'} {min(lv, 99):.2f}")
        print(f"  {tag:38s} | " + " | ".join(out), f"[{time.time() - t:.0f} с]", flush=True)
