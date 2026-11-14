"""Агент ТА, круг 10 (маржа): вариант «продажи на страхе ×1,25 при сжатии волатильности BTC (перцентиль ширины полос Боллинджера за 180 дн
< 0,4) и BTC ниже 20-недельной средней» на пяти портфелях со схемами основы (лучшая: R16 + A4 ×1,4 (60 дн) + шорт BTC 20%; осторожная:
R16 + A4 ×1,25 + шорт 10%; без плеча). Критерий: 0 ликвидаций везде (в срок и на день позже, стресс ±20/±30%), запас не ниже ~1,55, медианы
не ниже основы. Индикаторы на python совпадают с ta_sim.js (BTC по закрытиям). Запуск: python3 app/ta_margin2.py <out.json>"""
import os, sys, json
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_margin import Port, SETS, scheme, full, fmt, c, HERE
import agent_margin as AM

_b = AM._btc.dropna()
_s20 = _b.rolling(20).mean(); _sd = _b.rolling(20).std(ddof=0)
_bbw = 4 * _sd / _s20
_bbwp = _bbw.rolling(180, min_periods=145).apply(lambda a: np.sum(a[~np.isnan(a)] < a[-1]) / np.sum(~np.isnan(a)), raw=True)
_wk = _b[_b.index.dayofweek == 6]
_w20 = _b / _wk.rolling(20, min_periods=20).mean().reindex(_b.index, method="ffill")
AM.EXTRA["b_bbwp"] = lambda close, kind, I: _bbwp.reindex(close.index, method="ffill")
AM.EXTRA["b_w20"] = lambda close, kind, I: _w20.reindex(close.index, method="ffill")

BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S0 = {"base": BEST["base"], "rules": BEST["rules"]}


def fear(r):
    return r["act"] < 0 and any(x["ind"] == "fng" and x["op"] == "<" and x["v"] == 52 for x in r["conds"])


SQ = {"base": S0["base"], "rules": [y for r in S0["rules"] for y in (
    [{"act": max(-1.0, round(r["act"] * 1.25, 6)), "conds": r["conds"] + [c("b_bbwp", "<", 0.4), c("b_w20", "<", 1)]}, r] if fear(r) else [r])]}

if __name__ == "__main__":
    for d in ("2019-06-01", "2021-06-01", "2022-09-01", "2023-09-01", "2025-09-01"):
        print(f"  {d}: b_bbwp {_bbwp[:d].iloc[-1]:.3f}, b_w20 {_w20[:d].iloc[-1]:.3f}", flush=True)
    PS = {k: Port(v) for k, v in SETS.items()}
    CFG = [("без плеча", dict(lev=False), 0.0), ("ОСТОРОЖНАЯ: R16 + A4 ×1,25 + шорт 10%", dict(D=60, lp=1.25, lr=1.5), 0.1),
           ("ЛУЧШАЯ: R16 + A4 ×1,4 + шорт 20%", dict(D=60, lp=1.4, lr=1.5), 0.2)]
    RES = {}
    for vn, SS in (("основа", S0), ("сжатие ×1,25", SQ)):
        for tag, kw, sh in CFG:
            S, L = scheme(SS, **kw); row = {nm: full(P, S, L, sh) for nm, P in PS.items()}
            RES[f"{vn} | {tag}"] = row
            print(f"{'OK ' if all(o['safe'] for o in row.values()) else '✘  '}{vn} | {tag}\n" + "\n".join(f"     {nm:8s} {fmt(o)}" for nm, o in row.items()), flush=True)
    json.dump({"rules": SQ, "res": RES}, open(sys.argv[1], "w"), ensure_ascii=False, indent=0, default=float)
