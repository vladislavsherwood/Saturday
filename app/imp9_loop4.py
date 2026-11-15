"""imp9, круг 4: размер шорта BTC (10–30% капитала) × потолок номинала по свободному залогу USDC (0,5/0,75/1×) для входов
«жадность > 75» и «жадность > 75 или qt»; устойчивость по циклам. Без плеча, модель Hyperliquid (строгий режим), пять портфелей.
Запуск: python3 app/imp9_loop4.py"""
import os, sys, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from imp9_margin import HPort, SETS, scheme, hl_full, summ, BOT, c, HERE
from agent4d_margin import E21, S21, S24
BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S0 = {"base": BEST["base"], "rules": BEST["rules"]}
PS = {k: HPort(v) for k, v in SETS.items()}
S, L = scheme(S0, lev=False)
X0 = BOT + [[c("btcr30", ">", 20)]]
ENT = {"жадность > 75": [[c("fng", ">", 75)]], "жадность > 75 или qt": [[c("fng", ">", 75)], [c("qt", ">", 0.5)]]}


def ev(W, sh, cap):
    tot = 0.0; cyc = [0.0, 0.0]; safe = True; row = {}; m30 = 99.0
    for nm, P in PS.items():
        w = W[nm]
        r = hl_full(P, S, L, sh, W=w, cap=cap, years=(nm == "P9")); safe &= r["safe"]; m30 = min(m30, r["hlm30"])
        tot += np.log1p(min(r["m0"], r["m1"]) / 100)
        a = min(summ(P.hl(S, L, sh, w, cap, 0.0, lag, starts=S21, end=E21))["med"] for lag in (0, 1))
        b = min(summ(P.hl(S, L, sh, w, cap, 0.0, lag, starts=S24))["med"] for lag in (0, 1))
        cyc[0] += np.log1p(a / 100); cyc[1] += np.log1p(b / 100); row[nm] = dict(m0=r["m0"], m1=r["m1"], p10=r["p10"], c21=a, c24=b, hlm30=r["hlm30"], hlm=r["hlm"], worst=r["worst"])
        if nm == "P9":
            row[nm]["by_year"] = r["by_year"]
    return tot, cyc, bool(safe), m30, row


t = time.time()
Z = {nm: np.zeros_like(P.W) for nm, P in PS.items()}
s0, c0, _, _, r0 = ev(Z, 0.0, 0.0)
print(f"без шорта: P9 {r0['P9']['m0']:+.0f}/{r0['P9']['m1']:+.0f}", flush=True)
RES = {"none": dict(score=s0, c21=c0[0], c24=c0[1], rows=r0)}
for en, ent in ENT.items():
    W = {nm: P.shw(ent, X0) for nm, P in PS.items()}
    for cap in (0.5, 0.75, 1.0):
        for sh in (0.1, 0.15, 0.2, 0.25, 0.3, 1.0):
            tot, cyc, safe, m30, row = ev(W, sh, cap)
            k = f"{en} | {sh:.0%} | потолок {cap}×"
            RES[k] = dict(score=tot - s0, c21=cyc[0] - c0[0], c24=cyc[1] - c0[1], safe=safe, m30=m30, rows=row)
            print(f"{'OK' if safe else 'ЛИКВ'} {tot - s0:+.3f} | 19–21 {cyc[0] - c0[0]:+.3f}, 22–26 {cyc[1] - c0[1]:+.3f} | запас ±30 {m30:.2f} | P9 {row['P9']['m0']:+.0f}/{row['P9']['m1']:+.0f}"
                  f" (19–21 {row['P9']['c21']:+.0f}, 22–26 {row['P9']['c24']:+.0f}) | B {row['B']['m0']:+.0f} M {row['M']['m0']:+.0f} P2 {row['P2+BTC']['m0']:+.0f} P3 {row['P3+BTC']['m0']:+.0f} | {k}", flush=True)
json.dump(RES, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp9_loop4.json", "w"), ensure_ascii=False, default=float)
print(f"[{time.time() - t:.0f} с]")
