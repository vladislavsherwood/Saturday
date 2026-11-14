"""Сравнение монет на основной стратегии (Тихая вершина + ликвидации) и на DCA: прибыль, риск, разные окна.
Взнос $10 в день, решение по вчерашнему сигналу, комиссия 0,1%. Запуск: python3 app/coin_compare.py"""
import sys, os, json
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine

COINS = [("BTC-USD", "btc", "BTC"), ("ETH-USD", "alt", "ETH"), ("SOL-USD", "alt", "SOL"), ("HYPE32196-USD", "alt", "HYPE"), ("PUMP36507-USD", "alt", "PUMP"),
         ("DOGE-USD", "alt", "DOGE"), ("PEPE24478-USD", "alt", "PEPE"), ("ENA-USD", "alt", "ENA"), ("ZEC-USD", "alt", "ZEC")]
U, FEE = 10.0, 0.001


def sim(c, plan):
    cash = units = du = inv = 0.0
    eq, dq, iv = [], [], []
    for i, p in enumerate(c):
        a, before = (plan[i - 1] if i else 1.0), cash
        cash += U; inv += U; du += U * (1 - FEE) / p
        if a < 0:
            v = -a * units * p; units += a * units; cash += v * (1 - FEE)
        else:
            v = min(cash, U + (a - 1) * before); units += v * (1 - FEE) / p; cash -= v
        eq.append(cash + units * p); dq.append(du * p); iv.append(inv)
    return np.array(eq), np.array(dq), np.array(iv)


def stats(eq, iv):
    r = eq / iv - 1
    return {"profit": r[-1] * 100, "worst": r.min() * 100, "lossdays": (r < 0).mean() * 100}


rows = {}
for sym, kind, t in COINS:
    h = engine.series(sym, kind)
    st = {x["code"]: x for x in h["strategies"]}
    c = np.array(h["c"], float); plan = np.array(st["main"]["plan"], float)
    dates = pd.to_datetime(np.array(h["t"]), unit="D")
    vol = np.std(np.diff(np.log(c))[-365:]) * np.sqrt(365) * 100
    peak = (1 - c[-1] / c.max()) * 100
    res = {"from": dates[0].strftime("%Y-%m"), "days": len(c), "vol": vol, "dd_now": peak, "price_x": c[-1] / c[0]}
    for name, start in [("full", None), ("3y", 1095), ("2y", 730), ("1y", 365), ("6m", 182)]:
        if start and len(c) < start:
            continue
        s = 0 if start is None else len(c) - start
        eq, dq, iv = sim(c[s:], plan[s:])
        a, b = stats(eq, iv), stats(dq, iv)
        res[name] = {"main": a, "dca": b, "edge": (eq[-1] / dq[-1] - 1) * 100}
    # по календарным годам: прибыль стратегии за год (взносы только этого года)
    yrs = {}
    for y in sorted(set(dates.year)):
        m = np.where(dates.year == y)[0]
        if len(m) < 120:
            continue
        eq, dq, iv = sim(c[m], plan[m]); yrs[int(y)] = round((eq[-1] / iv[-1] - 1) * 100)
    res["years"] = yrs
    rows[t] = res

def f(x): return f"{x:+.0f}%"
print(f"{'монета':6} {'с':8} {'волат.':>7} {'от макс.':>8} | {'вся история: стратегия / DCA / худший момент':>44} | {'3 года':>14} | {'2 года':>14} | {'1 год':>14} | {'полгода':>14}")
for t, r in rows.items():
    cell = lambda k: (f"{f(r[k]['main']['profit']):>6} /{f(r[k]['dca']['profit']):>6}" if k in r else f"{'—':>14}")
    fu = r["full"]
    print(f"{t:6} {r['from']:8} {r['vol']:6.0f}% {-r['dd_now']:7.0f}% | {f(fu['main']['profit']):>8} / {f(fu['dca']['profit']):>7} / худш. {f(fu['main']['worst']):>5} (в минусе {fu['main']['lossdays']:.0f}% дней) | {cell('3y')} | {cell('2y')} | {cell('1y')} | {cell('6m')}")
print("\nпо годам (прибыль стратегии на взносы этого года):")
for t, r in rows.items(): print(f"  {t:6} " + "  ".join(f"{y}: {v:+d}%" for y, v in r["years"].items()))
print("\nхудший момент за 2 года / 1 год (стратегия):")
for t, r in rows.items(): print(f"  {t:6} " + " | ".join(f"{k}: {f(r[k]['main']['worst'])}, в минусе {r[k]['main']['lossdays']:.0f}% дней" for k in ("2y", "1y") if k in r))
json.dump(rows, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/coin_compare.json", "w"))
