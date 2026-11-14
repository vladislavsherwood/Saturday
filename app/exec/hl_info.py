"""Hyperliquid: только чтение (POST https://api.hyperliquid.xyz/info). Ключей нет, подписи нет, ордера не отправляются.

Что здесь:
  * info() — запрос к Info API с повторами;
  * resolve_markets() — для каждой монеты пользователя находит спот-пару к USDC (через токены Unit: UBTC, UETH, USOL, UPUMP, UENA, UZEC;
    HYPE — родной) и перп; номер актива для Exchange API (перп — индекс во вселенной, спот — 10000 + индекс пары);
  * round_px / round_sz — правила цены и размера Hyperliquid (не больше 5 значащих цифр и MAX_DECIMALS − szDecimals знаков после запятой;
    размер — szDecimals знаков);
  * walk_book() — исполнение заданной суммы по реальному стакану l2Book (средняя цена, проскальзывание, хватает ли глубины до лимита)."""
import json
import math
import time
import urllib.request

URL = "https://api.hyperliquid.xyz/info"
TESTNET_URL = "https://api.hyperliquid-testnet.xyz/info"
MIN_ORDER_USD = 10.0                     # Hyperliquid отклоняет ордера дешевле $10 («Order must have minimum value of $10»)
FEES = {"spot": {"taker": 0.0007, "maker": 0.0004}, "perp": {"taker": 0.00045, "maker": 0.00015}}     # базовый уровень (tier 0)

# монета пользователя → (токен на споте, перп, множитель перпа). PEPE на перпе — kPEPE (1 контракт = 1000 PEPE). DOGE/PEPE: спота нет.
WANT = {"BTC": ("UBTC", "BTC", 1), "ETH": ("UETH", "ETH", 1), "SOL": ("USOL", "SOL", 1), "HYPE": ("HYPE", "HYPE", 1),
        "PUMP": ("UPUMP", "PUMP", 1), "DOGE": (None, "DOGE", 1), "PEPE": (None, "kPEPE", 1000), "ENA": ("UENA", "ENA", 1),
        "ZEC": ("UZEC", "ZEC", 1)}


def info(payload, url=URL, tries=4, timeout=30):
    last = None
    for a in range(tries):
        try:
            req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as r:
                return json.load(r)
        except OSError as e:
            last = e
            time.sleep(1.5 * (a + 1))
    raise last


def resolve_markets(url=URL):
    """Рынки для монет пользователя по живым метаданным биржи (не по зашитым номерам: номера пар могут меняться при листингах)."""
    meta, ctxs = info({"type": "metaAndAssetCtxs"}, url)
    smeta, sctxs = info({"type": "spotMetaAndAssetCtxs"}, url)
    perps = {a["name"]: (i, a, ctxs[i]) for i, a in enumerate(meta["universe"])}
    toks = {t["index"]: t for t in smeta["tokens"]}
    sctx = {c["coin"]: c for c in sctxs}
    usdc = next(t["index"] for t in smeta["tokens"] if t["name"] == "USDC")
    pairs = {}
    for u in smeta["universe"]:
        base, quote = u["tokens"]
        if quote == usdc:
            pairs[toks[base]["name"]] = (u, toks[base], sctx.get(u["name"], {}))
    out = {}
    for coin, (tok, perp, mult) in WANT.items():
        m = {"coin": coin, "spot": None, "perp": None}
        if tok and tok in pairs:
            u, t, c = pairs[tok]
            m["spot"] = {"book": u["name"], "asset": 10000 + u["index"], "token": tok, "szDecimals": t["szDecimals"], "maxDecimals": 8,
                         "mid": float(c["midPx"]) if c.get("midPx") else None, "mark": float(c.get("markPx") or 0), "vol24": float(c.get("dayNtlVlm") or 0),
                         "fullName": t.get("fullName")}
        if perp in perps and not perps[perp][1].get("isDelisted"):
            i, a, c = perps[perp]
            m["perp"] = {"book": perp, "asset": i, "szDecimals": a["szDecimals"], "maxDecimals": 6, "maxLeverage": a["maxLeverage"], "mult": mult,
                         "mark": float(c["markPx"]), "oracle": float(c["oraclePx"]), "funding_1h": float(c["funding"]),
                         "oi_coins": float(c["openInterest"]), "vol24": float(c["dayNtlVlm"]), "onlyIsolated": bool(a.get("onlyIsolated"))}
        out[coin] = m
    return out


def round_px(px, sz_decimals, max_decimals, up):
    """Цена по правилам Hyperliquid: ≤ 5 значащих цифр (целые цены можно всегда) и ≤ max_decimals − szDecimals знаков после запятой.
    up=True округляет вверх (лимит покупки), иначе вниз (лимит продажи) — чтобы лимит не стал строже задуманного."""
    if px >= 100000:
        return float(math.ceil(px) if up else math.floor(px))
    dec = max_decimals - sz_decimals
    sig = 5 - int(math.floor(math.log10(px))) - 1
    d = max(0, min(dec, sig))
    f = 10 ** d
    v = math.ceil(px * f - 1e-9) / f if up else math.floor(px * f + 1e-9) / f
    return round(v, d)


def round_sz(sz, sz_decimals):
    f = 10 ** sz_decimals
    return math.floor(sz * f + 1e-9) / f


def l2(book, url=URL):
    b = info({"type": "l2Book", "coin": book}, url)
    bids, asks = b["levels"]
    return {"time": b.get("time"), "bids": [(float(x["px"]), float(x["sz"])) for x in bids], "asks": [(float(x["px"]), float(x["sz"])) for x in asks]}


def walk_book(book, side, size, limit_px):
    """Сколько исполнится по стакану при IOC-лимите: side 'buy' идёт по аскам до limit_px, 'sell' — по бидам. Возвращает (кол-во, средняя цена)."""
    levels = book["asks"] if side == "buy" else book["bids"]
    got = cost = 0.0
    for px, sz in levels:
        if (side == "buy" and px > limit_px) or (side == "sell" and px < limit_px):
            break
        take = min(sz, size - got)
        got += take
        cost += take * px
        if got >= size - 1e-12:
            break
    return got, (cost / got if got else None)


def daily_closes(coin, days=400, url=URL):
    """Дневные свечи Hyperliquid (UTC), только завершённые дни: {дата: close}. Для перпа coin — имя перпа, для спота — '@N'."""
    now = int(time.time() * 1000)
    rows = info({"type": "candleSnapshot", "req": {"coin": coin, "interval": "1d", "startTime": now - days * 86400000, "endTime": now}}, url)
    out = {}
    for x in rows:
        if x["T"] < now:
            out[time.strftime("%Y-%m-%d", time.gmtime(x["t"] / 1000))] = float(x["c"])
    return out
