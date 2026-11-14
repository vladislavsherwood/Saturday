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
