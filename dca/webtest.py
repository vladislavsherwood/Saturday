"""Проверка стратегий, найденных в интернете, тем же способом, что и наши.

1. Усиление только в нижних 15% оценки (цена/SMA200 в нижних 15% своей истории -> ×3, иначе ×1).
2. Value averaging: покупать столько, чтобы стоимость портфеля шла по плану (+$10 в день и заданный рост).
3. Отношение к 200-недельной средней (лестница по процентилю).
4. Композитный риск-индекс 0..1 (среднее процентилей нескольких индикаторов).
5. Puell Multiple (только BTC): доход майнеров к своей годовой средней.
6. MVRV (только BTC): рыночная капитализация к реализованной.
7. Pi Cycle Top как правило пропуска: не покупать, пока 111-дневная средняя выше удвоенной 350-дневной.
8. VIX в одну сторону (только акции): больше при высоком VIX, никогда не меньше ×1.

Оценка: годовая доходность против DCA (медиана по активам), лучше/хуже, тест на случайность сдвигом сигнала,
две половины истории по отдельности, деньги и прибыль к DCA.

Запуск: python3 dca/webtest.py
"""
import json
import os
import time
import urllib.request

import numpy as np
import pandas as pd
from numba import njit

import backtest as bt
import grid
import quant
import quant2
import ranking

TOL = bt.TOL
N_SHIFT = 1000
U = bt.UNIT
CLASSES = {
    "Крипта": (quant.UNIVERSE["Крипта: топ-2018"] + ["SOL-USD"], "2018-03-01", 365, ["BTC-USD", "ETH-USD"]),
    "Акции и фонды": (quant.UNIVERSE["Акции: ETF"] + ["AAPL", "NVDA", "^TA125.TA", "EIS"], "2010-01-01", 252, ["SPY", "QQQ"]),
    "Металлы, сырьё, облигации": (quant.UNIVERSE["Металлы, сырьё, облигации"] + ["GC=F", "SI=F"], "2010-01-01", 252, ["GLD", "SLV"]),
}
ACT = np.array([0, 1, 2, 3, 1], dtype=np.int8)       # зона = множитель; зона 4 (нет данных) = ×1


def pct(s, mp=200):
    return s.expanding(min_periods=mp).rank(pct=True)


def ladder_pct(p, edges, vals):
    out = np.select([p <= e for e in edges], vals[:-1], default=vals[-1]).astype(float)
    out[np.isnan(p.values)] = np.nan
    return out


@njit(cache=True)
def value_averaging(price, daily_rate, allow_sell):
    n = len(price)
    buy = np.zeros(n)
    sell = np.zeros(n)
    units = 0.0
    target = 0.0
    for i in range(n):
        target = target * (1 + daily_rate) + U
        diff = target - units * price[i]
        if diff > 0:
            amt = min(diff, 3 * U)
            buy[i] = amt / U
            units += amt / price[i]
        elif allow_sell:
            amt = min(-diff, 3 * U, units * price[i])
            sell[i] = amt / U
            units -= amt / price[i]
    return buy, sell


def onchain():
    def puell():
        req = urllib.request.Request("https://api.blockchain.info/charts/miners-revenue?timespan=all&format=json&sampled=false",
                                     headers={"User-Agent": "Mozilla/5.0"})
        d = json.load(urllib.request.urlopen(req, timeout=120))
        s = pd.Series({pd.to_datetime(x["x"], unit="s").normalize(): float(x["y"]) for x in d["values"]}, name="rev")
        s = s[~s.index.duplicated(keep="last")].sort_index().asfreq("D").ffill()
        return (s / s.rolling(365).mean()).rename("puell").dropna()

    def mvrv():
        rows, url = [], ("https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=CapMVRVCur"
                         "&frequency=1d&page_size=10000&start_time=2011-01-01")
        while url:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            d = json.load(urllib.request.urlopen(req, timeout=120))
            rows += d["data"]
            url = d.get("next_page_url")
            time.sleep(0.3)
        return pd.Series({pd.to_datetime(r["time"]).tz_localize(None).normalize(): float(r["CapMVRVCur"]) for r in rows},
                         name="mvrv").sort_index()
    return quant2.cached("puell.csv", puell), quant2.cached("mvrv.csv", mvrv)


