"""imp6: портфельный симулятор sim5 = agent4d_margin.sim4 + три вещи реального исполнения.
  * размазывание: доля сигнала (не обычного взноса) исполняется частями WT[0] сегодня, WT[1] завтра, WT[2] послезавтра
    (по группам плеча SPL[g] = 1); продажа — доля от монет на день сигнала, покупка — доля суммы «(act − 1) · резерв» на день сигнала
    (с тем же плечом), отложенная часть ограничена резервом дня исполнения;
  * Hyperliquid: комиссия по монете (FEES — спот, FEEP — перп), перп-монеты (PERP: DOGE, PEPE — вся позиция на перпе),
    фандинг FUND в день на номинал перп-лонгов (плечевые ноги и перп-монеты) вместо процента по долгу, фандинг шорта SHR;
    минимальный ордер MINO: обычные взносы копятся, пока не наберётся MINB, покупки и продажи меньше MINO не исполняются;
  * ликвидация как на Hyperliquid (hl=1): залог кросс-маржи = USDC (все резервы) + PnL перпов (плечевые ноги, перп-монеты, шорт);
    спотовые монеты залогом не считаются; ликвидация при залоге ≤ поддерживающей маржи Σ MM_k · номинал перпа (по минимуму дня).
    При ликвидации закрываются перпы, спот остаётся. hl=0 — как sim4 (активы/долг ≤ 1,1).
При WT=[1], FEES=FEEP=0,001, PERP=0, FUND=rate по долгу, MINO=0, hl=0 считает ровно как sim4."""
import numpy as np
from numba import njit
from agent_margin import ML, UNIT


