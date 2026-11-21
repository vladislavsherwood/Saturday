"""Сколько будет на счёте через 1 / 2 / 3 года по combo5 (план из сборки приложения + лимитки на фитиль), если сейчас добавить в резерв $0 / 300 / 500 / 700.
Портфель пользователя: взносы по монетам $/день (всего $28), разовая сумма делится по монетам пропорционально взносу.
Сценарии — старты по истории каждые 15 дней; монеты, которых в тот день ещё не было (или ещё моложе 60 дней), не участвуют — их взнос и доля суммы
делятся между остальными пропорционально (всего всегда $28/день). Спот без плеча (перпы с плечом ×1,45 дали бы больше). Решение — по закрытию дня,
исполнение на следующий день. Сравнение — обычный DCA тех же денег (разовая сумма куплена в первый день).
Запуск: python3 app/proj_lump.py <dca-app.html>"""
import sys, re, json
import numpy as np

UNITS = {"ETH-USD": 3, "SOL-USD": 3, "BTC-USD": 2, "XMR-USD": 2, "DOGE-USD": 2, "PEPE24478-USD": 2, "ENA-USD": 2, "ZEC-USD": 2, "PENGU34466-USD": 2,
         "PUMP36507-USD": 2, "LIT39125-USD": 2, "HYPE32196-USD": 2, "USELESS36828-USD": 1, "FARTCOIN-USD": 1}
LUMPS = (0, 300, 500, 700)
FEE = 0.001
SNAP = json.loads(re.search(r"<script>const SNAP = (.*?);</script>", open(sys.argv[1], encoding="utf-8").read(), re.S).group(1))
CO = {}
for s in UNITS:
    h = SNAP["coins"][s]["h"]; st = next(x for x in h["strategies"] if x["code"] == "combo5")
    CO[s] = {"t": np.array(h["t"]), "c": np.array(h["c"], float), "l": np.array(h.get("l") or h["c"], float), "plan": np.array(st["plan"], float), "wick": st.get("wick")}
END = min(int(v["t"][-1]) for v in CO.values())


def run(k, d0, days, unit, cash0, strat=True):
    """Монета k со дня d0 (номер дня от 1970) на days дней: взнос unit/день, в резерве с первого дня cash0. → стоимость в конце."""
    X = CO[k]; t = X["t"]; s = int(np.searchsorted(t, d0)); e = min(len(t) - 1, s + days - 1)
    c, l, plan, W = X["c"], X["l"], X["plan"], X["wick"]
    cash, units, jj0, amt, done, ref = float(cash0), 0.0, None, [], [], 0.0
    if not strat:   # обычный DCA: разовая сумма — в первый день, взнос — каждый день
        units = cash0 * (1 - FEE) / c[s]; cash = 0.0
    for i in range(s, e + 1):
        p = c[i]; j = i - 1
        if not strat:
            units += unit * (1 - FEE) / p; continue
        a = plan[j] if j >= 0 else 1.0
        before = cash; cash += unit
        if a < 0:
            x = -a * units * p; units -= x / p; cash += x * (1 - FEE)
        elif a > 0:
            want = a * unit if a < 1 else unit + (a - 1) * before; x = min(cash, want); units += x * (1 - FEE) / p; cash -= x
        if W and j > W["age"]:
            jj = j - int(t[j]) % W["every"]
            if jj != jj0:
                jj0 = jj; ref = c[max(0, jj)]; amt = [fr * before for _, fr in W["lv"]]; done = [False] * len(amt)
            for q, (kk, _) in enumerate(W["lv"]):
                lim = ref * (1 - kk)
                if done[q] or not (l[i] <= lim) or cash <= 0: continue
                x = min(cash, amt[q])
                if x > 0: units += x * (1 - FEE) / lim; cash -= x; done[q] = True
    return units * c[e] + cash


def scenario(d0, years, lump, strat=True):
    days = int(round(365 * years))
    if d0 + days - 1 > END: return None
    live = {k: u for k, u in UNITS.items() if CO[k]["t"][0] <= d0 - 60}
    if not live: return None
    tot = sum(live.values()); val = 0.0
    for k, u in live.items():
        w = u / tot
        val += run(k, d0, days, 28 * w, lump * w, strat)
    return val, 28 * days + lump, len(live)


first = min(int(v["t"][0]) for v in CO.values()) + 61
if __name__ == "__main__":
    import datetime as D
    dd = lambda x: D.date(1970, 1, 1) + D.timedelta(days=int(x))  # noqa: E731
    print(f"данные по {dd(END)}; старты каждые 15 дней с {dd(first)}; взнос $28/день; спот без плеча\n")
    for years in (1, 2, 3):
        print(f"=== через {years} {'год' if years == 1 else 'года'} ===")
        for lump in LUMPS:
            R = [scenario(d0, years, lump) for d0 in range(first, END + 1, 15)]; R = [r for r in R if r]
            Dc = [scenario(d0, years, lump, False) for d0 in range(first, END + 1, 15)]; Dc = [r for r in Dc if r]
            v = np.array([r[0] for r in R]); inv = R[0][1]; dv = np.array([r[0] for r in Dc])
            rec = [scenario(END - int(round(365 * years)) + 1, years, lump)][0]
            print(f"  +${lump:>3}: вложено ${inv:,.0f} | медиана ${np.median(v):,.0f} (×{np.median(v) / inv:.2f}) | плохие 10% ${np.percentile(v, 10):,.0f} | хорошие 10% ${np.percentile(v, 90):,.0f}"
                  f" | худший ${v.min():,.0f} | DCA медиана ${np.median(dv):,.0f} | последние {years} г.: ${rec[0]:,.0f} | сценариев {len(v)}".replace(",", " "))
