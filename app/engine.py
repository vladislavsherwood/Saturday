"""Стратегии. Один и тот же код даёт и историю решений для бэктеста, и решение на сегодня.

Решение дня: целое от -3 до 3. Плюс — купить на столько единиц, минус — продать на столько единиц, 0 — пропуск.
Решение принимается по закрытию дня и исполняется на следующий день.
"""
import json
import os
import time

import numpy as np
import pandas as pd

import data

START = "2010-01-01"
CODES = "cba0123"                     # -3..3 одним символом

# код: (название, что делает, для кого)
STRATEGIES = {
    "dca": ("DCA", "Каждый день ×1", "all"),
    "sma200": ("SMA200", "Больше, когда цена ниже средней за 200 дней", "all"),
    "rsi": ("RSI", "Больше при низком RSI", "all"),
    "dip": ("Просадка", "Больше, когда цена далеко от годового максимума", "all"),
    "bottom": ("Дно", "Больше при перепроданности после долгого падения", "all"),
    "sma200x": ("SMA200 + продажа", "Как SMA200, но продаёт при сильном перегреве", "all"),
    "coin_btc": ("К BTC", "Больше, когда монета слаба к биткоину", "alt"),
    "mvrv": ("MVRV", "Больше, когда биткоин дёшев к цене покупки всех монет", "btc"),
    "mvrvx": ("MVRV + продажа", "Как MVRV, но продаёт при перегреве", "btc"),
    "fng": ("Страх", "Больше при страхе, пропуск при жадности", "crypto"),
    "fngx": ("Страх и жадность", "Покупает на страхе, продаёт на жадности", "crypto"),
    "usdt": ("USDT.D", "Больше при высокой доле USDT на рынке", "crypto"),
    "vix": ("VIX", "Больше при высоком индексе волатильности", "stock"),
    "merged": ("Объединённая", "Продаёт на страхе и у вершины рынка, докупает из резерва на панике, у дна и на развороте", "crypto"),
}

# Объединённая стратегия работает не весами, а резервом: 1 — обычный взнос, 1 + f — взнос и доля f резерва, −f — продать долю f позиции.
# Правила проверяются по порядку, срабатывает первое. Пороги и проверки — app/found/merged.json, markers.py, merge.js.
MERGED_RULES = [(1.5, "у дна рынка: взнос и половина резерва"), (1.5, "паника в стейблах: взнос и половина резерва"), (-1.0, "вершина рынка: продать всё"),
                (-0.3, "сильный страх: продать 30%"), (-0.16, "страх: продать 16%"), (2.0, "разворот биткоина: взнос и весь резерв")]
EXTRA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "market_extra.json")


def kind_of(symbol, quote_type):
    s, q = symbol.upper(), (quote_type or "").upper()
    if s in ("BTC-USD", "BTC-USDT"):
        return "btc"
    if q == "CRYPTOCURRENCY" or (q == "" and s.endswith("-USD")):
        return "alt"
    if q in ("EQUITY", "ETF", "INDEX", "MUTUALFUND") or (q == "" and not s.endswith("=F")):
        return "stock"
    return "other"


def default_strategy(kind):
    return {"btc": "merged", "alt": "merged"}.get(kind, "dca")


def _market_extra():
    """Рыночные ряды для маркеров вершин и дна (готовит market_extra.py): ширина рынка, сеть биткоина, DeFi, MVRV."""
    d = json.load(open(EXTRA))
    return pd.DataFrame({k: d[k] for k in ("breadth", "btctx", "btcaddr", "tvldd", "mvrv")}, index=pd.to_datetime(d["t"], unit="D"), dtype=float)


def _merged(close, kind):
    """План объединённой стратегии по дням, номер сработавшего правила (−1 — ни одно) и подпись к сегодняшнему дню."""
    idx = close.index
    full = data.dominances()
    d = full.reindex(idx, method="ffill")
    usdt_r = (full["usdt"] / full["usdt"].rolling(200, min_periods=200).mean()).reindex(idx, method="ffill")
    fng = data.fear_greed().reindex(idx, method="ffill")
    btc_all = data.history("BTC-USD")[0]
    btc = close if kind == "btc" else btc_all.reindex(idx, method="ffill")
    btcr30 = (btc / btc.shift(30) - 1) * 100
    btcath = (1 - btc_all / btc_all.cummax()).reindex(idx, method="ffill") * 100
    hi90 = (close >= close.rolling(90, min_periods=60).max()).rolling(7, min_periods=1).max() > 0
    ex = _market_extra().reindex(idx, method="ffill")
    btcd90 = d["btc"] - d["btc"].shift(90)
    topm = ((d["oth"] > 27.7).astype(int) + (ex["breadth"] > 88.9) + (ex["btctx"] < 0.978) + (btcd90 < -1.35) + (ex["btcaddr"] < 1.1))
    botm = ((ex["tvldd"] > 59).astype(int) + (d["usdt"] > 6.52) + (btcath > 57.5) + (ex["mvrv"] < 1.3))
    conds = [botm > 3, (usdt_r > 1.07) & (d["oth"] < 25), hi90 & (topm > 4), (fng < 40) & (d["usdt"] < 7.6), (fng < 52) & (d["usdt"] < 7.6), (btcr30 > 20) & (topm < 4)]
    rule = np.select([c.fillna(False).values for c in conds], list(range(len(conds))), default=-1)
    plan = np.where(rule >= 0, np.array([a for a, _ in MERGED_RULES])[np.maximum(rule, 0)], 1.0)
    label = f"вершина {int(topm.iloc[-1])} из 5 · дно {int(botm.iloc[-1])} из 4"
    return plan, rule, label