@njit(cache=True)
def sim5(C, LO, HI, ACT, GRP, SHW, LEVM, s0, LEV, stress, sh_rate, rate,
         WT, SPL, FEES, FEEP, PERP, FUND, MINO, MINB, hl, MM, MMSH):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); pu = np.zeros(K); debt = np.zeros(K); su = np.zeros(K); stg = np.zeros(K); dca = np.zeros(K)
    NS = 4
    QS = np.zeros((NS, K)); QV = np.zeros((NS, K)); QB = np.zeros((NS, K))
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9; shpnl = 0.0; paid = 0.0; shc = 0.0; skipped = 0.0
    nw = WT.shape[0]
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
        slot = t % NS
        for k in range(K):
            p = C[t, k]
            if np.isnan(p):
                QS[slot, k] = 0.0; QV[slot, k] = 0.0; QB[slot, k] = 0.0
                continue
            inv += UNIT; before = r[k]; r[k] += UNIT
            if hl:
                if PERP[k]:
                    fnd = u[k] * p * FUND
                else:
                    fnd = pu[k] * p * FUND
                r[k] -= fnd; paid += fnd
            else:
                paid += debt[k] * rate; debt[k] *= 1 + rate
            if su[k] > 0:
                shc -= su[k] * p * sh_rate; shpnl -= su[k] * p * sh_rate
            a = ACT[t - 1, k] if t > s0 else 1.0
            g = GRP[t - 1, k] if t > s0 else 0
            lm = LEVM[t - 1, k] if t > s0 else 1.0
            sp = SPL[g] > 0 and nw > 1
            # что исполнить сегодня: отложенные части + сегодняшняя доля
            qs = QS[slot, k]; qv = QV[slot, k]; qb = QB[slot, k]
            QS[slot, k] = 0.0; QV[slot, k] = 0.0; QB[slot, k] = 0.0
            fe = FEES[k]
            if PERP[k]:
                fe = FEEP[k]
            if a < 0:
                f = -a
                w0 = WT[0] if sp else 1.0
                if sp:
                    for j in range(1, nw):
                        QS[(t + j) % NS, k] += f * WT[j] * u[k]
                qs += f * w0 * u[k]
            extra = 0.0
            if a > 1:
                extra = (a - 1) * before
                if sp:
                    for j in range(1, nw):
                        x = extra * WT[j]
                        QV[(t + j) % NS, k] += x; QB[(t + j) % NS, k] += max(0.0, (LEV[g, k] - 1) * lm * x)
                    extra *= WT[0]
            # продажа
            if qs > 0 and u[k] > 0:
                q = min(qs, u[k])
                if q * p >= MINO or q >= u[k] * 0.999:
                    fr = q / u[k]
                    if hl and not PERP[k]:
                        spu = u[k] - pu[k]
                        r[k] += fr * (spu * p * (1 - FEES[k]) + pu[k] * p * (1 - FEEP[k]) - debt[k])
                    else:
                        r[k] += fr * (u[k] * p * (1 - fe) - debt[k])
                    u[k] *= 1 - fr; pu[k] *= 1 - fr; debt[k] *= 1 - fr
                else:
                    skipped += q * p
            # покупка
            if a >= 0:
                if a >= 1 or True:
                    dca[k] += UNIT if a >= 0 else 0.0
                want = dca[k] + extra + qv
                bwant = max(0.0, (LEV[g, k] - 1) * lm) * (dca[k] + extra) + qb
                if want >= MINB or (extra + qv >= MINO):
                    v = min(r[k], want)
                    if v > 0 and v >= MINO:
                        b = bwant * v / want
                        r[k] -= v
                        if hl and not PERP[k]:
                            u[k] += v * (1 - FEES[k]) / p + b * (1 - FEEP[k]) / p; pu[k] += b * (1 - FEEP[k]) / p
                        else:
                            u[k] += (v + b) * (1 - fe) / p
                            if PERP[k]:
                                pu[k] = u[k]
                        debt[k] += b
                    dca[k] = 0.0
            else:
                if qv > 0:   # в день продажи отложенная покупка пропадает (сигналы противоположны)
                    pass
            if t > s0:
                want = SHW[t - 1, k]
                if want > stg[k] + 1e-12:
                    eq = side + shc
                    for j in range(K):
                        eq += r[j] - debt[j]
                        if not np.isnan(C[t, j]):
                            eq += u[j] * C[t, j] - su[j] * C[t, j]
                    q = (want - stg[k]) * max(eq, 0.0) / p
                    su[k] += q; shpnl -= q * p * FEEP[k]; shc += q * p * (1 - FEEP[k]); stg[k] = want
                elif want == 0 and su[k] > 0:
                    shc -= su[k] * p * (1 + FEEP[k]); shpnl -= su[k] * p * FEEP[k]; su[k] = 0.0; stg[k] = 0.0
        R = shc
        for k in range(K):
            R += r[k]
        if hl:
            av = side * 0 + R; mm = 0.0
            for k in range(K):
                if not np.isnan(C[t, k]):
                    lo = LO[t, k] * stress; hi = HI[t, k] * (2.0 - stress)
                    if PERP[k]:
                        av += u[k] * lo; mm += MM[k] * u[k] * lo
                    else:
                        av += pu[k] * lo; mm += MM[k] * pu[k] * lo
                    av -= su[k] * hi; mm += MMSH * su[k] * hi
                av -= debt[k]
            if mm > 0:
                lv = av / mm
                if lv < worst:
                    worst = lv
                if av <= mm:
                    nl += 1
                    for k in range(K):     # перпы закрыты, USDC = остаток залога; спот остаётся
                        if PERP[k]:
                            u[k] = 0.0
                        else:
                            u[k] -= pu[k]
                        pu[k] = 0.0; debt[k] = 0.0; su[k] = 0.0; stg[k] = 0.0; r[k] = 0.0
                    shc = 0.0; side += max(0.0, av - mm)
        else:
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
                        r[k] = 0.0; u[k] = 0.0; pu[k] = 0.0; debt[k] = 0.0; su[k] = 0.0; stg[k] = 0.0
                    side = max(0.0, left); shc = 0.0
    fin = side + shc
    for k in range(K):
        if not np.isnan(C[n - 1, k]):
            fin += r[k] - debt[k] + (u[k] - su[k]) * C[n - 1, k]
        else:
            fin += r[k] - debt[k]
    return nl, fin / inv - 1, worst, shpnl / inv, paid / inv, skipped / inv
