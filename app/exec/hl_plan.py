"""План стратегии на сегодня → список ордеров Hyperliquid (без отправки).

Модель счёта (как agent2_margin.sim2, но под устройство Hyperliquid):
  * у каждой монеты свой резерв в USDC, количество монет на споте (units) и «долг» — номинал плечевой ноги на перпе (debt, $);
  * покупка с плечом L на сумму v из резерва: спот-покупка на v + лонг перпа на (L − 1)·v (кросс-маржа, залог — USDC резервов);
    у DOGE и PEPE спота на Hyperliquid нет: вся покупка (L·v) идёт в лонг перпа, v остаётся залогом в USDC;
  * продажа доли f: продаём f монет на споте и закрываем f перп-позиции reduce-only (как в sim2: «продают монету и гасят долг в той же доле»);
  * шорт BTC: перп BTC, размер — доля капитала счёта на день входа; держится до сигнала выхода;
  * минимальный ордер Hyperliquid $10: покупки меньше минимума копятся (deferred) и исполняются, когда сумма ≥ min_buy_usd;
    продажи меньше минимума пропускаются (остаются в позиции) — это записывается в журнал.
Идемпотентность: у каждого ордера cloid = первые 16 байт sha256("день|монета|нога") — повторный запуск в тот же день даёт те же cloid,
и исполнитель перед отправкой проверяет orderStatus / userFills по cloid, чтобы не купить дважды."""
import hashlib
import math

import numpy as np
import pandas as pd

from hl_info import FEES, MIN_ORDER_USD, round_px, round_sz, walk_book

DEFAULTS = {
    "unit_usd": 2.0,              # взнос в день на монету
    "min_buy_usd": 11.0,          # копим мелкие взносы до этой суммы (минимум биржи $10 + запас на округление и движение цены)
    "slippage": 0.005,            # лимит IOC: лучшая цена ± 0,5%
    "max_order_usd": 500.0,       # один ордер не больше
    "max_daily_usd": 1500.0,      # все ордера за день не больше (сумма номиналов)
    "max_spread_bp": 60.0,        # шире — не торгуем этой монетой сегодня
    "max_impact_bp": 100.0,       # средняя цена хуже середины стакана больше чем на 1% — не торгуем
    "min_liq_drop": 0.5,          # плечевые ноги разрешены, только если до ликвидации всего счёта нужно равномерное падение ≥ 50%
    "prefer_perp_for": [],        # монеты, которые держать на перпе даже при наличии спота (по умолчанию — спот, где он есть)
}


def cloid(day, coin, leg):
    return "0x" + hashlib.sha256(f"{day}|{coin}|{leg}".encode()).hexdigest()[:32]


def simulate_state(close, act, grp, lev, unit, since):
    """Состояние монеты на утро дня исполнения, если с since каждый день исполнять план (решение вчера — сделка сегодня по закрытию).
    Это модель для сухого режима; в боевом режиме состояние берётся из журнала сделок и балансов биржи."""
    idx = close.index
    i0 = int(np.searchsorted(idx.values, np.datetime64(pd.Timestamp(since))))
    r = u = debt = 0.0
    c = close.values
    for i in range(i0, len(idx)):
        a = act[i - 1] if i > i0 else 1.0
        g = grp[i - 1] if i > i0 else 0
        before = r
        r += unit
        p = c[i]
        if a < 0:
            f = -a
            r += f * (u * p * (1 - FEES["spot"]["taker"]) - debt)
            u *= 1 - f
            debt *= 1 - f
        else:
            v = min(r, unit + (a - 1) * before)
            if v > 0:
                b = (lev.get(int(g), 1.0) - 1) * v
                r -= v
                u += (v + b) * (1 - FEES["spot"]["taker"]) / p
                debt += b
    return {"reserve": r, "units": u, "debt": debt, "since": str(pd.Timestamp(since).date())}


def intents(coin, a, g, lev, st, unit, price, market, cfg):
    """Что сделать сегодня по монете в долларах. a — доля действия из плана (1 — взнос, 1+f — взнос и f резерва, −f — продать f).
    Резерв st['reserve'] уже без сегодняшнего взноса; сегодняшний взнос добавляется здесь."""
    out = []
    before = st["reserve"]
    reserve = before + unit
    has_spot = market["spot"] is not None and coin not in cfg["prefer_perp_for"]
    L = lev.get(int(g), 1.0)
    if a < 0:
        f = -a
        if st["units"] > 0:
            out.append({"leg": "spot_sell" if has_spot else "perp_reduce", "usd": f * st["units"] * price, "units": f * st["units"], "frac": f})
        if st["debt"] > 0 and has_spot:
            out.append({"leg": "perp_reduce", "usd": f * st["debt"], "frac": f, "lev_leg": True})
    else:
        v = min(reserve, unit + (a - 1) * before)
        if v > 0:
            b = (L - 1) * v
            if has_spot:
                out.append({"leg": "spot_buy", "usd": v})
                if b > 0:
                    out.append({"leg": "perp_long", "usd": b, "lev_leg": True, "lev": L})
            else:
                out.append({"leg": "perp_long", "usd": v + b, "lev": L, "lev_leg": b > 0})
    return out


