"""imp5: уровень портфеля поверх combo_margin (стенд агента 4D, sim4). Правила по монетам не меняются; меняется, откуда берутся деньги
на покупки и как распределяется капитал между монетами.
simP = sim4 (agent4d_margin) + опции:
  pool  — доля дневного взноса и выручки продаж, идущая в ОБЩИЙ резерв (0 — как sim4: у каждой монеты свой резерв; 1 — один резерв на все).
          Покупка монеты k на правиле с долей a: v = UNIT + (a − 1) · (r[k] + доля_k · P), доля_k = WT[t−1,k] / Σ WT по монетам с ценой.
  spill — доля выручки продаж монеты, уходящая в общий резерв (перенос денег от продаж одной монеты в покупки другой), при pool = 0.
  WT    — веса распределения общего резерва по дням × монетам (по умолчанию равные);
  wmode — 1: вес монеты ещё × число её взносов с начала старта (новая монета не получает сразу 1/K накопленного общего резерва).
  RB    — ребалансировка каждые RB дней от старта: доля rho разрыва между чистой стоимостью монеты и целевой (поровну среди монет с ценой)
          закрывается обменом (продажа перевеса, покупка недовеса за вырученные деньги, без плеча).
  cap   — потолок доли одной монеты в капитале счёта (чистая стоимость монеты / капитал); проверка каждый день, излишек продаётся в резерв
          (общий при pool > 0, иначе в резерв этой монеты); долг монеты гасится в той же доле.
При pool = spill = 0, RB = 0, cap = 0 считает ровно как sim4 (проверка в imp5_check).
Использование: from imp5_port import *; P = Port(SETS['P9']); o = fullP(P, S, L, sh, opt=dict(pool=1))"""
import sys, os, json
import numpy as np
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_margin import Port, SETS, scheme, YEARS, BOT, c, HERE  # noqa: F401
from agent4d_margin import STARTS, safe, shift
from agent_margin import ML, FEE, UNIT

BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S_BEST = {"base": BEST["base"], "rules": BEST["rules"]}
CFGS = {"без плеча": (dict(lev=False), 0.0), "лучшая": (dict(D=60, lp=1.4, lr=1.5), 0.2), "осторожная": (dict(D=60, lp=1.25, lr=1.5), 0.1)}


