"""Плечо ×2 на основной стратегии: старт с разных дат (первое число каждого месяца), сколько ликвидаций было бы.
Модель: изолированная позиция по каждой монете; каждая покупка — свои деньги v и столько же в долг (позиция 2v); продажа доли позиции
гасит ту же долю долга; фандинг платится с размера позиции каждый день (фандинг BTC с Binance/Hyperliquid, до 2020 года — 0,03% в день);
ликвидация, если по минимуму дня позиция минус долг ≤ 1% позиции — позиция обнуляется, резерв (деньги вне позиции) остаётся, взносы идут дальше.
Взнос $10 в день, комиссия 0,1%. Запуск: python3 app/lev_starts.py"""
import sys, os, json
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine

COINS = [("BTC-USD", "btc", "BTC"), ("ETH-USD", "alt", "ETH"), ("SOL-USD", "alt", "SOL"), ("HYPE32196-USD", "alt", "HYPE"), ("PUMP36507-USD", "alt", "PUMP"),
         ("DOGE-USD", "alt", "DOGE"), ("PEPE24478-USD", "alt", "PEPE"), ("ENA-USD", "alt", "ENA"), ("ZEC-USD", "alt", "ZEC")]
U, FEE, MM = 10.0, 0.001, 0.01
LQ = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "liq_extra.json")))
FUND = pd.Series(LQ["bfund"], index=pd.to_datetime(LQ["t"], unit="D"), dtype=float)


def sim(c, lo, plan, fund, lev):
    cash = units = debt = inv = 0.0
    liqs, lost = [], 0.0
    for i in range(len(c)):
        p, a, before = c[i], (plan[i - 1] if i else 1.0), cash
        cash += U; inv += U
        if units > 0:
            debt += units * p * fund[i] / 100 * (lev > 1)          # фандинг за день с размера позиции
        if a < 0 and units > 0:
            f = -a; v = f * units * p * (1 - FEE); cash += v - f * debt; units -= f * units; debt -= f * debt
        elif a >= 0:
            v = min(cash, U + (a - 1) * before); cash -= v
            units += lev * v * (1 - FEE) / p; debt += (lev - 1) * v
        if units > 0 and units * lo[i] - debt <= MM * units * lo[i]:
            liqs.append(i); lost += max(0.0, units * c[i - 1] - debt) if i else 0; units = debt = 0.0
    return cash + units * c[-1] - debt, inv, liqs


out, ep = {}, {}
for sym, kind, t in COINS:
    h = engine.series(sym, kind)
    st = {x["code"]: x for x in h["strategies"]}
    c = np.array(h["c"], float); lo = np.array(h["l"], float); lo = np.where(np.isfinite(lo) & (lo > 0), np.minimum(lo, c), c)
    dates = pd.to_datetime(np.array(h["t"]), unit="D")
    plan = np.array(st["main"]["plan"], float); ones = np.ones_like(plan)
    fund = FUND.reindex(dates).fillna(0.03).values
    starts = [i for i in range(len(c) - 60) if dates[i].day == 1 and dates[i] >= pd.Timestamp("2018-01-01")]
    R = []
    for s in starts:
        e1, inv, _ = sim(c[s:], lo[s:], plan[s:], fund[s:], 1)
        e2, _, lq = sim(c[s:], lo[s:], plan[s:], fund[s:], 2)
        d2, _, lqd = sim(c[s:], lo[s:], ones[s:], fund[s:], 2)
        R.append({"start": dates[s].strftime("%Y-%m"), "x1": (e1 / inv - 1) * 100, "x2": (e2 / inv - 1) * 100, "n": len(lq), "dca2": (d2 / inv - 1) * 100, "nd": len(lqd),
                  "liq": [dates[s + i].strftime("%Y-%m-%d") for i in lq]})
        for d in R[-1]["liq"]:
            ep.setdefault(t, {}).setdefault(d[:7], 0); ep[t][d[:7]] += 1
    out[t] = R

med = lambda v: float(np.median(v))
print(f"{'монета':6} {'стартов':>7} | {'с ликвидацией':>13} {'ликв. в среднем':>15} {'макс.':>5} | {'итог ×1 (медиана)':>17} {'итог ×2 (медиана)':>17} {'×2 лучше ×1':>12} | {'DCA ×2: с ликв.':>15}")
for t, R in out.items():
    n = np.array([r["n"] for r in R])
    print(f"{t:6} {len(R):7} | {(n > 0).mean() * 100:12.0f}% {n.mean():15.1f} {n.max():5} | {med([r['x1'] for r in R]):+16.0f}% {med([r['x2'] for r in R]):+16.0f}% {np.mean([r['x2'] > r['x1'] for r in R]) * 100:11.0f}% | {np.mean([r['nd'] > 0 for r in R]) * 100:14.0f}%")
print("\nкогда случались ликвидации (месяц: со скольких стартов позиция ликвидирована в этом месяце):")
for t, m in ep.items():
    print(f"  {t:6} " + ", ".join(f"{k} ({v})" for k, v in sorted(m.items())))
print("\nпо году старта: доля стартов с ликвидацией / медиана итога ×1 → ×2")
for t, R in out.items():
    g = {}
    for r in R: g.setdefault(r["start"][:4], []).append(r)
    print(f"  {t:6} " + " | ".join(f"{y}: {np.mean([r['n'] > 0 for r in v]) * 100:.0f}%, {med([r['x1'] for r in v]):+.0f}%→{med([r['x2'] for r in v]):+.0f}%" for y, v in sorted(g.items())))
json.dump(out, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/lev_starts.json", "w"))