def margin_health(usdc, longs, shorts, mmr):
    """Грубая оценка кросс-маржи: USDC-залог, лонги и шорты перпов ($) и ставка поддерживающей маржи по монете.
    Возвращает равномерное падение цен лонгов (доля), при котором счёт уйдёт в ликвидацию (шорты при этом в плюсе не учитываются — запас)."""
    N = sum(longs.values())
    mm = sum(longs[k] * mmr[k] for k in longs) + sum(shorts[k] * mmr[k] for k in shorts)
    if N <= 0:
        return 1.0
    x = (usdc - mm) / (N * (1 - max(mmr.values() or [0])))
    return max(0.0, min(1.0, x))


def build_orders(day, coin, legs, market, books, cfg, deferred):
    """Доллары → ордера с ценой и размером по правилам биржи и проверкой по стакану. Ничего не отправляет."""
    orders, notes = [], []
    for lg in legs:
        perp = lg["leg"].startswith("perp")
        m = market["perp"] if perp else market["spot"]
        if m is None:
            notes.append(f"{coin}: нет рынка для {lg['leg']}")
            continue
        book = books[m["book"]]
        bid, ask = book["bids"][0][0], book["asks"][0][0]
        mid = (bid + ask) / 2
        spread_bp = (ask - bid) / mid * 1e4
        is_buy = lg["leg"] in ("spot_buy", "perp_long")
        usd = lg["usd"]
        if lg["leg"] == "spot_buy" or (lg["leg"] == "perp_long" and not lg.get("lev_leg")):
            usd += deferred.get(coin, 0.0)
            if usd < cfg["min_buy_usd"]:
                deferred[coin] = usd
                notes.append(f"{coin}: покупка ${usd:.2f} меньше ${cfg['min_buy_usd']:.0f} — копится до следующего дня")
                continue
            deferred[coin] = 0.0
        if usd < MIN_ORDER_USD:
            notes.append(f"{coin}: {lg['leg']} ${usd:.2f} меньше минимума биржи $10 — пропуск")
            continue
        if usd > cfg["max_order_usd"]:
            notes.append(f"{coin}: {lg['leg']} ${usd:.2f} урезан до лимита ${cfg['max_order_usd']:.0f}")
            usd = cfg["max_order_usd"]
        if spread_bp > cfg["max_spread_bp"]:
            notes.append(f"{coin}: спред {spread_bp:.0f} б.п. > {cfg['max_spread_bp']:.0f} — сегодня не торгуем")
            continue
        limit = round_px((ask if is_buy else bid) * (1 + cfg["slippage"] if is_buy else 1 - cfg["slippage"]), m["szDecimals"], m["maxDecimals"], up=is_buy)
        units_coin = lg.get("units")
        sz = (units_coin / m.get("mult", 1)) if (units_coin and not is_buy) else usd / mid
        sz = round_sz(sz, m["szDecimals"])
        if sz * mid < MIN_ORDER_USD:
            notes.append(f"{coin}: после округления размера ${sz * mid:.2f} < $10 — пропуск")
            continue
        got, avg = walk_book(book, "buy" if is_buy else "sell", sz, limit)
        impact = abs(avg / mid - 1) * 1e4 if avg else None
        kind = "perp" if perp else "spot"
        fee = got * (avg or 0) * FEES[kind]["taker"]
        o = {"coin": coin, "leg": lg["leg"], "market": m["book"], "asset": m["asset"], "is_buy": is_buy, "sz": sz, "limit_px": limit,
             "tif": "Ioc", "reduce_only": lg["leg"] == "perp_reduce", "cloid": cloid(day, coin, lg["leg"]), "usd": round(sz * mid, 2),
             "mid": mid, "spread_bp": round(spread_bp, 1), "fill_sz": got, "avg_px": avg, "impact_bp": None if impact is None else round(impact, 1),
             "fee_usd": round(fee, 4), "lev_leg": bool(lg.get("lev_leg")), "lev": lg.get("lev")}
        if got < sz - 1e-12:
            o["warn"] = "стакан до лимита не покрывает размер — исполнится частично"
        if impact is not None and impact > cfg["max_impact_bp"]:
            o["warn"] = f"проскальзывание {impact:.0f} б.п. > {cfg['max_impact_bp']:.0f}"
        orders.append(o)
    return orders, notes


def apply_daily_cap(orders, cap):
    """Аварийный предел дневного объёма: если сумма больше cap — ордера не урезаются пропорционально, а день целиком требует ручного подтверждения."""
    total = sum(o["usd"] for o in orders)
    return total, total <= cap


def fmt_usd(x):
    return f"${x:,.2f}" if abs(x) < 1e6 and not math.isnan(x) else str(x)
