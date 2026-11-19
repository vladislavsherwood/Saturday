"""wk: маржинальный симулятор с «ловушкой для фитилей» — копия bybit_msim.sim6 (перпы Bybit, минимум max($5, 0,01 монеты) при MINO > 0;
при MINO = 0 и без перпов считает как combo3_msim.sim6) + лимитные заявки ниже рынка из своего резерва монеты:
  WK, WF — уровни (доли падения от опорной цены) и доли резерва на момент выставления; WEV — обновлять раз в WEV дней (день выставления —
  DAYN % WEV == 0, как в стенде panicx_sim); уровень исполняется раз за окно; WAGE[k] — с какого дня у монеты заявки (возраст > 60 дн);
  WST — стресс-тест: 0 — заявки исполняются по настоящему минимуму, проверка по минимуму со стрессом; 1 — исполнять по минимуму со стрессом
  (даёт ловушке ложную выгоду: купить на −30% от закрытия, которое не изменилось, — не использовать); 2 — как 0 + проверка «в худший момент»
  (все заявки, до которых достал бы минимум со стрессом, исполнены прямо перед проверкой); WFEE — комиссия заявки; WEXIT — продать купленное на фитиле при возврате к опорной цене;
  WMIN — заявки меньше минимума Bybit объединять с более глубоким уровнем; WGD — не ставить заявки по монете, пока по ней есть заём.
Возврат: как sim6 + (траты ловушки / вложено, число исполнений). При WK пустом считает ровно как bybit_msim.sim6."""
import numpy as np
from numba import njit
from agent_margin import ML, UNIT


