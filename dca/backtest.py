"""Простой бэктест DCA-стратегий.

Правила:
- единица = $10, решение каждый торговый день, максимум x3 в день;
- эталон = покупка x1 каждый день;
- сигнал считается по вчерашнему закрытию, сделка идёт по сегодняшнему;
- в один день одно действие: пропуск, покупка x1..x3 или продажа x1..x3;
- комиссии и налоги не учитываются.

Запуск: python3 dca/backtest.py
"""
import json
import os
import time
import urllib.parse
import urllib.request

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = os.path.join(HERE, "out")
UNIT = 10.0
START = "2010-01-01"
WARMUP = 50          # дней на разогрев индикаторов
MIN_DAYS = 200       # минимум истории, чтобы тикер попал в расчёт
TOL = 0.5            # п.п. годовых: в этих пределах считаем "наравне"

# имя -> (символ Yahoo, группа)
TICKERS = {
    "SPY": ("SPY", "США"),
    "QQQ": ("QQQ", "США"),
    "AAPL": ("AAPL", "США"),
    "NVDA": ("NVDA", "США"),
    "TA-125": ("^TA125.TA", "Израиль"),
    "Золото": ("GC=F", "Металлы"),
    "Серебро": ("SI=F", "Металлы"),
    "BTC": ("BTC-USD", "Крипта"),
    "ETH": ("ETH-USD", "Крипта"),
    "SOL": ("SOL-USD", "Крипта"),
    "ZEC": ("ZEC-USD", "Крипта"),
    "HYPE": ("HYPE32196-USD", "Крипта"),
    "DOGE": ("DOGE-USD", "Мемкоины"),
    "PEPE": ("PEPE24478-USD", "Мемкоины"),
    "SHIB": ("SHIB-USD", "Мемкоины"),
    "BONK": ("BONK-USD", "Мемкоины"),
    "WIF": ("WIF-USD", "Мемкоины"),
    "FARTCOIN": ("FARTCOIN-USD", "Мемкоины"),
    "PUMP": ("PUMP36507-USD", "Мемкоины"),
    "USELESS": ("USELESS36828-USD", "Мемкоины"),
}


# ---------- данные ----------

def _get(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def yahoo(symbol):
    """Дневные цены закрытия с Yahoo, с кэшем на день."""
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, symbol.replace("^", "_").replace("=", "_") + ".csv")
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < 20 * 3600:
        return pd.read_csv(path, index_col=0, parse_dates=True)["close"]
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/"
           + urllib.parse.quote(symbol) + "?period1=0&period2=9999999999&interval=1d")
    res = _get(url)["chart"]["result"][0]
    quote = res["indicators"]["quote"][0]["close"]
    adj = res["indicators"].get("adjclose", [{}])[0].get("adjclose")
    s = pd.Series(adj or quote, index=pd.to_datetime(res["timestamp"], unit="s").normalize(), name="close")
    s = s.dropna()
    s = s[s > 0]
    s = s[~s.index.duplicated(keep="last")]
    s.to_frame().to_csv(path)
    return s


def fear_greed():
    path = os.path.join(CACHE, "fng.csv")
    if os.path.exists(path) and time.time() - os.path.getmtime(path) < 20 * 3600:
        return pd.read_csv(path, index_col=0, parse_dates=True)["fng"]
    data = _get("https://api.alternative.me/fng/?limit=0")["data"]
    s = pd.Series({pd.to_datetime(int(d["timestamp"]), unit="s").normalize(): float(d["value"]) for d in data},
                  name="fng").sort_index()
    s.to_frame().to_csv(path)
    return s


# ---------- индикаторы ----------

def rsi(close, n=14):
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / dn.replace(0, np.nan))


def ladder(x, edges, values):
    """Ступени: values[i] для x в интервале между edges. NaN -> x1."""
    out = np.select([x < e for e in edges], values[:-1], default=values[-1]).astype(float)
    out[np.isnan(x.values)] = 1.0
    return out


