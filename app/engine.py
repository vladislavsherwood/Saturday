"""Стратегии. Один и тот же код даёт и историю решений для бэктеста, и решение на сегодня.

Решение дня: целое от -3 до 3. Плюс — купить на столько единиц, минус — продать на столько единиц, 0 — пропуск.
Решение принимается по закрытию дня и исполняется на следующий день.
"""
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
}


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
    return {"btc": "mvrv", "alt": "coin_btc"}.get(kind, "dca")


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

    keep = idx >= START
    out = {
        "symbol": symbol, "kind": kind, "price": price, "currency": currency,
        "as_of": idx[-1].strftime("%Y-%m-%d"),
        "t": [int(x) for x in (idx[keep] - pd.Timestamp("1970-01-01")).days],   # дни от 1970-01-01
        "c": [float(f"{x:.6g}") for x in close[keep].values],
        "strategies": [
            {"code": k, "name": STRATEGIES[k][0], "about": STRATEGIES[k][1],
             "acts": "".join(CODES[int(a) + 3] for a in acts[k][keep]), "today": int(acts[k][-1]), **meta.get(k, {})}
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
            "label": st.get("label"), "edges": st.get("edges"), "value": st.get("value")}