@njit(cache=True)
def simP(C, LO, HI, ACT, GRP, SHW, WT, s0, LEV, stress, sh_rate, rate, pool, spill, RB, rho, cap, wmode):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K); su = np.zeros(K); stg = np.zeros(K)
    P = 0.0; cnt = np.zeros(K)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9; shpnl = 0.0; paid = 0.0; shc = 0.0
    for t in range(s0, n):
        tot = P
        for k in range(K):
            tot += r[k]
        if shc < 0:
            fee = -shc * rate; paid += fee; shc -= fee
        if tot < 0:
            fee = -tot * rate; paid += fee; neg = 0.0
            if P < 0:
                neg += P
            for k in range(K):
                if r[k] < 0:
                    neg += r[k]
            if P < 0:
                P -= fee * P / neg
            for k in range(K):
                if r[k] < 0:
                    r[k] -= fee * r[k] / neg
        # доли общего резерва на сегодня (по решению вчерашнего дня)
        P0 = P
        wsum = 0.0
        for k in range(K):
            if not np.isnan(C[t, k]):
                cnt[k] += 1
                wsum += (WT[t - 1, k] if t > s0 else 1.0) * (cnt[k] if wmode == 1 else 1.0)
        for k in range(K):
            p = C[t, k]
            if np.isnan(p):
                continue
            inv += UNIT
            w = (WT[t - 1, k] if t > s0 else 1.0) * (cnt[k] if wmode == 1 else 1.0) / wsum if wsum > 0 else 0.0
            sharep = max(P0, 0.0) * w
            before = r[k] + sharep
            r[k] += UNIT * (1 - pool); P += UNIT * pool
            paid += debt[k] * rate; debt[k] *= 1 + rate
            if su[k] > 0:
                shc -= su[k] * p * sh_rate; shpnl -= su[k] * p * sh_rate
            a = ACT[t - 1, k] if t > s0 else 1.0
            g = GRP[t - 1, k] if t > s0 else 0
            if a < 0:
                f = -a
                cash = f * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - f; debt[k] *= 1 - f
                q = pool if pool > spill else spill
                if cash > 0:
                    P += cash * q; r[k] += cash * (1 - q)
                else:
                    r[k] += cash
            else:
                want = UNIT + (a - 1) * before
                avail = r[k] + (max(P, 0.0) if w > 0 else 0.0)
                v = min(avail, want)
                if v > 0:
                    b = (LEV[g, k] - 1) * v
                    if b < 0:
                        b = 0.0
                    fromr = min(max(r[k], 0.0), v)          # сначала свой резерв монеты, потом общий
                    r[k] -= fromr; P -= v - fromr
                    u[k] += (v + b) * (1 - FEE) / p; debt[k] += b
            if t > s0:
                wsh = SHW[t - 1, k]
                if wsh > stg[k] + 1e-12:
                    eq = side + shc + P
                    for j in range(K):
                        eq += r[j] - debt[j]
                        if not np.isnan(C[t, j]):
                            eq += u[j] * C[t, j] - su[j] * C[t, j]
                    q = (wsh - stg[k]) * max(eq, 0.0) / p
                    su[k] += q; shpnl -= q * p * FEE; shc += q * p * (1 - FEE); stg[k] = wsh
                elif wsh == 0 and su[k] > 0:
                    shc -= su[k] * p * (1 + FEE); shpnl -= su[k] * p * FEE; su[k] = 0.0; stg[k] = 0.0
        # потолок доли монеты
        if cap > 0:
            eq = side + shc + P
            for j in range(K):
                eq += r[j] - debt[j]
                if not np.isnan(C[t, j]):
                    eq += u[j] * C[t, j] - su[j] * C[t, j]
            if eq > 0:
                for k in range(K):
                    if np.isnan(C[t, k]) or u[k] <= 0:
                        continue
                    nv = u[k] * C[t, k] - debt[k]
                    if nv > cap * eq:
                        f = (nv - cap * eq) / nv
                        cash = f * (u[k] * C[t, k] * (1 - FEE) - debt[k]); u[k] *= 1 - f; debt[k] *= 1 - f
                        if pool > 0:
                            P += cash
                        else:
                            r[k] += cash
        # ребалансировка: обмен перевеса на недовес
        if RB > 0 and t > s0 and (t - s0) % RB == 0:
            m = 0; V = 0.0
            for k in range(K):
                if not np.isnan(C[t, k]):
                    m += 1; V += u[k] * C[t, k] - debt[k]
            if m > 1 and V > 0:
                tg = V / m; sold = 0.0; need = 0.0
                for k in range(K):
                    if np.isnan(C[t, k]):
                        continue
                    nv = u[k] * C[t, k] - debt[k]
                    if nv > tg and u[k] > 0:
                        x = rho * (nv - tg)
                        f = min(1.0, x / (u[k] * C[t, k]))
                        sold += f * u[k] * C[t, k] * (1 - FEE); u[k] *= 1 - f
                    elif nv < tg:
                        need += rho * (tg - nv)
                if need > 0:
                    for k in range(K):
                        if np.isnan(C[t, k]):
                            continue
                        nv = u[k] * C[t, k] - debt[k]
                        if nv < tg:
                            x = sold * rho * (tg - nv) / need
                            u[k] += x * (1 - FEE) / C[t, k]
        R = shc + P
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
                P = 0.0
                side = max(0.0, left); shc = 0.0
    fin = side + shc + P
    for k in range(K):
        if not np.isnan(C[n - 1, k]):
            fin += r[k] - debt[k] + (u[k] - su[k]) * C[n - 1, k]
        else:
            fin += r[k] - debt[k]
    return nl, fin / inv - 1, worst, shpnl / inv, paid / inv


