"""Агент 2: общие помощники для портфеля с маржой поверх agent_margin.py.
Группы плеча: 0 взнос, 1 дно (капитуляция, волна ликвидаций), 2 паника (подтверждённая OI), 3 разворот BTC, 4 продажа,
5 паника без подтверждения (без плеча), 6 отложенная покупка после выноса (толпа вышла из шортов).
Использование: from agent2_margin import MAIN, grouped, sized, run, SHORTS"""
import sys, os, json, itertools
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent_margin import plan_of, portfolio, fmt, mask, short_state, sim, C as CC, LO, HI, starts, idx

HERE = os.path.dirname(os.path.abspath(__file__))
MAIN = json.load(open(os.path.join(HERE, "found", "main-crypto.json")))
c = lambda i, o, v: {"ind": i, "op": o, "v": v}                         # noqa: E731


def grp_of(r, conf=True):
    """Группа плеча правила по смыслу условий (для любых вариантов основы); conf — есть ли в стратегии подтверждённая паника."""
    inds = [x["ind"] for x in r["conds"]]
    if r["act"] < 0:
        return 4
    if any(i.startswith("dly") for i in inds):
        return 6
    if inds in (["fng"], ["oidd30"]) and r["conds"][0]["op"] == "<":
        return 1
    if "usdt" in inds:
        return 2 if "oidd30" in inds or not conf else 5
    if "btcr30" in inds:
        return 0 if r["act"] == 1 else 3
    return r.get("grp", 0)


def grouped(S):
    conf = any("usdt" in [x["ind"] for x in r["conds"]] and "oidd30" in [x["ind"] for x in r["conds"]] for r in S["rules"])
    return {"base": S.get("base", 1), "rules": [{**r, "grp": r["grp"] if "grp" in r else grp_of(r, conf)} for r in S["rules"]]}


def sized(S, sb=None, sp=None, sr=None, sd=None):
    """Размеры по группам: дно 1+sb, паника доли ×sp (не больше всего резерва), разворот 1+sr, отложенная 1+sd; None — как есть."""
    S = json.loads(json.dumps(grouped(S)))
    for r in S["rules"]:
        g = r["grp"]
        if g == 1 and sb is not None: r["act"] = 1 + sb
        if g == 2 and sp is not None: r["act"] = 1 + min(1.0, (r["act"] - 1) * sp)
        if g == 3 and sr is not None: r["act"] = 1 + sr
        if g == 6 and sd is not None: r["act"] = 1 + sd
    return S


BOT = [[c("usdt", ">", 1.07), c("othd", "<", 25)], [c("fng", "<", 10)], [c("oidd30", "<", -28)]]
_W = {}


def short_mask(entry="жадность > 75", exit_="дно или разворот BTC"):
    ENTRY = {"жадность > 75": [[c("fng", ">", 75)]], "тихая вершина и фандинг > 1%": [[c("qt", ">", 0.5), c("fund30", ">", 1)]]}
    EXIT = {"дно или разворот BTC": BOT + [[c("btcr30", ">", 20)]]}
    key = (entry, exit_)
    if key not in _W:
        _W[key] = short_state(mask(ENTRY[entry] if isinstance(entry, str) else entry), mask(EXIT[exit_] if isinstance(exit_, str) else exit_))
    return _W[key]


def run(S, lev=(1,) * 7, sh=0.0, W=None, stress=True, xs=False):
    """Портфель 9 монет, 105 стартов; lev — плечо по группам 0..6; sh — шорт BTC доля счёта (вход жадность > 75, выход дно/разворот)."""
    A, G, _ = plan_of(grouped(S))
    if sh and W is None:
        W = short_mask()
    o = portfolio(A, G, lev, SHORT=W if sh else None, sh_size=sh, sh_rate=0.15 / 365, sh_coin=0, stress=stress)
    if xs:
        levv = np.array(list(lev) + [1.0] * (8 - len(lev)), float); SH = W.astype(float) if sh else np.zeros(CC.shape)
        o["_x"] = [sim(CC, LO, HI, A, G, SH, int(s), levv, 1.0, sh, 0.15 / 365, 0)[1] * 100 for s in starts]
    return o


def safe(o):
    return o["liq"] == 0 and o.get("l20", 1) == 0 and o.get("l30", 1) == 0


# ---------- sim2: как agent_margin.sim, но отрицательный общий остаток резерва (после закрытия шорта или продажи позиции в долгу) —
# это тоже заём: на него начисляется та же ставка RATE. В agent_margin.sim такой «бесплатный» заём был не учтён.
from numba import njit
from agent_margin import RATE, ML, FEE, UNIT


