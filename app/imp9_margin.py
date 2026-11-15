"""imp9: портфель с маржой и шортом BTC по правилам Hyperliquid (копия agent4d_margin.sim4 с отдельной проверкой ликвидации перпов).
Hyperliquid: залог кросс-маржи перпов — только USDC (резервы, выручка/убыток закрытых позиций) + нереализованный PnL перпов;
спотовые монеты НЕ считаются. Плечо покупки L — спот на v + лонг перпа на (L−1)·v (долг модели = вход перпа, проценты ≈ фандинг лонга).
Шорт BTC — перп BTC. Ликвидация перпов, когда стоимость счёта перпов ≤ поддерживающей маржи (BTC 1,25%, ETH 2%, SOL 2,5%, прочие 5%
номинала) по минимуму дня для лонгов и максимуму для шорта (стресс −20/−30% и +20/+30%). При ликвидации закрываются только перпы.
Режимы залога: 'strict' — ни одна монета не залог (весь портфель в споте); 'real' — монеты без спота на Hyperliquid (кроме BTC, ETH, SOL,
HYPE, PUMP, ENA, ZEC) держатся лонгом перпа 1× с полным залогом и потому считаются по рынку.
Шорт BTC: желаемый размер — доля капитала (как в основе); cap — потолок номинала шорта: ≤ cap × свободный залог (стоимость счёта перпов
без шорта); 0 — без потолка. Плюс считается и старое условие модели (активы/долг ≤ 1,1) для сравнения.
Использование: from imp9_margin import *; P = HPort(P9); o = hl_full(P, S, L, sh=0.2, cap=1.0)"""
import sys, os, json
import numpy as np
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_margin import Port, SETS, scheme, BOT, c, HERE, IDX, STARTS, YEARS  # noqa: F401
from agent4d_margin import shift
from agent_margin import ML, FEE, UNIT

DEBUG = False
HL_SPOT = {"BTC-USD", "ETH-USD", "SOL-USD", "HYPE32196-USD", "PUMP36507-USD", "ENA-USD", "ZEC-USD"}
MMR = {"BTC-USD": 0.0125, "ETH-USD": 0.02, "SOL-USD": 0.025}


class HPort(Port):
    def __init__(self, coins):
        super().__init__(coins)
        self.mm = np.array([MMR.get(s, 0.05) for s, _ in coins])
        self.cnt_real = np.array([0.0 if s in HL_SPOT else 1.0 for s, _ in coins])

    def shw(self, entry=None, exit_=None, maxd=0):
        """Маска шорта BTC (1 — держать) по своим условиям входа/выхода (списки наборов условий)."""
        if entry is None:
            return self.W
        W = self.B.hold(self.B.mask(entry), self.B.mask(exit_ if exit_ is not None else BOT + [[c("btcr30", ">", 20)]]), maxd=maxd); W[:, 1:] = 0
        return W

    def hl(self, S, L, sh=0.0, W=None, cap=0.0, acap=0.0, lag=0, rate=0.0003, stress=1.0, mode="strict", starts=None, end=None, sh_rate=0.15 / 365):
        A, G = self.plan(S); B = self.B
        Lm = B.levmat(L); SH = (self.W if W is None else W) * sh
        LM = np.ones(B.C.shape); RP = np.zeros(B.C.shape)
        if lag:
            A, G, SH = shift(A, lag, 1.0), shift(G, lag, 0), shift(SH, lag)
        st = STARTS if starts is None else starts
        Cc, Lc, Hc = B.C, B.LO, B.HI
        if end is not None:
            Cc, Lc, Hc, A, G, SH = (x[:end] for x in (Cc, Lc, Hc, A, G, SH)); LM = LM[:end]; RP = RP[:end]
            st = np.array([s for s in st if s < end - 60])
        cnt = self.cnt_real if mode == "real" else np.zeros(len(self.B.coins))
        R = [simhl(Cc, Lc, Hc, A, G, SH, int(s), Lm, stress, sh_rate, rate, self.mm, cnt, cap, acap) for s in st]
        return R


