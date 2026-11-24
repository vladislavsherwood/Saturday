"""Сколько будет на счёте через 1 / 2 / 3 года по combo6 при текущих взносах ($28/день): спот без плеча против маржи ×1,45 (схема приложения:
паника и разворот ×1,45, дно ×2, продажи и обычные дни без плеча; заём под 11% годовых, продажа гасит долю долга) и обычный DCA.
Фитиль (покупка по рынку при −25/−40/−60% от вчерашнего закрытия на 15/25/35% резерва) — из своего резерва, без плеча, в обоих вариантах.
Старты каждые 15 дней с 2019 года; монеты, которых ещё не было (или моложе 60 дней), не участвуют — их взнос делится между остальными.
Без деления сделок 50/50 на два дня и без проверки ликвидаций (её делали маржинальные прогоны: 0 ликвидаций при сдвигах и стрессе −20/−30%).
Запуск: python3 app/proj_margin.py"""
import os, sys, datetime as D
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import app_combo4 as C4  # noqa: E402

UNITS = {"ETH-USD": 3, "SOL-USD": 3, "BTC-USD": 2, "XMR-USD": 2, "DOGE-USD": 2, "PEPE24478-USD": 2, "ENA-USD": 2, "ZEC-USD": 2, "PENGU34466-USD": 2,
         "PUMP36507-USD": 2, "LIT39125-USD": 2, "HYPE32196-USD": 2, "USELESS36828-USD": 1, "FARTCOIN-USD": 1}
KIND = {"BTC-USD": "btc"}
FEE, RATE = 0.001, 0.11 / 365
R = C4.compute([(s, KIND.get(s, "alt")) for s in UNITS], "combo6")
B = next(iter(R.values()))["B"]; IDX = next(iter(R.values()))["idx"]; WK = C4.WICK
LV = [(-float(k), float(f)) for k, f in zip(WK["levels"], WK["fractions_of_reserve"])]
TD = np.array([(d - pd.Timestamp("1970-01-01")).days for d in IDX])
CO = {}
for s, r in R.items():
    k = r["k"]; c = B.C[:, k]; ok = np.where(np.isfinite(c))[0]
    CO[s] = {"c": c, "l": B.LO[:, k], "plan": r["plan"], "pm": r["pm"], "gm": r["gm"], "LM": np.array(r["LM"], float), "first": int(ok[0]), "last": int(ok[-1])}
END = min(v["last"] for v in CO.values())


def run(s, i0, days, unit, mode):
    """mode: 'dca' | 'spot' | 'margin' → стоимость счёта монеты в конце (позиция + резерв − долг)."""
    X = CO[s]; c, l = X["c"], X["l"]; e = min(X["last"], i0 + days - 1)
    cash = units = debt = 0.0; jj0 = None; amt = []; done = []; ref = 0.0
    for i in range(i0, e + 1):
        p = c[i]
        if not np.isfinite(p) or p <= 0: cash += unit; continue
        if mode == "dca": units += unit * (1 - FEE) / p; continue
        j = i - 1; debt *= 1 + RATE; before = cash; cash += unit
        a = (X["pm"] if mode == "margin" else X["plan"])[j]; a = 1.0 if not np.isfinite(a) else float(a)
        lev = float(X["LM"][int(X["gm"][j])]) if mode == "margin" else 1.0
        if a < 0:
            f = min(1.0, -a); x = f * units * p; units -= f * units; cash += x * (1 - FEE) - f * debt; debt *= 1 - f
        elif a > 0:
            own = min(cash, a * unit if a < 1 else unit + (a - 1) * before); b = max(0.0, lev - 1) * own
            units += (own + b) * (1 - FEE) / p; cash -= own; debt += b
        if j - X["first"] > WK["coin_age_min_days"]:   # фитиль: от вчерашнего закрытия, уровень раз в день, из своего резерва
            if jj0 != j: jj0 = j; ref = c[j]; amt = [fr * max(0.0, cash) for _, fr in LV]; done = [False] * len(LV)
            for q, (kk, _) in enumerate(LV):
                lim = ref * (1 - kk)
                if done[q] or not (np.isfinite(l[i]) and l[i] <= lim) or cash <= 0: continue
                x = min(cash, amt[q])
                if x > 0: units += x * (1 - FEE) / lim; cash -= x; done[q] = True
    return units * c[e] + cash - debt


def scenario(i0, years, mode):
    days = int(round(365 * years))
    if i0 + days - 1 > END: return None
    live = {s: u for s, u in UNITS.items() if CO[s]["first"] <= i0 - 60}
    if not live: return None
    tot = sum(live.values())
    return sum(run(s, i0, days, 28 * u / tot, mode) for s, u in live.items()), 28 * days


if __name__ == "__main__":
    d19 = int(np.searchsorted(TD, (D.date(2019, 1, 1) - D.date(1970, 1, 1)).days))
    fmt = lambda x: f"${x:,.0f}".replace(",", " ")  # noqa: E731
    print(f"данные по {IDX[END].date()}; взнос $28/день\n")
    for years in (1, 2, 3):
        rows = {}
        for mode in ("dca", "spot", "margin"):
            v = [scenario(i0, years, mode) for i0 in range(d19, END + 1, 15)]; v = np.array([x[0] for x in v if x])
            rec = scenario(END - int(round(365 * years)) + 1, years, mode)
            rows[mode] = (v, rec)
        inv = 28 * int(round(365 * years))
        print(f"=== через {years} {'год' if years == 1 else 'года'}: вложено {fmt(inv)}, сценариев {len(rows['spot'][0])} ===")
        for mode, nm in (("dca", "обычный DCA"), ("spot", "combo6 спот"), ("margin", "combo6 маржа ×1,45")):
            v, rec = rows[mode]
            print(f"  {nm:20s} последние {years} г.: {fmt(rec[0]):>10} | с 2019: медиана {fmt(np.median(v)):>10}, плохие 10% {fmt(np.percentile(v, 10)):>10}, хорошие 10% {fmt(np.percentile(v, 90)):>10}, худший {fmt(v.min()):>10}")
        m, s_ = rows["margin"][0], rows["spot"][0]
        print(f"  маржа лучше спота в {int((m > s_).sum())} из {len(m)} сценариев; медиана отношения маржа/спот ×{np.median(m / s_):.2f}, худшее ×{(m / s_).min():.2f}")