@njit(cache=True)
def sim2(C, LO, HI, ACT, GRP, SHORT, s0, lev, stress, sh_size, sh_rate, sh_coin, negrate, sep):
    """sep — выручка шорта лежит отдельно (shc) и не идёт в резерв монеты; отрицательный общий остаток считается долгом и при ликвидации."""
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K); su = np.zeros(K)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9; shpnl = 0.0; shdays = 0; negpaid = 0.0; shc = 0.0
    for t in range(s0, n):
        tot = 0.0
        for k in range(K):
            tot += r[k]
        if negrate and shc < 0:
            fee = -shc * RATE; negpaid += fee; shc -= fee
        if negrate and tot < 0:                       # общий остаток резерва ниже нуля — платим проценты, списываем пропорционально минусам
            fee = -tot * RATE; negpaid += fee; neg = 0.0
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
            inv += UNIT; before = r[k]; r[k] += UNIT; debt[k] *= 1 + RATE
            if su[k] > 0:
                if sep:
                    shc -= su[k] * p * sh_rate
                else:
                    r[k] -= su[k] * p * sh_rate
                shpnl -= su[k] * p * sh_rate; shdays += 1
            a = ACT[t - 1, k] if t > s0 else 1.0
            g = GRP[t - 1, k] if t > s0 else 0
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - f; debt[k] *= 1 - f
            else:
                v = min(r[k], UNIT + (a - 1) * before)
                if v > 0:
                    b = (lev[g] - 1) * v
                    r[k] -= v; u[k] += (v + b) * (1 - FEE) / p; debt[k] += b
            if sh_size > 0 and t > s0 and (sh_coin < 0 or sh_coin == k):
                want = SHORT[t - 1, k] > 0
                if want and su[k] == 0:
                    eq = side + shc
                    for j in range(K):
                        eq += r[j] - debt[j]
                        if not np.isnan(C[t, j]):
                            eq += u[j] * C[t, j] - su[j] * C[t, j]
                    q = sh_size * max(eq, 0.0) / p
                    su[k] = q; shpnl -= q * p * FEE
                    if sep:
                        shc += q * p * (1 - FEE)
                    else:
                        r[k] += q * p * (1 - FEE)
                elif not want and su[k] > 0:
                    if sep:
                        shc -= su[k] * p * (1 + FEE)
                    else:
                        r[k] -= su[k] * p * (1 + FEE)
                    shpnl -= su[k] * p * FEE
                    su[k] = 0.0
        # единый счёт: общий остаток в стейблах (резервы + выручка шортов); минус — это долг
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
                    r[k] = 0.0; u[k] = 0.0; debt[k] = 0.0; su[k] = 0.0
                side = max(0.0, left); shc = 0.0
    fin = side + shc
    for k in range(K):
        if not np.isnan(C[n - 1, k]):
            fin += r[k] - debt[k] + (u[k] - su[k]) * C[n - 1, k]
        else:
            fin += r[k] - debt[k]
    return nl, fin / inv - 1, worst, shpnl / inv, negpaid / inv


NOSH = np.zeros(CC.shape)


def port2(A, G, lev=(1,) * 7, W=None, sh=0.0, negrate=True, stress=True, sh_coin=0, xs=False, sep=False):
    levv = np.array(list(lev) + [1.0] * (8 - len(lev)), float); SH = NOSH if W is None or not sh else W.astype(float)
    R = [sim2(CC, LO, HI, A, G, SH, int(s), levv, 1.0, sh, 0.15 / 365, sh_coin, negrate, sep) for s in starts]
    x = np.array([q[1] for q in R]) * 100
    o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)),
         "early": float(np.median(x[:48])), "late": float(np.median(x[48:])), "shpnl": float(np.median([q[3] for q in R]) * 100), "neg": float(np.median([q[4] for q in R]) * 100)}
    if xs:
        o["_x"] = x.tolist()
    if stress and o["liq"] == 0:
        for st, key in ((0.8, "l20"), (0.7, "l30")):
            o[key] = int(sum(sim2(CC, LO, HI, A, G, SH, int(s), levv, st, sh, 0.15 / 365, sh_coin, negrate, sep)[0] > 0 for s in starts))
    return o


def fmt2(o):
    return (f"медиана {o['med']:+.0f}% | худшие 10% {o['p10']:+.0f}% | 2018–21 {o['early']:+.0f}%, 2022–26 {o['late']:+.0f}% | ликв. {o['liq']}"
            + (f", −20%: {o['l20']}, −30%: {o['l30']}" if "l20" in o else "") + f" | мин. активы/долг {min(o['lvl'], 99):.2f}"
            + (f" | шорт {o['shpnl']:+.1f}%" if o["shpnl"] else "") + (f" | % за минус резерва {o['neg']:.2f}%" if o.get("neg") else ""))


@njit(cache=True)
def any_liq(C, LO, HI, A, G, SH, S0, levv, stress, sh, sh_rate, sh_coin, negrate, sep):
    """Есть ли хоть одна ликвидация на любом из стартов (быстрый выход на первой)."""
    for s in S0:
        if sim2(C, LO, HI, A, G, SH, s, levv, stress, sh, sh_rate, sh_coin, negrate, sep)[0] > 0:
            return True
    return False


def stress_ok(A, G, lev, W=None, sh=0.0, sep=True, sh_coin=0):
    """Сначала самый жёсткий стресс −30%, потом −20%; True — ноль ликвидаций в обоих."""
    levv = np.array(list(lev) + [1.0] * (8 - len(lev)), float); SH = NOSH if W is None or not sh else W.astype(float)
    S0 = np.array(starts, dtype=np.int64)
    return not any_liq(CC, LO, HI, A, G, SH, S0, levv, 0.7, sh, 0.15 / 365, sh_coin, True, sep) and not any_liq(CC, LO, HI, A, G, SH, S0, levv, 0.8, sh, 0.15 / 365, sh_coin, True, sep)