def summ(R):
    x = np.array([q[1] for q in R]) * 100
    return {"liq": int(sum(q[0] > 0 for q in R)), "liq4": int(sum(q[5] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)),
            "hlm": float(min(q[2] for q in R)), "lvl": float(min(q[6] for q in R)), "shpnl": float(np.median([q[3] for q in R]) * 100), "x": x}


def hl_full(P, S, L, sh=0.0, W=None, cap=0.0, mode="strict", rate=0.0003, years=False, acap=0.0):
    """В срок и на день позже; стресс 0,8/0,7 (минимумы −20/−30%, максимумы +20/+30%). Безопасно: 0 ликвидаций HL везде."""
    o = {}
    for lag in (0, 1):
        for sv in (1.0, 0.8, 0.7):
            r = summ(P.hl(S, L, sh, W, cap, acap, lag, rate, sv, mode))
            o[(lag, sv)] = r
    a = o[(0, 1.0)]; b = o[(1, 1.0)]
    out = {"m0": a["med"], "m1": b["med"], "p10": a["p10"], "liq": [o[k]["liq"] for k in o], "liq4": [o[k]["liq4"] for k in o],
           "safe": all(o[k]["liq"] == 0 for k in o), "hlm": min(a["hlm"], b["hlm"]), "hlm30": min(o[(0, 0.7)]["hlm"], o[(1, 0.7)]["hlm"]),
           "lvl": min(a["lvl"], b["lvl"]), "shpnl": a["shpnl"], "worst": float(a["x"].min())}
    if years:
        out["by_year"] = {int(y): float(np.median(a["x"][YEARS == y])) for y in sorted(set(YEARS))}
    return out


def fmt(o):
    return (f"в срок {o['m0']:+.0f}% | +1 день {o['m1']:+.0f}% | худшие 10% {o['p10']:+.0f}% | шорт {o['shpnl']:+.1f}% | запас HL {min(o['hlm'], 99):.2f} "
            f"(при ±30% {min(o['hlm30'], 99):.2f}) | {'0 ликв. HL' if o['safe'] else 'ЛИКВ HL ' + str(o['liq'])}"
            f" | старая модель {'0' if not any(o['liq4']) else o['liq4']}")


@njit(cache=True)
def perp_state(C, t, K, r, u, ul, debt, su, shc, CNT):
    fr = shc; N = 0.0
    for j in range(K):
        fr += r[j] - debt[j]
        if not np.isnan(C[t, j]):
            fr += ul[j] * C[t, j] + CNT[j] * (u[j] - ul[j]) * C[t, j] - su[j] * C[t, j]
            N += ul[j] * C[t, j] + CNT[j] * (u[j] - ul[j]) * C[t, j] + su[j] * C[t, j]
    return fr, N


