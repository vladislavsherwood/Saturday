"""Годовая доходность портфеля пользователя (IRR с учётом ежедневных взносов) по плану combo4 из сборки приложения — спот без плеча,
старт 1 / 2 / 3 / 5 лет назад (монеты, которых тогда не было, — с их первого дня). Плюс проекция: через сколько лет $1 000 000 при $22 в день.
Запуск: python3 app/irr_portfolio.py <dca-app.html>"""
import sys, re, json
import numpy as np

UNITS = {"ETH-USD": 3, "SOL-USD": 3, "BTC-USD": 2, "XMR-USD": 2, "DOGE-USD": 2, "PEPE24478-USD": 2, "ENA-USD": 2, "ZEC-USD": 2, "PENGU34466-USD": 2,
         "HYPE32196-USD": 1, "PUMP36507-USD": 1, "USELESS36828-USD": 1, "LIT39125-USD": 1, "FARTCOIN-USD": 1}
SNAP = json.loads(re.search(r"<script>const SNAP = (.*?);</script>", open(sys.argv[1], encoding="utf-8").read(), re.S).group(1))
end = max(SNAP["coins"][s]["h"]["t"][-1] for s in UNITS)


def run(start, plan=True):
    flows = {}; final = 0.0
    for sym, u in UNITS.items():
        h = SNAP["coins"][sym]["h"]; st = next(x for x in h["strategies"] if x["code"] == "combo4"); t = h["t"]; c = h["c"]
        a = int(np.searchsorted(t, start)); cash = units = 0.0
        for i in range(a, len(c)):
            p = c[i]; x = (st["plan"][i - 1] if i > a else 1.0) if plan else 1.0; before = cash; cash += u; flows[t[i]] = flows.get(t[i], 0) + u
            if x < 0: amt = -x * units * p; units -= amt / p; cash += amt * 0.999
            else: amt = min(cash, u + (x - 1) * before); units += amt * 0.999 / p; cash -= amt
        final += cash + units * c[-1]
    days = np.array(sorted(flows)); cf = np.array([flows[d] for d in days])
    def npv(r): return (cf * (1 + r) ** ((end - days) / 365.0)).sum() - final
    lo, hi = -0.99, 50.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if npv(mid) > 0: hi = mid
        else: lo = mid
    return (lo + hi) / 2, cf.sum(), final


print("старт | вложено | итог | годовая доходность стратегии | DCA")
for y in (1, 2, 3, 5):
    s = end - 365 * y; r, inv, fin = run(s); rd, _, fd = run(s, plan=False)
    print(f"{y} г. | ${inv:,.0f} | ${fin:,.0f} | {r * 100:+.0f}% годовых | DCA {rd * 100:+.0f}% годовых (${fd:,.0f})")


def years_to(target, r, per_year=22 * 365, start=0.0):
    v = start; y = 0
    while v < target and y < 100:
        v = v * (1 + r) + per_year * (1 + r) ** 0.5; y += 1
    return y
for r in (0.15, 0.25, 0.40, 0.60, 0.80):
    print(f"при {r * 100:.0f}% годовых и $22 в день — $1 000 000 примерно через {years_to(1e6, r)} лет")
