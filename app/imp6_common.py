"""imp6 (агент улучшения №6, реальное исполнение): общие помощники поверх combo_margin (Port, sim4).
Сдвиг исполнения по семействам правил: решения выбранных правил исполняются на lag дней позже (lag < 0 — раньше, т. е. по закрытию дня решения),
остальные — в срок. Основа — found/combo-best-margin.json (лучшая безопасная схема)."""
import os, json
import numpy as np
from combo_margin import Port, SETS, scheme, full, fmt, BOT, c, HERE  # noqa: F401
from agent4d_margin import safe  # noqa: F401

M = json.load(open(os.path.join(HERE, "found", "combo-best-margin.json")))
BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S_BEST = M["best_safe"]["rules_with_sizes"]
L_BEST = [M["best_safe"]["group_leverage"][str(g)] for g in range(8)]
SH_BEST = 0.2


def has(r, ind):
    return any(q["ind"] == ind for q in r["conds"])


def families(S):
    """Номера правил по семействам."""
    F = {"дно": [], "отложенная": [], "паника": [], "разворот": [], "продажа на страхе": [], "продажа на фандинге": [],
         "тихая вершина": [], "широкая вершина": [], "возврат": [], "памп альта": []}
    for i, r in enumerate(S["rules"]):
        if has(r, "dly20_100f"): F["отложенная"].append(i)
        elif r["act"] > 1 and (has(r, "fng") and len(r["conds"]) == 1 or len(r["conds"]) == 1 and has(r, "oidd30")): F["дно"].append(i)
        elif has(r, "usdt"): F["паника"].append(i)
        elif has(r, "btcr30"): F["разворот"].append(i)
        elif r["act"] < 0 and has(r, "usdtd"): F["продажа на страхе"].append(i)
        elif r["act"] < 0 and has(r, "fund30"): F["продажа на фандинге"].append(i)
        elif r["act"] < 0 and has(r, "qt"): F["тихая вершина"].append(i)
        elif r["act"] < 0 and has(r, "oth90"): F["широкая вершина"].append(i)
        elif has(r, "ago_qt"): F["возврат"].append(i)
        elif r["act"] < 0 and has(r, "up90"): F["памп альта"].append(i)
    return F


def sh(Mx, lag, fill):
    O = np.full_like(Mx, fill)
    if lag > 0: O[lag:] = Mx[:-lag]
    elif lag < 0: O[:lag] = Mx[-lag:]
    else: O[:] = Mx
    return O


class LP(Port):
    """Port с планом RI (номер правила) и сдвигом по семействам."""
    def plan3(self, S):
        k = "3" + json.dumps(S, sort_keys=True)
        if k not in self._p:
            self._p[k] = self.B.plan(S)
        return self._p[k]

    def mats(self, S, lag_rules=None, lag=1, all_lag=0):
        A, G, RI = self.plan3(S)
        A = A.copy(); G = G.copy()
        if lag_rules:
            m = np.isin(RI, list(lag_rules))
            A0 = np.where(m, 1.0, A); G0 = np.where(m, 0, G)
            ms = sh(m, lag, False)
            A = np.where(ms, sh(A, lag, 1.0), A0); G = np.where(ms, sh(G, lag, 0), G0)
        if all_lag:
            A = sh(A, all_lag, 1.0); G = sh(G, all_lag, 0)
        return A, G

    def runm(self, A, G, L, shw=0.0, sh_lag=0, rate=0.0003, stress=False, xs=False, LEVM=None):
        W = self.W * shw if shw else None
        if W is not None and sh_lag: W = sh(W, sh_lag, 0.0)
        return self.B.port(A, G, self.B.levmat(L), SHW=W, LEVM=LEVM, rate=rate, stress=stress, xs=xs)


# ---------- sim5: размазывание и условия Hyperliquid ----------
from imp6_sim import sim5  # noqa: E402
from agent4d_margin import STARTS  # noqa: E402

HL_PERP = {"DOGE-USD", "PEPE24478-USD"}
HL_MM = {"BTC-USD": 0.0125, "ETH-USD": 0.02, "SOL-USD": 0.025}


def cfg(P, WT=(1.0,), SPL=(0,) * 8, hlx=False, fees=None, perp=None, fund=0.0003, mino=0.0, minb=0.0, hl=0, shr=0.15 / 365, perp_all=False, ld=1.0, xc=0.0):
    """Параметры sim5 для портфеля P. hlx=True — комиссии/перп-монеты/фандинг Hyperliquid (без минимума и без ликвидации HL, их — mino/hl)."""
    syms = [s for s, _ in P.B.coins]; K = len(syms)
    FEES = np.full(K, 0.001); FEEP = np.full(K, 0.001); PERP = np.zeros(K, dtype=np.bool_)
    if hlx:
        FEES[:] = 0.0007; FEEP[:] = 0.00045
        PERP[:] = [(s in HL_PERP) or perp_all for s in syms]
    if perp is not None:
        PERP[:] = perp
    MM = np.array([HL_MM.get(s, 0.05) for s in syms])
    return dict(WT=np.array(WT, dtype=float), SPL=np.array(SPL, dtype=np.int64), FEES=FEES, FEEP=FEEP, PERP=PERP, FUND=fund,
                MINO=mino, MINB=minb, hl=hl, MM=MM, MMSH=0.0125, shr=shr, LD=ld, XC=xc)


def run5(P, A, G, L, shw=0.0, sh_lag=0, rate=0.0003, stress=True, LEVM=None, starts=None, **kw):
    """Медиана 105 стартов на sim5; стресс −20/−30%, если без ликвидаций."""
    k = cfg(P, **kw); shr = k.pop("shr")
    W = P.W * shw if shw else np.zeros(P.B.C.shape)
    if shw and sh_lag: W = sh(W, sh_lag, 0.0)
    LM = np.ones(P.B.C.shape) if LEVM is None else LEVM
    Lm = P.B.levmat(L); st = STARTS if starts is None else starts
    f = lambda s, sv: sim5(P.B.C, P.B.LO, P.B.HI, A, G, W, LM, int(s), Lm, sv, shr, rate, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"],
                           k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"])
    R = [f(s, 1.0) for s in st]
    x = np.array([q[1] for q in R]) * 100
    o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)),
         "paid": float(np.median([q[4] for q in R]) * 100), "skip": float(np.median([q[5] for q in R]) * 100), "_x": x}
    if stress and o["liq"] == 0:
        for sv, key in ((0.8, "l20"), (0.7, "l30")):
            o[key] = int(sum(f(s, sv)[0] > 0 for s in st))
    return o
