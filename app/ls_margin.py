"""Лонги/шорты и плечо: схема из lev_size.py (дно 25% ×2, паника доли ×1,5 ×1,25, разворот 50% ×2) +
(а) отложенная покупка после выноса, когда толпа вышла из шортов; (б) на выносе при толпе в шортах — без плеча; (в) плечо только на отложенной.
Запуск: python3 app/ls_margin.py"""
import sys, os, json
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import lev_size as M

d = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "liq_extra.json")))
X = pd.DataFrame({k: d[k] for k in ("boic", "bls")}, index=pd.to_datetime(d["t"], unit="D"), dtype=float)
oic = X["boic"].copy(); last = np.nan
for i, v in enumerate(oic.values):
    if v > 0 and not (v < 0.7 * last): last = v
    oic.iloc[i] = last
oidd = (oic / oic.rolling(30, min_periods=1).max() - 1) * 100
lsr = X["bls"] / X["bls"].rolling(90).mean()
dly = (oidd.rolling(20).min() < -28) & (oidd > -28) & (lsr > 1.0) & (lsr.rolling(20).min() < 0.9)
dly = (dly & ~dly.shift(1, fill_value=False)).reindex(M.idx).fillna(False).values.astype(bool)
crowd = (lsr < 0.9).reindex(M.idx).fillna(False).values.astype(bool)
print(f"дней отложенной покупки: {int(dly.sum())}; дней выноса при толпе в шортах (по монетам): {int(((M.RULE == 1) & crowd[:, None]).sum())}")

ACT = np.append(M.ACT0, [1.5, 1.5]); GRP = np.append(M.GRP, [5, 6])        # 12 — отложенная (группа 5), 13 — вынос при толпе в шортах (группа 6)


def rules(add_delay, split_crowd):
    R = M.RULE.copy()
    if split_crowd:
        R[(R == 1) & crowd[:, None]] = 13
    if add_delay:
        free = (R < 0) | (R >= 2)                                         # отложенная стоит после правил дна, перед остальными
        R[dly[:, None] & free & (R != -2)] = 12
    return R


def ev(R, act, lev, rep=0.0):
    out = []
    for st in (1.0, 0.8, 0.7):
        res = [M.sim(M.C, M.LO, R, M.BOUNCE, int(s), act, GRP, np.array(lev, float), rep, st) for s in M.starts]
        out.append(res)
    x = np.array([q[1] for q in out[0]]) * 100
    return f"{np.median(x):+5.0f}% | 2022–26 {np.median(x[48:]):+4.0f}% | худшие 10% {np.percentile(x, 10):+4.0f}% | ликв. {sum(q[0] > 0 for q in out[0])}, при −20% {sum(q[0] > 0 for q in out[1])}, при −30% {sum(q[0] > 0 for q in out[2])} | мин. маржа {min(q[2] for q in out[0]):.2f}"


act = M.make_act(0.25, 1.5, 0.5); act = np.append(act, [1.5, 1.5])
L0 = [1.0] * 7
best = [1.0, 2.0, 1.25, 2.0, 1.0, 1.0, 2.0]                                # группы: взнос, дно, паника, разворот, продажа, отложенная, вынос-при-шортах
print("без плеча, как сейчас:        ", ev(rules(False, False), np.append(M.make_act(0.375, 1, 1), [1.5, 1.5]), L0))
print("схема плеча (lev_size):        ", ev(rules(False, False), act, best))
for g in (1.25, 1.5, 2.0):
    a = act.copy(); a[12] = g
    for ld in (1.0, 2.0):
        lv = list(best); lv[5] = ld
        print(f"+ отложенная {int((g - 1) * 100)}% ×{ld:g}:            ", ev(rules(True, False), a, lv))
for lc in (1.0, 1.5):
    lv = list(best); lv[6] = lc
    print(f"вынос при толпе в шортах ×{lc:g}:   ", ev(rules(False, True), act, lv))
    for g in (1.5, 2.0):
        a = act.copy(); a[12] = g; lv2 = list(lv); lv2[5] = 2.0
        print(f"  + отложенная {int((g - 1) * 100)}% ×2:        ", ev(rules(True, True), a, lv2))