@njit(cache=True)
def simhl(C, LO, HI, ACT, GRP, SHW, s0, LEV, stress, sh_rate, rate, MMR, CNT, cap, acap):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); ul = np.zeros(K); debt = np.zeros(K); su = np.zeros(K); stg = np.zeros(K)
    inv = 0.0; nl = 0; nl4 = 0; worst = 1e9; worst4 = 1e9; shpnl = 0.0; shc = 0.0
    for t in range(s0, n):
        tot = 0.0
        for k in range(K):
            tot += r[k]
        if shc < 0:
            shc -= -shc * rate
        if tot < 0:
            fee = -tot * rate; neg = 0.0
            for k in range(K):
                if r[k] < 0:
                    neg += r[k]
            for k in range(K):
                if r[k] < 0:
                    r[k] -= fee * r[k] / neg
        for k in range(K):
            p = C[t, k]
            if np.isnan(p):
                continue
            inv += UNIT; before = r[k]; r[k] += UNIT
            debt[k] *= 1 + rate
            if su[k] > 0:
                shc -= su[k] * p * sh_rate; shpnl -= su[k] * p * sh_rate
            a = ACT[t - 1, k] if t > s0 else 1.0
            g = GRP[t - 1, k] if t > s0 else 0
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - f; ul[k] *= 1 - f; debt[k] *= 1 - f
            else:
                v = min(r[k], UNIT + (a - 1) * before)
                if acap > 0 and v > UNIT:                       # спот не тратит USDC, нужный залогом перпов (номинал ≤ acap × счёт)
                    fr, N = perp_state(C, t, K, r, u, ul, debt, su, shc, CNT)
                    v = max(min(v, fr - N / acap), min(v, UNIT))
                if v > 0:
                    b = (LEV[g, k] - 1) * v
                    if b < 0:
                        b = 0.0
                    r[k] -= v
                    if acap > 0 and b > 0:                      # номинал перпов ≤ acap × стоимость счёта перпов
                        fr, N = perp_state(C, t, K, r, u, ul, debt, su, shc, CNT)
                        b = min(b, max(acap * fr - N, 0.0))
                    u[k] += (v + b) * (1 - FEE) / p; ul[k] += b * (1 - FEE) / p; debt[k] += b
            if t > s0:
                want = SHW[t - 1, k]
                if want > stg[k] + 1e-12:
                    eq = shc; fr = shc
                    for j in range(K):
                        eq += r[j] - debt[j]; fr += r[j] - debt[j]
                        if not np.isnan(C[t, j]):
                            eq += u[j] * C[t, j] - su[j] * C[t, j]
                            fr += ul[j] * C[t, j] + CNT[j] * (u[j] - ul[j]) * C[t, j] - su[j] * C[t, j]
                    q = (want - stg[k]) * max(eq, 0.0) / p
                    if cap > 0:
                        lim = cap * max(fr, 0.0) / p - su[k]      # номинал шорта ≤ cap × свободный залог перпов
                        if q > lim:
                            q = max(lim, 0.0)
                    if acap > 0:
                        fr, N = perp_state(C, t, K, r, u, ul, debt, su, shc, CNT)
                        q = min(q, max(acap * fr - N, 0.0) / p)
                    su[k] += q; shpnl -= q * p * FEE; shc += q * p * (1 - FEE); stg[k] = want
                elif want == 0 and su[k] > 0:
                    shc -= su[k] * p * (1 + FEE); shpnl -= su[k] * p * FEE; su[k] = 0.0; stg[k] = 0.0
                elif want == 0:
                    stg[k] = 0.0
        # старая модель: все активы / долг
        R = shc
        for k in range(K):
            R += r[k]
        assets = max(R, 0.0); D = max(-R, 0.0)
        # Hyperliquid: стоимость счёта перпов = USDC + PnL перпов (+ монеты, держащиеся перпом 1×), спот не считается
        av = R; mm = 0.0; notl = 0.0
        for k in range(K):
            if not np.isnan(C[t, k]):
                lo = LO[t, k] * stress; hi = HI[t, k] * (2.0 - stress)
                assets += u[k] * lo
                D += su[k] * hi
                av += ul[k] * lo - debt[k] + CNT[k] * (u[k] - ul[k]) * lo - su[k] * hi
                nn = ul[k] * lo + CNT[k] * (u[k] - ul[k]) * lo + su[k] * hi
                mm += MMR[k] * nn; notl += ul[k] * lo + su[k] * hi
            else:
                av -= debt[k]
            D += debt[k]
        if D > 0:
            lv = assets / D
            if lv < worst4:
                worst4 = lv
            if lv <= ML:
                nl4 += 1
        if notl > 0:
            m = av / notl
            if m < worst:
                worst = m
            if av <= mm:
                if DEBUG:
                    print("ЛИКВ", t, "av", av, "mm", mm, "R", R, "ul*lo", [ul[k] * LO[t, k] for k in range(K)], "debt", [debt[k] for k in range(K)], "su", su[0], "r", [r[k] for k in range(K)])
                nl += 1
                # закрываются только перпы: лонги перпа (плечо) и шорт; спот остаётся
                left = av
                for k in range(K):
                    u[k] -= ul[k]; ul[k] = 0.0; debt[k] = 0.0; su[k] = 0.0; stg[k] = 0.0; r[k] = 0.0
                    if CNT[k] > 0:
                        u[k] = 0.0
                shc = max(0.0, left) * 0.0
                r[0] = max(0.0, left)
    fin = shc
    for k in range(K):
        if not np.isnan(C[n - 1, k]):
            fin += r[k] - debt[k] + (u[k] - su[k]) * C[n - 1, k]
        else:
            fin += r[k] - debt[k]
    return nl, fin / inv - 1, worst, shpnl / inv, 0.0, nl4, worst4
