"""imp9, круг 5 (итог): выбранный шорт BTC (жадность > 75, 15% капитала, номинал ≤ 0,5× свободного залога USDC, выход — дно или разворот)
по правилам Hyperliquid: заём BTC 15% против реального фандинга перпа; стресс до +50%; режим real для P9; поверх combo-best и combo2-best.
Сохраняет found/imp9-best.json и found/imp9-best-margin.json. Запуск: python3 app/imp9_loop5.py"""
import os, sys, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import combo2_margin  # noqa: F401  индикаторы и флаги списков combo2 (corr180, vol180, isbig/meme/isalt, b_bbwp, b_w20)
from imp9_margin import HPort, SETS, scheme, hl_full, summ, BOT, c, HERE
from agent4d_margin import E21, S21, S24
J = lambda f: json.load(open(os.path.join(HERE, "found", f)))  # noqa: E731
B1 = J("combo-best.json"); B2 = J("combo2-best.json")
BASES = {"combo-best": {"base": B1["base"], "rules": B1["rules"]}, "combo2-best": {"base": B2["base"], "rules": B2["rules"]}}
PS = {k: HPort(v) for k, v in SETS.items()}
X0 = BOT + [[c("btcr30", ">", 20)]]
E75 = [[c("fng", ">", 75)]]; EQ = [[c("fng", ">", 75)], [c("qt", ">", 0.5)]]
W75 = {nm: P.shw(E75, X0) for nm, P in PS.items()}; WQ = {nm: P.shw(EQ, X0) for nm, P in PS.items()}
CFG = [("без шорта", None, 0.0, 0.0, False), ("шорт основы 20% без потолка, заём 15%", W75, 0.2, 0.0, False),
       ("ВЫБОР: 15%, ≤ 0,5× USDC, заём 15%", W75, 0.15, 0.5, False), ("ВЫБОР: 15%, ≤ 0,5× USDC, фандинг перпа", W75, 0.15, 0.5, True),
       ("20%, ≤ 0,5× USDC, фандинг", W75, 0.2, 0.5, True), ("20%, ≤ 0,75× USDC, фандинг", W75, 0.2, 0.75, True),
       ("жадность > 75 или qt, 20%, ≤ 0,5× USDC, фандинг", WQ, 0.2, 0.5, True)]
OUT = {}
t = time.time()
for bn, S0 in BASES.items():
    S, L = scheme(S0, lev=False); OUT[bn] = {}
    for tag, W, sh, cap, fund in CFG:
        row = {}; tot = 0.0; cyc = [0.0, 0.0]; safe = True
        for nm, P in PS.items():
            w = np.zeros_like(P.W) if W is None else W[nm]
            r = hl_full(P, S, L, sh, W=w, cap=cap, fund=fund, years=(nm == "P9"), stresses=(1.0, 0.8, 0.7, 0.5) if "ВЫБОР" in tag else (1.0, 0.8, 0.7))
            a = min(summ(P.hl(S, L, sh, w, cap, 0.0, lag, starts=S21, end=E21, fund=fund))["med"] for lag in (0, 1))
            b = min(summ(P.hl(S, L, sh, w, cap, 0.0, lag, starts=S24, fund=fund))["med"] for lag in (0, 1))
            r["c21"], r["c24"] = a, b; safe &= r["safe"]; row[nm] = r
            tot += np.log1p(min(r["m0"], r["m1"]) / 100); cyc[0] += np.log1p(a / 100); cyc[1] += np.log1p(b / 100)
        if "ВЫБОР" in tag and "фандинг" in tag:
            row["P9 real"] = hl_full(PS["P9"], S, L, sh, W=W["P9"], cap=cap, fund=fund, mode="real")
        OUT[bn][tag] = {"score": tot, "c21": cyc[0], "c24": cyc[1], "safe": bool(safe), "rows": row}
        print(f"{bn} | {'OK' if safe else 'ЛИКВ'} счёт {tot:.3f} (19–21 {cyc[0]:.3f}, 22–26 {cyc[1]:.3f}) | {tag}", flush=True)
        for nm, r in row.items():
            print(f"     {nm:8s} в срок {r['m0']:+.0f}% | +1 день {r['m1']:+.0f}% | худшие 10% {r['p10']:+.0f}% | 2019–21 {r.get('c21', float('nan')):+.0f}%, 2022–26 {r.get('c24', float('nan')):+.0f}%"
                  f" | запас при макс. стресса {min(r['hlm30'], 99):.2f} | {'0 ликв.' if r['safe'] else 'ЛИКВ ' + str(r['liq'])}", flush=True)
print(f"[{time.time() - t:.0f} с]")
json.dump(OUT, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp9_loop5.json", "w"), ensure_ascii=False, default=float)
