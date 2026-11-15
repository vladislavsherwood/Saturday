"""imp6, итог: схемы маржи, устойчивые к дню исполнения, для двух основ (combo-best и combo2-best) на пяти портфелях.
Модель sim4/sim5: исполнение −1 (по закрытию дня решения), в срок, +1 день; стресс −20/−30%; ставка 11% и 15%; худшие 10% стартов.
Реальные условия Hyperliquid: всё на перпах (1× + плечо), комиссии 0,07/0,045%, фандинг 6% и 10% годовых на весь номинал, минимальный ордер $10,
ликвидация по залогу USDC + PnL перпов. OI Binance на день позже. Сохраняет found/imp6-best.json и found/imp6-best-margin.json."""
import os, json, time
import numpy as np
import combo2_margin  # noqa: F401  индикаторы combo2 (isbig, meme, isalt, corr180, vol180)
from imp6_common import LP, SETS, run5, scheme, HERE
import imp6_r4 as R4

t = time.time()
B1 = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
B2 = json.load(open(os.path.join(HERE, "found", "combo2-best.json")))
BASES = {"combo-best": {"base": B1["base"], "rules": B1["rules"]}, "combo2-best": {"base": B2["base"], "rules": B2["rules"]}}
SPLIT = [1 if g in (1, 2, 5, 7, 4) else 0 for g in range(8)]
SCH = {"основа ×1,4 (лучшая безопасная combo)": (dict(D=60, lp=1.4, lr=1.5), (1.0,)),
       "×1,35 без размазывания": (dict(D=60, lp=1.35, lr=1.5), (1.0,)),
       "50/50 ×1,3 (дно, паника, продажи — половина в день исполнения, половина на следующий)": (dict(D=60, lp=1.3, lr=1.5), (0.5, 0.5)),
       "без плеча": (dict(lev=False), (1.0,))}
HL = dict(hlx=True, hl=2, shr=0.0, mino=10.0, minb=11.0, perp_all=True)
COND = {"модель": {}, "модель, ставка 15%": dict(rate=0.15 / 365), "HL, фандинг 6%": dict(HL, fund=0.06 / 365), "HL, фандинг 10%": dict(HL, fund=0.10 / 365)}
PS = {k: LP(v) for k, v in SETS.items()}
PL = {k: R4.port(v, 1) for k, v in SETS.items()}
RES = {}
for bn, S0 in BASES.items():
    for sn, (sk, WT) in SCH.items():
        S, L = scheme(S0, **sk); SPL = SPLIT if len(WT) > 1 else [0] * 8; shw = 0.2 if sk.get("lev", True) else 0.0
        for cn, kw in list(COND.items()) + [("модель, OI на день позже", {})]:
            if sn == "без плеча" and cn.startswith("HL"):
                kw = dict(kw, perp_all=False)
            row = {}
            for nm in SETS:
                P = PL[nm] if "OI" in cn else PS[nm]
                rate = kw.get("rate", 0.0003); kk = {k: v for k, v in kw.items() if k != "rate"}
                ms, p10, bad, lv = [], [], [], 99
                for lag in (-1, 0, 1):
                    A, G = P.mats(S, all_lag=lag)
                    o = run5(P, A, G, L, shw, sh_lag=lag, rate=rate, WT=WT, SPL=SPL, **kk)
                    ms.append(round(o["med"], 1)); p10.append(round(o["p10"], 1)); lv = min(lv, o["lvl"])
                    if o["liq"] or o.get("l20") or o.get("l30"): bad.append([lag, o["liq"], o.get("l20"), o.get("l30")])
                row[nm] = {"m-1": ms[0], "m0": ms[1], "m+1": ms[2], "mean": round(float(np.mean(ms)), 1), "worst": min(ms), "p10": p10, "lvl": round(min(lv, 99), 2), "liq": bad, "safe": not bad}
            RES.setdefault(bn, {}).setdefault(sn, {})[cn] = row
            print(f"{bn:11s} | {sn[:22]:22s} | {cn:24s} | " + " | ".join(f"{nm} {o['m-1']:+.0f}/{o['m0']:+.0f}/{o['m+1']:+.0f}{'' if o['safe'] else ' ✘'}" for nm, o in row.items()), f"[{time.time() - t:.0f} с]", flush=True)
json.dump(RES, open(os.path.join(HERE, "..", "app", "found", "imp6_results_tmp.json"), "w"), ensure_ascii=False)