def indicators(close, vix, fng):
    ind = pd.DataFrame(index=close.index)
    ind["dd"] = 1 - close / close.rolling(252, min_periods=1).max()      # просадка от годового максимума
    ind["rsi"] = rsi(close)
    ind["sma"] = close / close.rolling(200, min_periods=WARMUP).mean()   # цена / SMA200
    mid = close.rolling(20).mean()
    sd = close.rolling(20).std()
    ind["bb"] = (close - mid) / (2 * sd)                                  # <-1 ниже нижней полосы, >1 выше верхней
    ind["w1"] = close / close.shift(5) - 1
    ind["w3"] = ((close < close.shift(5)) & (close.shift(5) < close.shift(10))
                 & (close.shift(10) < close.shift(15))).astype(float)
    ind["vix"] = vix.reindex(close.index, method="ffill")
    ind["fng"] = fng.reindex(close.index, method="ffill")
    return ind


# ---------- правила ----------

def buy_rules(ind, group):
    r = {"DCA": np.ones(len(ind))}
    r["Просадка"] = ladder(ind["dd"], [0.10, 0.20], [1, 2, 3])
    r["RSI"] = ladder(ind["rsi"], [30, 40, 70], [3, 2, 1, 0])
    r["SMA200"] = ladder(ind["sma"], [0.8, 1.0, 1.4], [3, 2, 1, 0])
    r["Боллинджер"] = ladder(ind["bb"], [-1, 1], [3, 1, 0])
    rw = np.where(ind["w3"] > 0, 3, np.where(ind["w1"] < 0, 2, 1)).astype(float)
    r["Красная неделя"] = rw
    if group == "США":
        r["VIX"] = ladder(ind["vix"], [20, 30], [1, 2, 3])
    if group in ("Крипта", "Мемкоины"):
        r["Fear&Greed"] = ladder(ind["fng"], [25, 45, 75], [3, 2, 1, 0])
    return r


def sell_rules(ind):
    z = np.zeros(len(ind))
    return {
        "": z,
        "RSI>80": np.where(ind["rsi"] > 80, 1.0, 0.0),
        "SMA200>1.5": ladder(ind["sma"].fillna(1), [1.5, 2.0], [0, 1, 3]),
        "Ниже SMA200": np.where(ind["sma"] < 1.0, 3.0, 0.0),
        "Цель +100%": "target",
    }


# ---------- симуляция ----------

def xirr(cf, years):
    """Годовая доходность потока платежей (бисекция по ln(1+r))."""
    if not (cf < 0).any() or not (cf > 0).any():
        return np.nan
    lo, hi = -12.0, 12.0
    f = lambda x: float(np.sum(cf * np.exp(-x * years)))
    if f(lo) * f(hi) > 0:
        return np.nan
    for _ in range(80):
        m = (lo + hi) / 2
        if f(lo) * f(m) <= 0:
            hi = m
        else:
            lo = m
    return float(np.expm1((lo + hi) / 2))


def simulate(price, years, buy, sell):
    """buy/sell — множители уже со сдвигом на день. Возвращает метрики."""
    n = len(price)
    cf = np.zeros(n)
    units = cost = invested = 0.0
    n_buy = n_sell = 0
    target = isinstance(sell, str)
    for i in range(n):
        p = price[i]
        s = (3.0 if (units > 0 and units * p > 2 * cost) else 0.0) if target else sell[i]
        if s > 0:
            amt = min(s * UNIT, units * p)
            if amt > 0:
                frac = amt / (units * p)
                cost -= cost * frac
                units -= amt / p
                cf[i] = amt
                n_sell += 1
            continue
        b = buy[i]
        if b > 0:
            amt = b * UNIT
            units += amt / p
            cost += amt
            invested += amt
            cf[i] = -amt
            n_buy += 1
    final = units * price[-1]
    received = cf[cf > 0].sum()
    cf2 = cf.copy()
    cf2[-1] += final
    return {
        "xirr": xirr(cf2, years) * 100,
        "invested": invested,
        "profit": final + received - invested,
        "n_buy": n_buy,
        "n_sell": n_sell,
    }


def verdict(edge, profit, base_profit, n_sell):
    """Сравнение по годовой доходности. Для стратегий с продажами дополнительно:
    прибыль в долларах не должна быть меньше, чем у DCA (допуск 10%)."""
    floor = base_profit - 0.10 * abs(base_profit)
    if np.isnan(edge):
        edge = 0.0
    if edge < -TOL or (n_sell > 0 and profit < floor):
        return "хуже"
    if edge > TOL:
        return "лучше"
    return "наравне"