def position(symbol, kind, since, unit):
    """Резерв и позиция на сегодня, если с даты since каждый день следовать плану объединённой стратегии, и сумма на сегодня."""
    s = series(symbol, kind)
    st = next(x for x in s["strategies"] if x["code"] == "merged")
    t, c, plan = s["t"], s["c"], st["plan"]
    start = (pd.Timestamp(since) - pd.Timestamp("1970-01-01")).days
    i0 = next((i for i, d in enumerate(t) if d >= start), len(t))
    cash = units = 0.0
    for i in range(i0, len(t)):
        a, before = (plan[i - 1] if i > i0 else 1.0), cash
        cash += unit
        if a < 0:
            amt = -a * units * c[i]
            units += a * units
            cash += amt
        elif a > 0:
            amt = min(cash, unit + (a - 1) * before)
            units += amt / c[i]
            cash -= amt
    a = plan[-1] if len(plan) else 1.0                 # решение по последнему закрытию исполняется сегодня
    amount = a * units * s["price"] if a < 0 else min(cash + unit, unit + (a - 1) * cash)      # минус — продать на эту сумму
    return {"reserve": round(cash, 2), "holding": round(units * s["price"], 2), "amount": round(amount, 2)}


def allowed(kind):
    scopes = {"btc": ("all", "crypto", "btc"), "alt": ("all", "crypto", "alt"), "stock": ("all", "stock")}.get(kind, ("all",))
    return [k for k, v in STRATEGIES.items() if v[2] in scopes]


def _rsi(close, n=14):
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + up / dn.replace(0, np.nan))


def _ladder(x, edges, mults):
    """Ступени по порогам. Нет данных -> обычная покупка ×1."""
    out = np.select([x < e for e in edges], mults[:-1], default=mults[-1]).astype(int)
    out[np.isnan(np.asarray(x, dtype=float))] = 1
    return out


def _meta(x, edges, label):
    v = x.iloc[-1] if len(x) else np.nan
    if pd.isna(v):
        return {}
    return {"value": round(float(v), 3), "edges": list(edges), "label": label.format(v)}


_cache = {}


