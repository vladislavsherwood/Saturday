"""imp6, круг 2: размазывание сигнальных сделок на 2–3 дня (sim5, WT/SPL) — устойчивость к дню исполнения.
Для каждого варианта: медиана при исполнении −1 (по закрытию дня решения), в срок, +1, +2 дня; ликвидации/стресс в срок и +1."""
import sys, time
import numpy as np
from imp6_common import LP, SETS, S_BEST, L_BEST, SH_BEST, run5

t = time.time()
PS = {k: LP(v) for k, v in SETS.items()}
PAN, BOT_, SELL, REV = [2, 5, 7], [1], [4], [3]
V = [("основа", (1.0,), []),
     ("паника 50/50", (0.5, 0.5), PAN), ("паника+дно 50/50", (0.5, 0.5), PAN + BOT_),
     ("паника+дно+разворот 50/50", (0.5, 0.5), PAN + BOT_ + REV), ("все сигналы 50/50", (0.5, 0.5), PAN + BOT_ + REV + SELL + [6]),
     ("паника+дно 1/3×3", (1 / 3, 1 / 3, 1 / 3), PAN + BOT_), ("паника+дно 60/40", (0.6, 0.4), PAN + BOT_), ("паника+дно 40/60", (0.4, 0.6), PAN + BOT_),
     ("продажи 50/50", (0.5, 0.5), SELL), ("паника+дно 50/50 + продажи 50/50", (0.5, 0.5), PAN + BOT_ + SELL)]
only = sys.argv[1:]
PB = PAN + BOT_
V2 = [("основа", (1.0,), []), ("паника+дно 50/50 (вторая часть без плеча)", (0.5, 0.5), PB, 0.0),
      ("паника+дно 50/50 (вторая часть без плеча) + продажи 50/50", (0.5, 0.5), PB + SELL, 0.0),
      ("паника+дно 1/3×3 (без плеча) + продажи 50/50 — нет, всё 1/3", (1 / 3, 1 / 3, 1 / 3), PB + SELL, 0.0),
      ("паника+дно 50/50 (плечо второй ×0,5) + продажи 50/50", (0.5, 0.5), PB + SELL, 0.5),
      ("продажи 1/3×3", (1 / 3, 1 / 3, 1 / 3), SELL),
      ("все сигналы 50/50 (вторая часть без плеча)", (0.5, 0.5), PB + SELL + REV + [6], 0.0)]
V = V if not only or only[0] != "b" else V2
for tag, WT, grp, *ex in V:
    ld = ex[0] if ex else 1.0
    if only and only[0] != 'b' and tag not in only: continue
    SPL = [1 if g in grp else 0 for g in range(8)]
    row = []
    for nm, P in PS.items():
        ms = []
        for lag in (-1, 0, 1, 2):
            A, G = P.mats(S_BEST, all_lag=lag)
            o = run5(P, A, G, L_BEST, SH_BEST, sh_lag=lag, stress=lag in (-1, 0, 1), WT=WT, SPL=SPL, ld=ld)
            ms.append(o["med"]); 
            if lag in (-1, 0, 1): ms.append((o["liq"], o.get("l20"), o.get("l30"), round(o["lvl"], 2)))
        row.append((nm, ms))
    print(f"\n== {tag}  [{time.time() - t:.0f} с]")
    for nm, ms in row:
        m = [ms[0], ms[2], ms[4], ms[6]]
        liq = ms[1][:3] + ms[3][:3] + ms[5][:3]; lvl = min(ms[1][3], ms[3][3], ms[5][3])
        print(f"  {nm:7s} −1 {m[0]:+6.0f} | 0 {m[1]:+6.0f} | +1 {m[2]:+6.0f} | +2 {m[3]:+6.0f} | среднее(0,+1) {np.mean(m[1:3]):+6.0f} мин(0,+1) {min(m[1:3]):+6.0f} "
              f"среднее(−1..+1) {np.mean(m[:3]):+6.0f} | {'0 ликв.' if not any(liq) else 'ЛИКВ ' + str(liq)} запас {lvl:.2f}", flush=True)