def run_segment(close, ind, group):
    """Все стратегии на одном отрезке. Возвращает {стратегия: метрики}."""
    price = close.values
    years = (close.index - close.index[0]).days.values / 365.25
    sub = ind.loc[close.index]
    res = {}
    for bname, b_ in buy_rules(sub, group).items():
        bs = np.concatenate([[1.0], b_[:-1]])
        for sname, s_ in sell_rules(sub).items():
            if bname == "DCA" and sname == "":
                name = "DCA"
            else:
                name = bname + (" + " + sname if sname else "")
            ss = s_ if isinstance(s_, str) else np.concatenate([[0.0], s_[:-1]])
            res[name] = simulate(price, years, bs, ss)
    return res


def main():
    os.makedirs(OUT, exist_ok=True)
    vix = yahoo("^VIX")
    fng = fear_greed()
    rows, info = [], []
    for name, (sym, group) in TICKERS.items():
        try:
            close = yahoo(sym)
        except Exception as e:  # noqa: BLE001
            print(f"{name}: нет данных ({e})")
            continue
        close = close[close.index >= START]
        if len(close) < MIN_DAYS + WARMUP:
            print(f"{name}: мало истории ({len(close)} дн.), пропуск")
            continue
        ind = indicators(close, vix, fng)
        close = close.iloc[WARMUP:]
        yrs = (close.index[-1] - close.index[0]).days / 365.25
        info.append({"ticker": name, "group": group, "from": close.index[0].date(),
                     "to": close.index[-1].date(), "years": round(yrs, 1)})
        mid = len(close) // 2
        segs = {"full": close, "h1": close.iloc[:mid], "h2": close.iloc[mid:]}
        for seg, c in segs.items():
            res = run_segment(c, ind, group)
            base = res["DCA"]
            seg_years = (c.index[-1] - c.index[0]).days / 365.25
            for strat, m in res.items():
                rows.append({"ticker": name, "group": group, "segment": seg, "strategy": strat,
                             "years": seg_years, "edge": m["xirr"] - base["xirr"],
                             "base_profit": base["profit"], "base_invested": base["invested"], **m})
        print(f"{name}: {len(close)} дн., {yrs:.1f} лет")
    df = pd.DataFrame(rows)
    df["verdict"] = [verdict(e, p, bp, ns) for e, p, bp, ns in zip(df.edge, df.profit, df.base_profit, df.n_sell)]
    df.to_csv(os.path.join(OUT, "results.csv"), index=False)
    pd.DataFrame(info).to_csv(os.path.join(OUT, "tickers.csv"), index=False)

    # сводка по стратегиям
    d = df[df.strategy != "DCA"]
    full, halves = d[d.segment == "full"], d[d.segment != "full"]
    g = full.groupby("strategy")
    cnt = lambda v: g["verdict"].apply(lambda x: int((x == v).sum()))
    summ = pd.DataFrame({
        "тикеров": g.size(),
        "лучше": cnt("лучше"), "наравне": cnt("наравне"), "хуже": cnt("хуже"),
        "медиана_пп": g["edge"].median().round(1),
        "худший_пп": g["edge"].min().round(1),
        "деньги_к_DCA": g.apply(lambda x: (x.invested / x.base_invested).median()).round(2),
        "прибыль_к_DCA": g.apply(lambda x: (x.profit / x.base_profit).median()).round(2),
        "продаж_в_год": g.apply(lambda x: (x.n_sell / x.years).median()).round(0),
    })
    hh = halves.groupby("strategy")["verdict"]
    summ["половин_не_хуже"] = hh.apply(lambda v: f"{int((v != 'хуже').sum())}/{len(v)}")
    summ["доля"] = hh.apply(lambda v: round(float((v != "хуже").mean()), 2))
    summ["доля_тикеров_хуже"] = (summ["хуже"] / summ["тикеров"]).round(2)
    summ = summ.sort_values(["доля_тикеров_хуже", "доля", "медиана_пп"], ascending=[True, False, False])
    summ.to_csv(os.path.join(OUT, "summary.csv"))
    # по группам: лучше/наравне/хуже
    bg = full.groupby(["strategy", "group"])["verdict"].apply(
        lambda v: f"{(v == 'лучше').sum()}/{(v == 'наравне').sum()}/{(v == 'хуже').sum()}").unstack().fillna("-")
    bg.reindex(summ.index).to_csv(os.path.join(OUT, "by_group.csv"))
    pd.set_option("display.width", 250, "display.max_rows", 100)
    print()
    print(summ.drop(columns=["доля_тикеров_хуже"]).to_string())
    print()
    print(bg.reindex(summ.index).to_string())


if __name__ == "__main__":
    main()