@njit(cache=True)
def sim6w(C, LO, HI, ACT, GRP, SHW, LEVM, s0, LEV, stress, sh_rate, rate,
          WT, SPL, FEES, FEEP, PERP, FUND, MINO, MINB, hl, MM, MMSH, LD, XC, YLD, MK,
          WK, WF, WEV, DAYN, WAGE, WST, WFEE, WEXIT, WMIN, WGD):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); pu = np.zeros(K); debt = np.zeros(K); su = np.zeros(K); stg = np.zeros(K); dca = np.zeros(K); col = np.zeros(K)
    NS = 4
    QS = np.zeros((NS, K)); QV = np.zeros((NS, K)); QB = np.zeros((NS, K))
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9; shpnl = 0.0; paid = 0.0; shc = 0.0; skipped = 0.0
    nw = WT.shape[0]
    # wk: состояние ловушки — окно заявок (день выставления), исполненные уровни, суммы заявок, опорная цена, лоты для выхода
    NL = WK.shape[0]
    wjj = np.full(K, -10 ** 9); wdone = np.zeros((K, max(NL, 1))); wamt = np.zeros((K, max(NL, 1))); wref = np.zeros(K)
    wlu = np.zeros((K, max(NL, 1))); wlr = np.zeros((K, max(NL, 1))); wld = np.zeros((K, max(NL, 1))); wsp = 0.0; wcnt = 0
    vsk = np.zeros(K); vuk = np.zeros(K)
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
        elif YLD > 0 and tot > 0:
            sp = 0.0
            for k in range(K):
                if r[k] > 0:
                    sp += r[k]
            for k in range(K):
                if r[k] > 0:
                    r[k] += tot * YLD * r[k] / sp
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
            if WEXIT > 0 and NL > 0:   # wk: лимит на продажу купленного на фитиле — возврат к опорной цене (со следующего дня)
                for q in range(NL):
                    if wlu[k, q] > 0 and wld[k, q] < t and HI[t, k] >= wlr[k, q]:
                        av_u = u[k] - pu[k] if (hl and not PERP[k]) else u[k]
                        uu = min(wlu[k, q], max(av_u, 0.0))
                        if uu > 0:
                            r[k] += uu * wlr[k, q] * (1 - WFEE); u[k] -= uu
                            if PERP[k]:
                                pu[k] = u[k]
                        wlu[k, q] = 0.0
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
                        QV[(t + j) % NS, k] += x; QB[(t + j) % NS, k] += max(0.0, (LEV[g, k] - 1) * lm * x) * LD
                    extra *= WT[0]
            # продажа
            if qs > 0 and u[k] > 0:
                q = min(qs, u[k])
                if MINO > 0:   # продажа: шаг количества 0,01 монеты (в единицах симулятора — 0,01 × MK), округление вниз; меньше шага — не продаётся
                    stp = 0.01 * MK[k]
                    if q < u[k] * 0.999:
                        q = np.floor(q / stp) * stp
                if q > 0:
                    fr = q / u[k]
                    if hl and not PERP[k]:
                        spu = u[k] - pu[k]
                        r[k] += fr * (spu * p * (1 - FEES[k]) + pu[k] * p * (1 - FEEP[k]) - debt[k] + col[k]); col[k] *= 1 - fr
                    else:
                        r[k] += fr * (u[k] * p * (1 - fe) - debt[k])
                    u[k] *= 1 - fr; pu[k] *= 1 - fr; debt[k] *= 1 - fr
                    for q in range(NL):
                        wlu[k, q] *= 1 - fr
                else:
                    skipped += q * p
            # покупка
            if a >= 0:
                if a >= 1 or True:
                    dca[k] += UNIT if a >= 0 else 0.0
                want = dca[k] + extra + qv
                bwant = max(0.0, (LEV[g, k] - 1) * lm) * (dca[k] + extra) + qb
                mn = MK[k] * max(5.0, 0.01 * p) if MINO > 0 else 0.0   # Bybit перп: открытие от max($5, 0,01 монеты); MK — единиц симулятора на $1 пользователя
                if want >= mn:
                    v = min(r[k], want)
                    if v > 0 and v >= mn:
                        b = bwant * v / want
                        r[k] -= v
                        if hl and not PERP[k]:
                            x = min(v, b * XC)
                            u[k] += (v - x) * (1 - FEES[k]) / p + (b + x) * (1 - FEEP[k]) / p; pu[k] += (b + x) * (1 - FEEP[k]) / p
                            col[k] += x; debt[k] += x
                        else:
                            u[k] += (v + b) * (1 - fe) / p
                            if PERP[k]:
                                pu[k] = u[k]
                        debt[k] += b
                    dca[k] = 0.0
            else:
                if qv > 0:   # в день продажи отложенная покупка пропадает (сигналы противоположны)
                    pass
            # wk: «ловушка для фитилей» — лимитные покупки из своего резерва монеты (без плеча) ниже опорной цены; исполнение по минимуму дня
            # (в стресс-тесте WST = 1 — по минимуму со стрессом, т. е. фитили глубже и заявок исполняется больше); WGD — не тратить, пока по монете есть заём (debt)
            if NL > 0 and t > s0 and t > WAGE[k] and not (WGD > 0 and debt[k] > 0):
                tj = t - 1
                if WEV > 1:
                    tj = tj - (DAYN[tj] % WEV)
                if tj != wjj[k]:
                    wjj[k] = tj; rf = C[tj, k] if tj >= 0 else np.nan
                    if np.isnan(rf):
                        rf = C[t - 1, k]
                    wref[k] = rf; carry = 0.0
                    for q in range(NL):
                        wdone[k, q] = 0.0; x = WF[q] * max(before, 0.0) + carry; lim = rf * (1 - WK[q])
                        mn = MK[k] * max(5.0, 0.01 * lim) if (MINO > 0 and WMIN > 0) else 0.0
                        if x < mn:
                            wamt[k, q] = 0.0; carry = x
                        else:
                            wamt[k, q] = x; carry = 0.0
                lo_w = LO[t, k] * (stress if WST == 1 else 1.0)
                for q in range(NL):
                    if wdone[k, q] > 0 or wamt[k, q] <= 0:
                        continue
                    lim = wref[k] * (1 - WK[q])
                    if lo_w <= lim and lim > 0:
                        v = min(wamt[k, q], max(r[k], 0.0))
                        if v > 0:
                            r[k] -= v; dq = v * (1 - WFEE) / lim; u[k] += dq
                            if PERP[k]:
                                pu[k] = u[k]
                            wdone[k, q] = 1.0; wsp += v; wcnt += 1
                            if WEXIT > 0:
                                wlu[k, q] += dq; wlr[k, q] = wref[k]; wld[k, q] = t
            if t > s0:
                want = SHW[t - 1, k]
                if want > stg[k] + 1e-12:
                    eq = side + shc
                    for j in range(K):
                        eq += r[j] - debt[j] + col[j]
                        if not np.isnan(C[t, j]):
                            eq += u[j] * C[t, j] - su[j] * C[t, j]
                    q = (want - stg[k]) * max(eq, 0.0) / p
                    su[k] += q; shpnl -= q * p * FEEP[k]; shc += q * p * (1 - FEEP[k]); stg[k] = want
                elif want == 0 and su[k] > 0:
                    shc -= su[k] * p * (1 + FEEP[k]); shpnl -= su[k] * p * FEEP[k]; su[k] = 0.0; stg[k] = 0.0
        R = shc
        for k in range(K):
            R += r[k]
        # wk: WST = 2 — проверка «в худший момент»: все ещё не исполненные заявки окна, до которых достал бы минимум со стрессом,
        # считаются исполненными прямо перед проверкой (резерв потрачен, монеты по минимуму со стрессом), в состояние это не переносится
        VS = 0.0
        for k in range(K):
            vsk[k] = 0.0; vuk[k] = 0.0
            if WST != 2 or NL == 0 or np.isnan(C[t, k]) or t <= WAGE[k] or wjj[k] < -10 ** 8 or (WGD > 0 and debt[k] > 0):
                continue
            rr = max(r[k], 0.0); los = LO[t, k] * stress
            for q in range(NL):
                if wdone[k, q] > 0 or wamt[k, q] <= 0:
                    continue
                lim = wref[k] * (1 - WK[q])
                if los <= lim and lim > 0:
                    v = min(wamt[k, q], rr); rr -= v; vsk[k] += v; vuk[k] += v * (1 - WFEE) / lim
            VS += vsk[k]
        if hl == 2:
            av = R - VS; mm = 0.0
            for k in range(K):
                if not np.isnan(C[t, k]):
                    lo = LO[t, k] * stress; hi = HI[t, k] * (2.0 - stress)
                    if PERP[k]:
                        av += (u[k] + vuk[k]) * lo; mm += MM[k] * (u[k] + vuk[k]) * lo
                    else:
                        av += pu[k] * lo; mm += MM[k] * pu[k] * lo
                    av -= su[k] * hi; mm += MMSH * su[k] * hi
                av -= debt[k]; av += col[k]
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
                        pu[k] = 0.0; debt[k] = 0.0; su[k] = 0.0; stg[k] = 0.0; r[k] = 0.0; col[k] = 0.0
                    shc = 0.0; side += max(0.0, av - mm)
        else:
            assets = side + max(R - VS, 0.0); D = max(-R, 0.0)
            for k in range(K):
                if not np.isnan(C[t, k]):
                    assets += (u[k] + vuk[k]) * LO[t, k] * stress
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
            fin += r[k] - debt[k] + col[k] + (u[k] - su[k]) * C[n - 1, k]
        else:
            fin += r[k] - debt[k] + col[k]
    return nl, fin / inv - 1, worst, shpnl / inv, paid / inv, skipped / inv, wsp / inv, wcnt