def strategies(close, bpy, cls, vix, extra):
    """Возвращает {имя: множители покупки (NaN = нет данных -> ×1)} по данным до текущего дня включительно."""
    y = bpy
    w200 = 1400 if bpy == 365 else 1000
    sma200 = close / close.rolling(200, min_periods=bt.WARMUP).mean()
    p200 = pct(sma200)
    out = {}
    out["1. Нижние 15% оценки -> ×3"] = pd.Series(np.where(p200 <= 0.15, 3.0, 1.0), index=close.index).where(p200.notna())
    r200w = close / close.rolling(w200, min_periods=w200 // 2).mean()
    out["3. 200-недельная средняя (лестница)"] = pd.Series(
        ladder_pct(pct(r200w), [0.2, 0.5, 0.85], [3, 2, 1, 0]), index=close.index)
    risk = pd.concat([
        pct(close / close.rolling(int(140 * y / 365), min_periods=50).mean()),
        pct(close / close.rolling(int(350 * y / 365), min_periods=100).mean()),
        pct(bt.rsi(close, 14 * (7 if bpy == 365 else 5))),
        1 - pct(1 - close / close.rolling(y, min_periods=y // 2).max()),
        pct(close / close.shift(y) - 1),
    ], axis=1).mean(axis=1, skipna=False)
    out["4. Риск-индекс (с пропуском при высоком риске)"] = pd.Series(
        ladder_pct(risk, [0.2, 0.4, 0.7], [3, 2, 1, 0]), index=close.index)
    out["4б. Риск-индекс (никогда не меньше ×1)"] = pd.Series(
        ladder_pct(risk, [0.2, 0.4], [3, 2, 1]), index=close.index)
    if cls == "Крипта":
        ma111 = close.rolling(111).mean()
        ma350 = close.rolling(350).mean()
        out["7. Pi Cycle: не покупать после сигнала вершины"] = pd.Series(
            np.where(ma111 > 2 * ma350, 0.0, 1.0), index=close.index).where(ma350.notna())
    if cls == "Акции и фонды":
        v = vix.reindex(close.index, method="ffill")
        out["8. VIX в одну сторону"] = pd.Series(np.where(v > 30, 3.0, np.where(v > 20, 2.0, 1.0)), index=close.index)
    for name, s in extra.items():
        out[name] = s.reindex(close.index, method="ffill")
    return out


def evaluate(cls, syms, start, bpy, focus, vix, btc_extra, fr):
    rows, perm = [], {}
    for sym in syms:
        try:
            close = bt.yahoo(sym)["close"]
        except Exception:  # noqa: BLE001
            continue
        st = strategies(close, bpy, cls, vix, btc_extra if sym == "BTC-USD" else {})
        close = close[close.index >= start]
        if len(close) < 3 * bpy:
            continue
        price = close.values
        n = len(price)
        yrs = ((close.index - close.index[0]).days / 365.25).values.astype(float)
        years = yrs[-1]
        cf = np.empty((n - 1) // grid.BUCKET + 2)
        z1 = np.ones(n, dtype=np.int8)
        b_irr, b_profit, b_inv, _ = grid._sim(price, z1, ACT, years, cf)
        mid = n // 2
        offs = (fr * n).astype(np.int64)

        def half_edges(zone):
            res = []
            for sl in (slice(0, mid), slice(mid, n)):
                p = price[sl]
                yy = (close.index[sl][-1] - close.index[sl][0]).days / 365.25
                c2 = np.empty((len(p) - 1) // grid.BUCKET + 2)
                b = grid._sim(p, z1[sl], ACT, yy, c2)[0]
                res.append(grid._sim(p, zone[sl], ACT, yy, c2)[0] - b)
            return res

        for name, m in st.items():
            x = m.shift(1).reindex(close.index).values           # сигнал по вчерашнему закрытию
            zone = np.where(np.isnan(x), 4, x).astype(np.int8)
            irr, profit, inv, _ = grid._sim(price, zone, ACT, years, cf)
            perm[(name, sym)] = quant.shifts(price, zone, ACT, years, b_irr, offs)
            h = half_edges(zone)
            rows.append({"стратегия": name, "sym": sym, "edge": irr - b_irr, "h1": h[0], "h2": h[1],
                         "money": inv / b_inv, "profit": profit, "dca": b_profit, "nsell": 0,
                         "covered": float((zone != 4).mean())})
        # value averaging — зависит от пути, считается отдельно, без теста сдвигом
        zero = np.zeros(n)
        e_irr, e_profit, e_inv, _ = ranking.sim(price, yrs, np.ones(n), zero, False, False)
        for rate in (0.0, 0.15):
            for allow in (False, True):
                name = f"2. Value averaging, рост плана {rate:.0%}" + (", с продажами" if allow else ", без продаж")
                buy, sell = value_averaging(price, (1 + rate) ** (1 / bpy) - 1, allow)
                irr, profit, inv, ns = ranking.sim(price, yrs, buy, sell, False, False)
                hh = []
                for sl in (slice(0, mid), slice(mid, n)):
                    p, yy = price[sl], yrs[sl] - yrs[sl][0]
                    b = ranking.sim(p, yy, np.ones(len(p)), np.zeros(len(p)), False, False)[0]
                    bb, ss = value_averaging(p, (1 + rate) ** (1 / bpy) - 1, allow)
                    hh.append(ranking.sim(p, yy, bb, ss, False, False)[0] - b)
                rows.append({"стратегия": name, "sym": sym, "edge": irr - e_irr, "h1": hh[0], "h2": hh[1],
                             "money": inv / e_inv, "profit": profit, "dca": e_profit, "nsell": ns, "covered": 1.0})
    df = pd.DataFrame(rows)
    out = []
    for name, g in df.groupby("стратегия", sort=False):
        floor = g.dca - 0.10 * g.dca.abs()
        worse = (g.edge < -TOL) | ((g.nsell > 0) & (g.profit < floor))
        r = {"стратегия": name, "активов": len(g), "к DCA, п.п.": round(g.edge.median(), 1),
             "лучше": int(((g.edge > TOL) & ~worse).sum()), "хуже": int(worse.sum()),
             "1-я пол.": round(g.h1.median(), 1), "2-я пол.": round(g.h2.median(), 1)}
        if (name, g.sym.iloc[0]) in perm:
            P = np.median(np.array([perm[(name, s)] for s in g.sym]), axis=0)
            r["p"] = round((1 + (P >= g.edge.median()).sum()) / (N_SHIFT + 1), 3)
        else:
            r["p"] = np.nan
        r.update({"деньги к DCA": round(g.money.median(), 2), "прибыль к DCA": round(g.profit.sum() / g.dca.sum(), 2),
                  "сигнал есть, % дней": round(g.covered.median() * 100)})
        for f in focus:
            v = g[g.sym == f].edge
            r[f.replace("-USD", "")] = round(float(v.iloc[0]), 1) if len(v) else np.nan
        out.append(r)
    return pd.DataFrame(out).sort_values("к DCA, п.п.", ascending=False), df


def main():
    vix = bt.yahoo("^VIX")["close"]
    puell, mvrv = onchain()
    btc_extra = {
        "5. Puell Multiple (BTC)": pd.Series(bt.ladder(puell, [0.6, 1.0, 2.0], [3, 2, 1, 0]), index=puell.index),
        "6. MVRV (BTC)": pd.Series(bt.ladder(mvrv, [1.0, 1.5, 3.0], [3, 2, 1, 0]), index=mvrv.index),
    }
    fr = np.random.default_rng(31).uniform(0.1, 0.9, N_SHIFT)
    pd.set_option("display.width", 280, "display.max_colwidth", 60)
    parts = []
    for cls, (syms, start, bpy, focus) in CLASSES.items():
        t, _ = evaluate(cls, syms, start, bpy, focus, vix, {}, fr)
        t.insert(0, "класс", cls)
        parts.append(t)
        print(f"\n===== {cls} (с {start[:4]} года)")
        print(t.drop(columns=["класс"]).to_string(index=False))
    # только BTC, длинная история, включая ончейн
    t, df = evaluate("Крипта", ["BTC-USD"], "2015-06-01", 365, ["BTC-USD"], vix, btc_extra, fr)
    t.insert(0, "класс", "BTC с 2015")
    parts.append(t)
    print("\n===== только BTC, с июня 2015")
    print(t.drop(columns=["класс", "активов", "лучше", "хуже", "BTC"]).to_string(index=False))
    pd.concat(parts).to_csv(os.path.join(bt.OUT, "webtest.csv"), index=False)


if __name__ == "__main__":
    main()