def runP(Pt, S, L, sh=0.0, lag=0, rate=0.0003, stress=True, opt=None, WT=None):
    o = dict(pool=0.0, spill=0.0, RB=0, rho=1.0, cap=0.0, wmode=0); o.update(opt or {})
    A, G = Pt.plan(S); B = Pt.B
    Lm = B.levmat(L); SH = Pt.W * sh if sh else np.zeros(B.C.shape)
    Wt = np.ones(B.C.shape) if WT is None else np.nan_to_num(WT.astype(float), nan=0.0)
    if lag:
        A, G, SH, Wt = shift(A, lag, 1.0), shift(G, lag, 0), shift(SH, lag), shift(Wt, lag, 1.0)
    args = (float(o["pool"]), float(o["spill"]), int(o["RB"]), float(o["rho"]), float(o["cap"]), int(o["wmode"]))
    R = [simP(B.C, B.LO, B.HI, A, G, SH, Wt, int(s), Lm, 1.0, 0.15 / 365, rate, *args) for s in STARTS]
    x = np.array([q[1] for q in R]) * 100
    out = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)),
           "_x": x}
    if stress and out["liq"] == 0:
        for sv, key in ((0.8, "l20"), (0.7, "l30")):
            out[key] = int(sum(simP(B.C, B.LO, B.HI, A, G, SH, Wt, int(s), Lm, sv, 0.15 / 365, rate, *args)[0] > 0 for s in STARTS))
    return out


def fullP(Pt, S, L, sh=0.0, opt=None, WT=None, rate=0.0003, stress=True):
    o0 = runP(Pt, S, L, sh, 0, rate, stress, opt, WT); o1 = runP(Pt, S, L, sh, 1, rate, stress, opt, WT)
    x = o0.pop("_x"); o1.pop("_x")
    return {"m0": o0["med"], "m1": o1["med"], "p10": o0["p10"], "p10_1": o1["p10"], "worst": float(x.min()), "worst1": None,
            "lvl": min(o0["lvl"], o1["lvl"]), "safe": safe(o0) and safe(o1) if stress else (o0["liq"] == 0 and o1["liq"] == 0),
            "liq": [o0["liq"], o0.get("l20"), o0.get("l30"), o1["liq"], o1.get("l20"), o1.get("l30")]}


def fm(o):
    return (f"{o['m0']:+6.0f}/{o['m1']:+6.0f} p10 {o['p10']:+5.0f} worst {o['worst']:+5.0f} lvl {min(o['lvl'], 99):.2f} "
            f"{'ok' if o['safe'] else 'LIQ' + str(o['liq'])}")


_PORTS = {}
# контрольный портфель: монеты Yahoo, не входящие в пять портфелей и не отобранные под победителей (проверка на отбор задним числом)
CTRL = [("BTC-USD", "btc")] + [(s, "alt") for s in ("AAVE-USD", "ALGO-USD", "ETC-USD", "VET-USD", "XLM-USD", "XMR-USD", "VVV35509-USD")]


def ports():
    if not _PORTS:
        for k, v in SETS.items():
            _PORTS[k] = Port(v)
        _PORTS["K"] = Port(CTRL)
    return _PORTS


def evalall(opt=None, wtf=None, cfgs=("без плеча", "лучшая"), stress=True, S0=None):
    """Все пять портфелей × схемы. wtf(Port) -> матрица весов или None."""
    res = {}
    for cn in cfgs:
        kw, sh = CFGS[cn]; S, L = scheme(S0 or S_BEST, **kw)
        for pn, Pt in ports().items():
            res[(cn, pn)] = fullP(Pt, S, L, sh, opt, wtf(Pt) if wtf else None, stress=stress)
    return res


def score(res, base, sets=("P9", "B", "M", "P2+BTC", "P3+BTC")):
    """Только по пяти портфелям (K — отдельно). Сумма лог-отношений медиан (в срок и +1 день) к основе, по всем ячейкам; худшие 10% и худший старт — разница в п.п."""
    ks = [k for k in res if k[1] in sets]
    lg = sum(np.log((1 + res[k]["m0"] / 100) / (1 + base[k]["m0"] / 100)) + np.log((1 + res[k]["m1"] / 100) / (1 + base[k]["m1"] / 100)) for k in ks)
    dp = min(res[k]["p10"] - base[k]["p10"] for k in ks)
    dw = min(res[k]["worst"] - base[k]["worst"] for k in ks)
    return lg, dp, dw, all(res[k]["safe"] for k in ks)
