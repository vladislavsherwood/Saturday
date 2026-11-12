"""Стратегии: по данным на вчерашнее закрытие решают, на сколько единиц купить сегодня (0..3)."""
import data

# код: (название, описание, для кого)
STRATEGIES = {
    "dca": ("Обычный DCA", "Каждый день ×1", "all"),
    "sma200": ("Лестница SMA200", "Больше, когда цена ниже средней за 200 дней", "all"),
    "rsi": ("Лестница RSI", "Больше при низком RSI(14)", "all"),
    "coin_btc": ("Монета к BTC", "Больше, когда монета слаба к биткоину", "crypto"),
    "mvrv": ("MVRV", "Больше, когда биткоин дёшев относительно цены покупки всех монет", "btc"),
}


def kind_of(symbol, quote_type):
    if symbol.upper() in ("BTC-USD", "BTC-USDT"):
        return "btc"
    if (quote_type or "").upper() == "CRYPTOCURRENCY" or symbol.upper().endswith("-USD"):
        return "crypto"
    return "other"


def default_strategy(kind):
    return {"btc": "mvrv", "crypto": "coin_btc"}.get(kind, "dca")


def allowed(kind):
    return [k for k, v in STRATEGIES.items() if v[2] in ("all", kind)]


def _ladder(x, edges, mults):
    for e, m in zip(edges, mults):
        if x < e:
            return m
    return mults[-1]


def _rsi(close, n=14):
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, adjust=False).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, adjust=False).mean()
    return float((100 - 100 / (1 + up / dn)).iloc[-1])


def _zone_text(x, edges, labels):
    for e, lab in zip(edges, labels):
        if x < e:
            return lab
    return labels[-1]


def decide(symbol, strategy):
    """Возвращает словарь: mult, reason, value, price, as_of, currency."""
    close, price, currency = data.history(symbol)
    if len(close) < 30:
        raise ValueError("слишком мало истории цен")
    out = {"price": price, "currency": currency, "as_of": close.index[-1].strftime("%Y-%m-%d")}
    if strategy == "sma200":
        if len(close) < 200:
            return {**out, "mult": 1, "reason": "мало истории для SMA200 — обычная покупка", "value": None}
        r = float(close.iloc[-1] / close.iloc[-200:].mean())
        m = _ladder(r, (0.8, 1.0, 1.4), (3, 2, 1, 0))
        txt = _zone_text(r, (0.8, 1.0, 1.4), ("намного ниже средней", "ниже средней", "выше средней", "сильно выше средней"))
        return {**out, "mult": m, "reason": f"цена {r:.2f} от средней за 200 дней — {txt}", "value": round(r, 3)}
    if strategy == "rsi":
        r = _rsi(close)
        m = _ladder(r, (30, 40, 70), (3, 2, 1, 0))
        txt = _zone_text(r, (30, 40, 70), ("перепродан", "слабый", "нейтральный", "перегрет"))
        return {**out, "mult": m, "reason": f"RSI {r:.0f} — {txt}", "value": round(r, 1)}
    if strategy == "coin_btc":
        btc, _, _ = data.history("BTC-USD")
        ratio = (close / btc.reindex(close.index)).dropna()
        if len(ratio) < 200:
            return {**out, "mult": 1, "reason": "мало истории для сравнения с BTC — обычная покупка", "value": None}
        r = float(ratio.iloc[-1] / ratio.iloc[-200:].mean())
        m = _ladder(r, (0.8, 1.0, 1.4), (3, 2, 1, 0))
        txt = _zone_text(r, (0.8, 1.0, 1.4), ("очень слаба к BTC", "слабее BTC", "сильнее BTC", "резко сильнее BTC"))
        return {**out, "mult": m, "reason": f"курс к BTC {r:.2f} от своей средней — {txt}", "value": round(r, 3)}
    if strategy == "mvrv":
        v = data.mvrv()
        r = v["value"]
        m = _ladder(r, (1.0, 1.5, 3.0), (3, 2, 1, 0))
        txt = _zone_text(r, (1.0, 1.5, 3.0), ("рынок в убытке", "недорого", "нейтрально", "перегрев"))
        return {**out, "mult": m, "reason": f"значение {r:.2f} — {txt}", "value": round(r, 3)}
    return {**out, "mult": 1, "reason": "обычная покупка", "value": None}
