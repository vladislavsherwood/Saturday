"""imp9, круг 3: входы и выходы шорта BTC в модели Hyperliquid (без плеча, номинал шорта ≤ 1× свободного залога, 20% капитала).
Счёт: сумма лог-медиан (худший из сдвигов) по пяти портфелям; циклы: старты 2018–20 с итогом на конец 2021, старты 2022–26 до сейчас.
Запуск: python3 app/imp9_loop3.py"""
import os, sys, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from imp9_margin import HPort, SETS, scheme, hl_full, summ, BOT, c, HERE
from agent4d_margin import E21, S21, S24
BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S0 = {"base": BEST["base"], "rules": BEST["rules"]}
PS = {k: HPort(v) for k, v in SETS.items()}
S, L = scheme(S0, lev=False)
SH, CAP = float(os.environ.get("SH", 0.2)), float(os.environ.get("CAP", 1.0))
ENT = {"жадность > 75 (основа)": [[c("fng", ">", 75)]], "жадность > 80": [[c("fng", ">", 80)]], "жадность > 70": [[c("fng", ">", 70)]],
       "тихая вершина qt": [[c("qt", ">", 0.5)]], "широкая тихая вершина": [[c("btcath", "<", 15), c("oth90", ">", 1)]],
       "альтсезон oth90 > 1,5": [[c("oth90", ">", 1.5)]], "жадность > 75 или qt": [[c("fng", ">", 75)], [c("qt", ">", 0.5)]],
       "жадность > 75 или широкая": [[c("fng", ">", 75)], [c("btcath", "<", 15), c("oth90", ">", 1)]],
       "жадность > 75 и BTC у максимума < 10%": [[c("fng", ">", 75), c("btcath", "<", 10)]], "жадность > 70 и oth90 > 1": [[c("fng", ">", 70), c("oth90", ">", 1)]],
       "горячий фандинг fund30 > 2": [[c("fund30", ">", 2)]], "жадность > 75 и фандинг > 1": [[c("fng", ">", 75), c("fund30", ">", 1)]]}
X0 = BOT + [[c("btcr30", ">", 20)]]
EXI = {"дно или разворот (основа)": (X0, 0), "только дно": (BOT, 0), "основа + не дольше 90 дн": (X0, 90),
       "основа + страх < 40": (X0 + [[c("fng", "<", 40)]], 0), "основа + BTC ниже максимума > 30%": (X0 + [[c("btcath", ">", 30)]], 0)}
only = sys.argv[1:]


def score(W):
    o = {}; tot = 0.0; cyc = [0.0, 0.0]; safe = True
    for nm, P in PS.items():
        r = hl_full(P, S, L, SH, W=W, cap=CAP); o[nm] = r; safe &= r["safe"]
        tot += np.log1p(min(r["m0"], r["m1"]) / 100)
        a = min(summ(P.hl(S, L, SH, W, CAP, 0.0, lag, starts=S21, end=E21))["med"] for lag in (0, 1))
        b = min(summ(P.hl(S, L, SH, W, CAP, 0.0, lag, starts=S24))["med"] for lag in (0, 1))
        cyc[0] += np.log1p(a / 100); cyc[1] += np.log1p(b / 100); o[nm]["cyc"] = (a, b)
    return tot, cyc, safe, o


t = time.time()
P0 = PS["P9"]
s0, c0, _, _ = score(np.zeros_like(P0.W))   # без шорта: точка отсчёта
print(f"без шорта: счёт {s0:.3f}, цикл 2019–21 {c0[0]:.3f}, 2022–26 {c0[1]:.3f}", flush=True)
RES = {}
for en, ent in ENT.items():
    for xn, (ex, md) in EXI.items():
        if xn != "дно или разворот (основа)" and en not in ("жадность > 75 (основа)",) and not only:
            continue
        Ws = {nm: P.shw(ent, ex, md) for nm, P in PS.items()}
        tot = 0.0; cyc = [0.0, 0.0]; safe = True; row = {}
        for nm, P in PS.items():
            P_W = Ws[nm]; r = hl_full(P, S, L, SH, W=P_W, cap=CAP); safe &= r["safe"]
            tot += np.log1p(min(r["m0"], r["m1"]) / 100)
            a = min(summ(P.hl(S, L, SH, P_W, CAP, 0.0, lag, starts=S21, end=E21))["med"] for lag in (0, 1))
            b = min(summ(P.hl(S, L, SH, P_W, CAP, 0.0, lag, starts=S24))["med"] for lag in (0, 1))
            cyc[0] += np.log1p(a / 100); cyc[1] += np.log1p(b / 100); row[nm] = (r["m0"], r["m1"], a, b, r["hlm30"])
        days = int(Ws["P9"][:, 0].astype(bool).sum())
        RES[f"{en} | {xn}"] = dict(score=tot - s0, c21=cyc[0] - c0[0], c24=cyc[1] - c0[1], safe=bool(safe), days=days, rows=row)
        print(f"{'OK' if safe else 'ЛИКВ'} {tot - s0:+.3f} | цикл 19–21 {cyc[0] - c0[0]:+.3f}, 22–26 {cyc[1] - c0[1]:+.3f} | дней в шорте {days} | P9 {row['P9'][0]:+.0f}/{row['P9'][1]:+.0f}"
              f" (19–21 {row['P9'][2]:+.0f}, 22–26 {row['P9'][3]:+.0f}) мин.запас±30 {min(v[4] for v in row.values()):.2f} | {en} | {xn}", flush=True)
json.dump(RES, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp9_loop3.json", "w"), ensure_ascii=False)
print(f"[{time.time() - t:.0f} с]")