def series(symbol, kind):
    """История цен и решений всех доступных стратегий по тикеру."""
    key = (symbol, kind)
    hit = _cache.get(key)
    if hit and time.time() - hit[0] < 1800:
        return hit[1]
    close, price, currency = data.history(symbol)
    if len(close) < 30:
        raise ValueError("слишком мало истории цен")
    idx = close.index
    sma = close / close.rolling(200, min_periods=200).mean()
    rsi = _rsi(close)
    dd = 1 - close / close.rolling(252, min_periods=1).max()
    ret90 = close / close.shift(90 if kind in ("btc", "alt") else 63) - 1
    acts, meta = {}, {}

    acts["dca"] = np.ones(len(close), dtype=int)
    acts["sma200"] = _ladder(sma, (0.8, 1.0, 1.4), (3, 2, 1, 0))
    meta["sma200"] = _meta(sma, (0.8, 1.0, 1.4), "{:.2f} × SMA200")
    acts["rsi"] = _ladder(rsi, (30, 40, 70), (3, 2, 1, 0))
    meta["rsi"] = _meta(rsi, (30, 40, 70), "RSI {:.0f}")
    acts["dip"] = _ladder(-dd, (-0.20, -0.10, 9), (3, 2, 1, 1))
    meta["dip"] = {"label": f"−{dd.iloc[-1] * 100:.0f}% от максимума"}
    deep = -0.30 if kind in ("btc", "alt") else -0.10
    acts["bottom"] = np.where((rsi < 30) & (ret90 < deep), 3, np.where(rsi < 30, 2, 1)).astype(int)
    meta["bottom"] = {"label": f"RSI {rsi.iloc[-1]:.0f}"}
    hot = np.where(sma > 2.0, -3, np.where(sma > 1.5, -1, 0))
    acts["sma200x"] = np.where(hot < 0, hot, acts["sma200"]).astype(int)
    meta["sma200x"] = _meta(sma, (0.8, 1.0, 1.4), "{:.2f} × SMA200")

    if kind == "alt":
        btc, _, _ = data.history("BTC-USD")
        ratio = close / btc.reindex(idx)
        r = ratio / ratio.rolling(200, min_periods=200).mean()
        acts["coin_btc"] = _ladder(r, (0.8, 1.0, 1.4), (3, 2, 1, 0))
        meta["coin_btc"] = _meta(r, (0.8, 1.0, 1.4), "{:.2f} × к BTC")
    if kind == "btc":
        m = data.mvrv_history().reindex(idx, method="ffill")
        acts["mvrv"] = _ladder(m, (1.0, 1.5, 3.0), (3, 2, 1, 0))
        meta["mvrv"] = _meta(m, (1.0, 1.5, 3.0), "MVRV {:.2f}")
        acts["mvrvx"] = np.where(m > 3.5, -3, np.where(m > 3.0, -1, acts["mvrv"])).astype(int)
        meta["mvrvx"] = _meta(m, (1.0, 1.5, 3.0), "MVRV {:.2f}")
    if kind in ("btc", "alt"):
        f = data.fear_greed().reindex(idx, method="ffill")
        acts["fng"] = _ladder(f, (25, 45, 75), (3, 2, 1, 0))
        meta["fng"] = _meta(f, (25, 45, 75), "Страх и жадность {:.0f}")
        acts["fngx"] = _ladder(f, (25, 45, 75), (3, 2, 1, -1))
        meta["fngx"] = _meta(f, (25, 45, 75), "Страх и жадность {:.0f}")
        u = data.usdt_dominance().reindex(idx, method="ffill")
        ur = u / u.rolling(200, min_periods=200).mean()
        acts["usdt"] = _ladder(-ur, (-1.2, -1.0, -0.8), (3, 2, 1, 0))
        meta["usdt"] = {"label": f"USDT.D {u.iloc[-1]:.1f}%"} if pd.notna(u.iloc[-1]) else {}
    if kind == "stock":
        v = data.history("^VIX")[0].reindex(idx, method="ffill")
        acts["vix"] = _ladder(-v, (-30, -20, 9), (3, 2, 1, 1))
        meta["vix"] = {"label": f"VIX {v.iloc[-1]:.0f}"} if pd.notna(v.iloc[-1]) else {}

    plans = {}
    if kind in ("btc", "alt") and os.path.exists(EXTRA):
        try:
            plan, rule, label = _merged(close, kind)
            plans["merged"] = plan
            # для отметок и трёх полосок на главном экране план переводится в привычные −3…3
            acts["merged"] = np.select([plan <= -1, plan <= -0.3, plan < 0, plan >= 2, plan > 1], [-3, -2, -1, 3, 2], default=1).astype(int)
            meta["merged"] = {"label": label, "action": MERGED_RULES[rule[-1]][1] if rule[-1] >= 0 else "обычный взнос", "plan_today": float(plan[-1])}
        except Exception as e:  # noqa: BLE001
            print("объединённая стратегия:", e)

    keep = idx >= START
    out = {
        "symbol": symbol, "kind": kind, "price": price, "currency": currency,
        "as_of": idx[-1].strftime("%Y-%m-%d"),
        "t": [int(x) for x in (idx[keep] - pd.Timestamp("1970-01-01")).days],   # дни от 1970-01-01
        "c": [float(f"{x:.6g}") for x in close[keep].values],
        **{k: [float(f"{x:.6g}") for x in data.ohlc(symbol)[k].reindex(idx)[keep].values] for k in ("o", "h", "l")},
        "strategies": [
            {"code": k, "name": STRATEGIES[k][0], "about": STRATEGIES[k][1],
             "acts": "".join(CODES[int(a) + 3] for a in acts[k][keep]), "today": int(acts[k][-1]), **meta.get(k, {}),
             **({"plan": [float(x) for x in plans[k][keep]]} if k in plans else {})}
            for k in allowed(kind) if k in acts
        ],
    }
    _cache[key] = (time.time(), out)
    return out


def decide(symbol, kind, strategy):
    """Решение на сегодня по выбранной стратегии."""
    s = series(symbol, kind)
    st = next((x for x in s["strategies"] if x["code"] == strategy), s["strategies"][0])
    return {"mult": st["today"], "price": s["price"], "currency": s["currency"], "as_of": s["as_of"],
            "label": st.get("label"), "edges": st.get("edges"), "value": st.get("value"),
            "action": st.get("action"), "reserve_mode": "plan" in st}
