"""Агент ТА, круг 8: защита плеча паники по ТА BTC (ограничение размера через плечо).
Гипотеза (заранее): край плеча паники (×1,45 — ликвидации на наборе B и P2 при −30% в обвале марта 2020) задают покупки с плечом в фазе
взрыва волатильности или когда BTC ещё высоко над своей 50-недельной средней (впереди глубокое падение). Если паника покупается без плеча,
когда (1) волатильность BTC высока — средний модуль дневного изменения за 14 дней (ATR по закрытиям) > x% — или (2) BTC выше 50-нед. средней
в y раз, то плечо паники ×1,5/×1,6 станет безопасным на всех пяти портфелях (0 ликвидаций в срок и на день позже, стресс −20/−30% и
+20/+30%) и медиана вырастет против лучшей схемы (R16 + A4 ×1,4 (60 дн) + шорт BTC 20%). Критерий: 0 ликвидаций везде, запас ≥ 1,5,
медиана P9 выше лучшей схемы, медианы B/M/P2/P3 не ниже.
Индикаторы (только прошлое, по BTC): b_volc — EMA(27) модуля дневного изменения закрытия BTC, %; b_w50 — BTC / средняя последних 50 недельных
закрытий (воскресенье). Запуск: python3 app/ta_margin.py <out.json> [быстро]"""
import os, sys, json, time
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_margin import Port, SETS, scheme, full, fmt, c, HERE
import agent_margin as AM
from agent4a_loop7 import split

_b = AM._btc.dropna()
_volc = ((_b / _b.shift(1) - 1).abs() * 100).ewm(span=27, adjust=False).mean()
_wk = _b[_b.index.dayofweek == 6]
_w50 = (_b / _wk.rolling(50, min_periods=50).mean().reindex(_b.index, method="ffill"))
_w20 = (_b / _wk.rolling(20, min_periods=20).mean().reindex(_b.index, method="ffill"))
AM.EXTRA["b_volc"] = lambda close, kind, I: _volc.reindex(close.index, method="ffill")
AM.EXTRA["b_w50"] = lambda close, kind, I: _w50.reindex(close.index, method="ffill")
AM.EXTRA["b_w20"] = lambda close, kind, I: _w20.reindex(close.index, method="ffill")

BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S0 = {"base": BEST["base"], "rules": BEST["rules"]}
quick = len(sys.argv) > 2
PS = {k: Port(v) for k, v in SETS.items()}


def guarded(lp, guard=None):
    S, L = scheme(S0, D=60, lp=lp, lr=1.5)
    if guard:
        S = split(S, guard, 5, 1.0)
    return S, L


if __name__ == "__main__":
    print("доля дней 2018–2026 с b_volc > 3/4/5:", [round(float((_volc["2018":] > x).mean()), 3) for x in (3, 4, 5)],
          "| b_w50 > 1/1,2/1,5:", [round(float((_w50["2018":] > x).mean()), 3) for x in (1, 1.2, 1.5)], flush=True)
    for d in ("2020-02-20", "2020-03-11", "2020-03-13", "2020-03-20", "2018-11-20", "2022-06-15"):
        print(f"  {d}: b_volc {_volc[:d].iloc[-1]:.2f}, b_w50 {_w50[:d].iloc[-1]:.2f}, b_w20 {_w20[:d].iloc[-1]:.2f}", flush=True)
    CFG = [("ЛУЧШАЯ основы: A4 ×1,4", 1.4, None)]
    for lp in (1.5, 1.6):
        CFG.append((f"A4 ×{lp} без защиты", lp, None))
        for x in (3, 4, 5):
            CFG.append((f"A4 ×{lp} + без плеча при волатильности BTC > {x}%", lp, c("b_volc", ">", x)))
        for y in (1.0, 1.2):
            CFG.append((f"A4 ×{lp} + без плеча при BTC > {y} × 50-нед. средней", lp, c("b_w50", ">", y)))
        for y in (0.7, 0.8, 0.9):
            CFG.append((f"A4 ×{lp} + без плеча при BTC < {y} × 50-нед. средней", lp, c("b_w50", "<", y)))
        for y in (0.7, 0.8):
            CFG.append((f"A4 ×{lp} + без плеча при BTC < {y} × 20-нед. средней", lp, c("b_w20", "<", y)))
    if quick:
        CFG = [x for x in CFG if "<" in x[0]] + [(f"A4 ×1,45 + без плеча при BTC < {y} × 50-нед. средней", 1.45, c("b_w50", "<", y)) for y in (0.7, 0.8, 0.9)]
    RES = {}
    for tag, lp, g in CFG:
        t = time.time(); S, L = guarded(lp, g); row = {}
        for nm, P in PS.items():
            row[nm] = full(P, S, L, 0.2)
        ok = all(o["safe"] for o in row.values())
        RES[tag] = row
        print(f"{'OK ' if ok else '✘  '}{tag} ({time.time() - t:.0f} с)\n" + "\n".join(f"     {nm:8s} {fmt(o)}" for nm, o in row.items()), flush=True)
    json.dump(RES, open(sys.argv[1], "w"), ensure_ascii=False, indent=0, default=float)
