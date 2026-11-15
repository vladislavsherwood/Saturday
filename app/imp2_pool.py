"""imp2 (простаивающий резерв), круг 3: общий резерв на все монеты портфеля и доход на резерв — копия agent4d_margin.sim4 с двумя добавками.
  lam  — общий резерв: доля покупки из резерва считается не от резерва монеты, а от общего резерва счёта P (сумма резервов монет на начало дня):
         база = (1 − lam) · P / K + lam · P / n_sig, где K — монеты, торгующиеся в этот день, n_sig — монеты с сигналом покупки из резерва
         (act > 1) в этот день. lam = 0 — «справедливая доля» общего резерва, lam = 1 — весь общий резерв делится между монетами с сигналом
         (резерв монет без сигналов перекладывается в монеты с сигналом). Покупка не больше остатка общего резерва (без плеча займа не возникает).
         pool = 0 — как sim4 (резерв каждой монеты отдельно).
  yld  — доход на положительный общий резерв, в день (годовые / 365).
Без плеча и шорта по умолчанию; с плечом — те же группы и матрица плеча, что в combo_margin (долг по монете считается как в sim4).
Использование: python3 app/imp2_pool.py"""
import sys, os, json, time
import numpy as np
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_margin import Port, SETS, scheme, BOT, c, HERE, YEARS  # noqa: F401
from agent4d_margin import STARTS, shift, safe
from agent_margin import ML, FEE, UNIT


@njit(cache=True)
def simp(C, LO, HI, ACT, GRP, SHW, s0, LEV, stress, sh_rate, rate, pool, lam, yld, AGE, amin):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K); su = np.zeros(K); stg = np.zeros(K)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9; shpnl = 0.0; paid = 0.0; shc = 0.0
    for t in range(s0, n):
        tot = 0.0
        for k in range(K):
            tot += r[k]
        if shc < 0:
            fee = -shc * rate; paid += fee; shc -= fee
        if tot < 0:
            fee = -tot * rate; paid += fee; neg = 0.0
            for k in range(K):
                if r[k] < 0:
                    neg += r[k]
            for k in range(K):
                if r[k] < 0:
                    r[k] -= fee * r[k] / neg
        elif yld > 0 and tot > 0:                  # доход на общий положительный резерв, раздаётся пропорционально положительным резервам монет
            sp = 0.0
            for k in range(K):
                if r[k] > 0:
                    sp += r[k]
            for k in range(K):
                if r[k] > 0:
                    r[k] += tot * yld * r[k] / sp
        P0 = 0.0; ka = 0; ns = 0
        if pool and t > s0:
            for k in range(K):
                P0 += r[k]
                if not np.isnan(C[t, k]) and AGE[t, k] >= amin:
                    ka += 1
                    if ACT[t - 1, k] > 1:
                        ns += 1
            if P0 < 0:
                P0 = 0.0
        for k in range(K):
            p = C[t, k]
            if np.isnan(p):
                continue
            inv += UNIT; before = r[k]; r[k] += UNIT
            paid += debt[k] * rate; debt[k] *= 1 + rate
            if su[k] > 0:
                shc -= su[k] * p * sh_rate; shpnl -= su[k] * p * sh_rate
            a = ACT[t - 1, k] if t > s0 else 1.0
            g = GRP[t - 1, k] if t > s0 else 0
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - f; debt[k] *= 1 - f
            else:
                young = AGE[t, k] < amin
                if pool and a > 1 and not young:
                    base = (1 - lam) * P0 / max(ka, 1) + lam * P0 / max(ns, 1)
                    cur = 0.0
                    for j in range(K):
                        cur += r[j]
                    v = min(max(cur, 0.0), UNIT + (a - 1) * base)
                elif pool and not young:
                    cur = 0.0
                    for j in range(K):
                        cur += r[j]
                    v = min(max(cur, 0.0), UNIT + (a - 1) * max(before, 0.0))
                else:
                    v = min(r[k], UNIT + (a - 1) * before) if not (pool and young) else min(max(r[k], 0.0), UNIT + (a - 1) * max(before, 0.0))
                if v > 0:
                    b = (LEV[g, k] - 1) * v
                    if b < 0:
                        b = 0.0
                    r[k] -= v; u[k] += (v + b) * (1 - FEE) / p; debt[k] += b
            if t > s0:
                want = SHW[t - 1, k]
                if want > stg[k] + 1e-12:
                    eq = side + shc
                    for j in range(K):
                        eq += r[j] - debt[j]
                        if not np.isnan(C[t, j]):
                            eq += u[j] * C[t, j] - su[j] * C[t, j]
                    q = (want - stg[k]) * max(eq, 0.0) / p
                    su[k] += q; shpnl -= q * p * FEE; shc += q * p * (1 - FEE); stg[k] = want
                elif want == 0 and su[k] > 0:
                    shc -= su[k] * p * (1 + FEE); shpnl -= su[k] * p * FEE; su[k] = 0.0; stg[k] = 0.0
        R = shc
        for k in range(K):
            R += r[k]
        assets = side + max(R, 0.0); D = max(-R, 0.0)
        for k in range(K):
            if not np.isnan(C[t, k]):
                assets += u[k] * LO[t, k] * stress
                D += su[k] * HI[t, k] * (2.0 - stress)
            D += debt[k]
        if D > 0:
            lv = assets / D
            if lv < worst:
                worst = lv
            if lv <= ML:
                nl += 1; left = assets - D
                for k in range(K):
                    r[k] = 0.0; u[k] = 0.0; debt[k] = 0.0; su[k] = 0.0; stg[k] = 0.0
                side = max(0.0, left); shc = 0.0
    fin = side + shc
    for k in range(K):
        if not np.isnan(C[n - 1, k]):
            fin += r[k] - debt[k] + (u[k] - su[k]) * C[n - 1, k]
        else:
            fin += r[k] - debt[k]
    return nl, fin / inv - 1, worst, shpnl / inv, paid / inv


def age(P):
    if not hasattr(P, "_age"):
        C = P.B.C; A = np.zeros(C.shape)
        for k in range(C.shape[1]):
            d = 0
            for t in range(C.shape[0]):
                d = d + 1 if not np.isnan(C[t, k]) else 0
                A[t, k] = d
        P._age = A
    return P._age


def runp(P, S, L, sh=0.0, lag=0, rate=0.0003, pool=0, lam=0.0, yld=0.0, stress=True, amin=0):
    """Медиана 105 стартов, худшие 10%, запас, ликвидации (и в стрессе −20/−30%), итоги стартов."""
    A, G = P.plan(S); SH = P.W * sh if sh else np.zeros(P.B.C.shape)
    if lag:
        A, G, SH = shift(A, lag, 1.0), shift(G, lag, 0), shift(SH, lag)
    Lm = P.B.levmat(L); B = P.B
    R = [simp(B.C, B.LO, B.HI, A, G, SH, int(s), Lm, 1.0, 0.15 / 365, rate, pool, lam, yld / 365, age(P), amin) for s in STARTS]
    x = np.array([q[1] for q in R]) * 100
    o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)), "x": x}
    if stress and o["liq"] == 0 and (sh or max(L) > 1):
        for sv, key in ((0.8, "l20"), (0.7, "l30")):
            o[key] = int(sum(simp(B.C, B.LO, B.HI, A, G, SH, int(s), Lm, sv, 0.15 / 365, rate, pool, lam, yld / 365, age(P), amin)[0] > 0 for s in STARTS))
    return o
