"""Единая таблица всех именованных стратегий по прибыльности.

Каждая стратегия с продажами считается в трёх видах:
- «продажи»: как задумано;
- «пропуск вместо продажи»: в день сигнала продажи ничего не делаем (только покупки);
- без правила продажи вообще — это строка самой покупки.

Модель «сбережения»: единица $10, от ×0 до ×3 в день. Модель «резерв»: $10 в день приходят в резерв,
покупка на долю резерва. Доходность — годовая на вложенные деньги (XIRR), сравнение с обычным DCA.

Запуск: python3 dca/ranking.py
"""
import os

import numpy as np
import pandas as pd
from numba import njit

import backtest as bt
import cashgrid
import quant
import quant2

U = bt.UNIT
TOL = bt.TOL
CLASSES = {
    "Крипта": (quant.UNIVERSE["Крипта: топ-2018"] + ["SOL-USD"], "2019-06-01", ["BTC-USD", "ETH-USD"]),
    "Акции и фонды": (quant.UNIVERSE["Акции: ETF"] + ["AAPL", "NVDA", "^TA125.TA", "EIS"], "2010-01-01", ["SPY", "QQQ"]),
    "Металлы, сырьё, облигации": (quant.UNIVERSE["Металлы, сырьё, облигации"] + ["GC=F", "SI=F"], "2010-01-01", ["GLD", "SLV"]),
}


@njit(cache=True)
def _xirr(cf, years):
    lo, hi = -8.0, 8.0
    flo = np.sum(cf * np.exp(-lo * years))
    if flo * np.sum(cf * np.exp(-hi * years)) > 0:
        return np.nan
    for _ in range(50):
        m = 0.5 * (lo + hi)
        f = np.sum(cf * np.exp(-m * years))
        if (flo > 0) == (f > 0):
            lo, flo = m, f
        else:
            hi = m
    return np.expm1(0.5 * (lo + hi)) * 100


@njit(cache=True)
def sim(price, years, buy, sell, target, skip):
    """target: продажа x3, когда позиция в плюсе на 100%. skip: вместо продажи просто не покупаем."""
    n = len(price)
    cf = np.zeros(n)
    units = cost = invested = received = 0.0
    nsell = 0
    for i in range(n):
        p = price[i]
        s = (3.0 if (units > 0 and units * p > 2 * cost) else 0.0) if target else sell[i]
        if s > 0:
            if not skip:
                amt = min(s * U, units * p)
                if amt > 0:
                    cost -= cost * amt / (units * p)
                    units -= amt / p
                    received += amt
                    cf[i] = amt
                    nsell += 1
            continue
        if buy[i] > 0:
            amt = buy[i] * U
            units += amt / p
            cost += amt
            invested += amt
            cf[i] = -amt
    final = units * price[n - 1]
    cf[n - 1] += final
    if invested <= 0:
        return np.nan, 0.0, 0.0, 0
    return _xirr(cf, years), final + received - invested, invested, nsell


@njit(cache=True)
def reserve_irr(price, years, zone, act):
    wealth = cashgrid.sim(price, zone, act)[0]
    cf = np.full(len(price), -U)
    cf[-1] += wealth
    return _xirr(cf, years), wealth - U * len(price)


def lag(a, first):
    return np.concatenate([[first], np.asarray(a, dtype=float)[:-1]])


def main():
    btc = bt.yahoo("BTC-USD")["close"]
    eth = bt.yahoo("ETH-USD")["close"].reindex(btc.index)
    vix = bt.yahoo("^VIX")["close"]
    fng = bt.fear_greed()
    st = quant2.cached("stables.csv", quant2.stable_supply).reindex(btc.index, method="ffill")["2020-01-01":]
    cap = quant2.cached("btc_cap.csv", quant2.btc_cap).reindex(btc.index, method="ffill")
    dom = st / (st + cap + eth * 110e6)
    stable = dom / dom.rolling(200).mean()
    eb = eth / btc
    eth_btc = eb / eb.rolling(200, min_periods=bt.WARMUP).mean()
    crypto = CLASSES["Крипта"][0]
    ratios = pd.DataFrame({s: (lambda r: r / r.rolling(200, min_periods=bt.WARMUP).mean())(
        bt.yahoo(s)["close"] / btc.reindex(bt.yahoo(s).index)) for s in crypto if s != "BTC-USD"})
    alt_zone = ratios.median(axis=1).expanding(min_periods=200).rank(pct=True) <= 0.2

    md = ["# Все стратегии по прибыльности\n",
          "Доходность — годовая на вложенные деньги против обычного DCA, в п.п. (медиана по активам). "
          "«Лучше/хуже» — число активов, где стратегия лучше или хуже DCA больше чем на 0.5 п.п.; "
          "для стратегий с продажами «хуже» также если прибыль в долларах меньше, чем у DCA, более чем на 10%. "
          "Комиссии и налоги не учтены.\n"]
    for cls, (syms, start, focus) in CLASSES.items():
        is_crypto = cls == "Крипта"
        rows = []
        for sym in syms:
            try:
                data = bt.yahoo(sym)
            except Exception:  # noqa: BLE001
                continue
            close, volume = data["close"], data["volume"]
            ind = bt.indicators(close, volume, vix, fng)
            ret30 = close / close.shift(30) - 1
            ret90 = close / close.shift(90) - 1
            ind = ind[ind.index >= start].iloc[bt.WARMUP if close.index[0] >= pd.Timestamp(start) else 0:]
            if len(ind) < 500:
                continue
            close = close.loc[ind.index]
            price = close.values
            n = len(price)
            years = ((close.index - close.index[0]).days / 365.25).values.astype(float)
            ret30, ret90 = ret30.loc[ind.index], ret90.loc[ind.index]

            buys = bt.buy_rules(ind, "Крипта" if is_crypto else ("США" if cls == "Акции и фонды" else ""))
            buys["SMA200 из перебора"] = bt.ladder(ind["sma"], [0.8, 0.95, 1.2], [1, 3, 1, 0])
            deep = -0.30 if is_crypto else -0.10
            buys["Дно: RSI<30 и падение за 90 дн"] = np.where((ind["rsi"] < 30) & (ret90 < deep), 3.0,
                                                               np.where(ind["rsi"] < 30, 2.0, 1.0))
            sells = bt.sell_rules(ind)
            hot = 0.50 if is_crypto else 0.15
            sells["Перегрев: RSI>75 и рост за 30 дн"] = np.where((ind["rsi"] > 75) & (ret30 > hot), 1.0, 0.0)
            if is_crypto:
                if sym != "BTC-USD":
                    buys["Монета/BTC к SMA200"] = bt.ladder(ratios[sym].reindex(ind.index), [0.8, 1.0, 1.4], [3, 2, 1, 0])
                buys["ETH/BTC к SMA200"] = bt.ladder(eth_btc.reindex(ind.index), [0.8, 1.0, 1.4], [3, 2, 1, 0])
                buys["Доля стейблов к SMA200"] = bt.ladder(stable.reindex(ind.index), [0.8, 1.0, 1.2], [0, 1, 2, 3])
                buys["Зона «альты к BTC низко» ×3"] = np.where(alt_zone.reindex(ind.index).fillna(False), 3.0, 1.0)
                sells["Жадность F&G>75 ×1"] = np.where(ind["fng"] > 75, 1.0, 0.0)
                sells["Жадность F&G>75 ×3"] = np.where(ind["fng"] > 75, 3.0, 0.0)

            zero = np.zeros(n)
            b_irr, b_profit, b_inv, _ = sim(price, years, np.ones(n), zero, False, False)

            def add(name, kind, model, irr, profit, inv, nsell):
                edge = irr - b_irr
                floor = b_profit - 0.10 * abs(b_profit)
                v = "хуже" if (edge < -TOL or (nsell > 0 and profit < floor)) else ("лучше" if edge > TOL else "наравне")
                rows.append({"стратегия": name, "продажи": kind, "модель": model, "sym": sym, "edge": edge,
                             "verdict": v, "inv": inv, "money": inv / b_inv, "profit": profit, "dca_profit": b_profit})

            for bname, b in buys.items():
                bl = lag(b, 1.0)
                for sname, s in sells.items():
                    target = isinstance(s, str)
                    sl = zero if target else lag(s, 0.0)
                    if sname == "":
                        add(bname, "нет", "сбережения", *sim(price, years, bl, zero, False, False))
                        continue
                    name = f"{bname} + {sname}"
                    add(name, "да", "сбережения", *sim(price, years, bl, sl, target, False))
                    add(name, "пропуск вместо продажи", "сбережения", *sim(price, years, bl, sl, target, True))

            if is_crypto:
                def zone_of(x, th):
                    z = np.searchsorted(np.array(th, dtype=float), lag(x, np.nan), side="right").astype(np.int8)
                    z[np.isnan(lag(x, np.nan))] = 4
                    return z
                z_fng = zone_of(ind["fng"].values, (25, 45, 75))
                res = [("Резерв, страх: покупать всё; на жадности продавать 0.5% позиции", z_fng, (1, 1, 1, -0.005)),
                       ("Резерв, страх: 25% на сильном страхе, 5% на страхе, ждать; на жадности продавать 1%", z_fng, (0.25, 0.05, 0, -0.01))]
                if sym != "BTC-USD":
                    z_cb = zone_of(ratios[sym].reindex(ind.index).values, (0.8, 1.0, 1.4))
                    res.append(("Резерв, монета/BTC: 1% / 1% / 10% резерва; выше 1.4 продавать 2% позиции", z_cb, (0.01, 0.01, 0.10, -0.02)))
                z_alt = lag(alt_zone.reindex(ind.index).fillna(False).values.astype(float), 0.0).astype(np.int8)
                for name, z, act in res:
                    for kind, a in (("да", act), ("пропуск вместо продажи", tuple(max(x, 0.0) for x in act))):
                        irr, profit = reserve_irr(price, years, z, np.array(list(a) + [1.0]))
                        add(name, kind, "резерв", irr, profit, b_inv, 1 if kind == "да" else 0)
                for name, act in (("Резерв, зона «альты к BTC низко»: 2% вне зоны, 25% в зоне", (0.02, 0.25)),
                                  ("Резерв, зона «альты к BTC низко»: ждать вне зоны, 25% в зоне", (0.0, 0.25))):
                    irr, profit = reserve_irr(price, years, z_alt, np.array(act))
                    add(name, "нет", "резерв", irr, profit, b_inv, 0)

        df = pd.DataFrame(rows)
        g = df.groupby(["стратегия", "продажи", "модель"], sort=False)
        t = pd.DataFrame({
            "активов": g.size(),
            "к DCA, п.п.": g["edge"].median().round(1),
            "лучше": g["verdict"].apply(lambda v: int((v == "лучше").sum())),
            "хуже": g["verdict"].apply(lambda v: int((v == "хуже").sum())),
            "деньги к DCA": g["money"].median().round(2),
            "прибыль, $ тыс.": (g["profit"].sum() / 1000).round(0),
            "прибыль к DCA": (g["profit"].sum() / g["dca_profit"].sum()).round(2),
            "прибыль на $1 вложений": (g["profit"].sum() / g["inv"].sum()).round(2),
        })
        for f in focus:
            t[f.replace("-USD", "")] = df[df.sym == f].set_index(["стратегия", "продажи", "модель"])["edge"].round(1)
        t = t.reset_index().sort_values("к DCA, п.п.", ascending=False)
        t = t[~((t["стратегия"] == "DCA") & (t["продажи"] == "нет"))]
        t.insert(0, "№", range(1, len(t) + 1))
        slug = {"Крипта": "crypto", "Акции и фонды": "stocks", "Металлы, сырьё, облигации": "metals"}[cls]
        t.to_csv(os.path.join(bt.OUT, f"ranking_{slug}.csv"), index=False)
        dca_total = df[(df["стратегия"] == "DCA") & (df["продажи"] == "нет")]["profit"].sum() / 1000
        dd = df[(df["стратегия"] == "DCA") & (df["продажи"] == "нет")]
        dca_roi = dd["profit"].sum() / dd["inv"].sum()
        md.append(f"\n## {cls}\n\nАктивов: {df.sym.nunique()}, период с {start[:4]} года, стратегий: {len(t)}. "
                  f"Прибыль обычного DCA на все активы: ${dca_total:,.0f} тыс., на $1 вложений: {dca_roi:.2f}.\n")
        md.append(t.to_markdown(index=False))

        # сравнение: продажи против пропуска против без правила
        s = t[t["продажи"] == "да"].set_index(["стратегия", "модель"])
        k = t[t["продажи"] == "пропуск вместо продажи"].set_index(["стратегия", "модель"])
        j = s.join(k, lsuffix=" (прод.)", rsuffix=" (проп.)")
        print(f"\n===== {cls}: стратегий {len(t)}, активов {df.sym.nunique()}, прибыль DCA ${dca_total:,.0f} тыс.")
        pd.set_option("display.width", 300, "display.max_colwidth", 90, "display.max_rows", 300)
        print("топ-15:")
        print(t.head(15).drop(columns=["активов"]).to_string(index=False))
        print("\nтолько покупки (без продаж), топ-10:")
        print(t[t["продажи"] != "да"].head(10).drop(columns=["активов"]).to_string(index=False))
        print(f"\nпар «продажа / пропуск»: {len(j)}; пропуск дал больше прибыли в долларах в "
              f"{(j['прибыль, $ тыс. (проп.)'] > j['прибыль, $ тыс. (прод.)']).sum()} парах; "
              f"медиана «хуже DCA, активов»: продажи {j['хуже (прод.)'].median():.0f}, пропуск {j['хуже (проп.)'].median():.0f}")
    with open(os.path.join(bt.OUT, "ranking.md"), "w") as f:
        f.write("\n".join(md) + "\n")


if __name__ == "__main__":
    main()
