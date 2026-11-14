"""Сухой режим автоисполнения на Hyperliquid: считает решение на сегодня, проверяет данные, переводит план в ордера по реальному
стакану и печатает, что было бы отправлено. Ключей нет, подписей нет, на Exchange API ничего не уходит.

Запуск (из корня репозитория):
  python3 app/exec/hl_dry.py                      # без плеча: found/combo-best.json
  python3 app/exec/hl_dry.py --margin             # с плечом и шортом BTC: found/combo-best-margin.json → best_safe
  python3 app/exec/hl_dry.py --since 2026-01-01 --unit 2 --json app/exec/out/dry.json
Аварийный стоп: файл app/exec/STOP — если он есть, план не строится (так же будет работать боевой исполнитель)."""
import argparse
import json
import os
import sys
from datetime import timedelta

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import hl_info as H     # noqa: E402
import hl_plan as P     # noqa: E402
import signals as S     # noqa: E402

# какие индикаторы устаревают вместе с каким источником
SOURCE_INDS = {"fng": ["fng"], "dominance": ["usdt", "usdtd", "othd", "oth90", "qt", "ago_qt"], "binance_oi": ["oidd30", "dly20_100f"],
               "funding": ["fund30"]}
NEAR = 0.02           # значение ближе 2% к порогу условия, которое сейчас решает, — «на грани», нужна сверка со вторым источником


def quantized(s, n=60):
    x = s.iloc[-n:]
    return len(x) >= 30 and x.nunique() < 0.5 * len(x)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--margin", action="store_true")
    ap.add_argument("--since", default="2026-01-01")
    ap.add_argument("--unit", type=float, default=None)
    ap.add_argument("--config", default=None)
    ap.add_argument("--json", default=None)
    ap.add_argument("--force-rule", type=int, default=None, help="что-если: считать, что у всех монет сработало правило N (для проверки ордеров)")
    a = ap.parse_args()
    cfg = dict(P.DEFAULTS)
    if a.config:
        cfg.update(json.load(open(a.config)))
    if a.unit:
        cfg["unit_usd"] = a.unit
    if os.path.exists(os.path.join(HERE, "STOP")):
        print("АВАРИЙНЫЙ СТОП: найден app/exec/STOP — сегодня ничего не делаем.")
        return 0

    strat = S.load_strategy(a.margin)
    rules, lev = strat["rules"], strat["lev"]
    exec_day = S.utc_today()
    dec_day = exec_day - timedelta(days=1)
    print(f"Стратегия: {strat['name']}" + (f"  [ЧТО-ЕСЛИ: у всех монет правило {a.force_rule}]" if a.force_rule is not None else ""))
    print(f"Решение по закрытию {dec_day.date()} (UTC), исполнение {exec_day.date()} · взнос ${cfg['unit_usd']:g}/день на монету · состояние смоделировано с {a.since}")

    M = S.Market()
    ld = M.last_dates()
    stale = {k: v for k, v in ld.items() if k in SOURCE_INDS and pd.Timestamp(v) < dec_day}
    print("\n1) Свежесть источников (последний день):", ", ".join(f"{k} {v}" for k, v in ld.items()))
    if stale:
        print("   устарели к дню решения:", ", ".join(f"{k} ({v})" for k, v in stale.items()))
    stale_inds = sorted({i for k in stale for i in SOURCE_INDS[k]})
    if ld["btc_close"] < str(dec_day.date()):
        print("   СТОП: нет закрытия BTC за день решения — ждём данных.")
        return 2

    mk = H.resolve_markets()
    report, blocked, books, deferred = {}, {}, {}, {}
    hist = {}
    print("\n2) Цены и сигналы по монетам")
    for coin, (sym, kind) in S.COINS.items():
        m = mk[coin]
        close = S.data.history(sym)[0]
        close = close[~close.index.duplicated()]
        hl_book = m["spot"]["book"] if m["spot"] else m["perp"]["book"]
        mult = 1 if m["spot"] else m["perp"]["mult"]
        hl = H.daily_closes(hl_book, days=1500 if quantized(close) else 10)
        hl = pd.Series({pd.Timestamp(k): v / mult for k, v in hl.items()}).sort_index()
        flags = []
        if quantized(close):
            # у Yahoo цена PEPE округлена до 1e-6 (6 разных закрытий за 2026 год) — подменяем рядом Hyperliquid там, где он есть
            close = close.copy()
            ov = hl.reindex(close.index).dropna()
            close.loc[ov.index] = ov.values
            flags.append(f"Yahoo округляет цену (подменено {len(ov)} дн. ценой Hyperliquid)")
        if close.index[-1] < dec_day:
            blocked[coin] = f"нет закрытия за {dec_day.date()}"
            print(f"  {coin:5} СТОП: {blocked[coin]}")
            continue
        y, h = close.loc[dec_day], hl.get(dec_day)
        diff = None if h is None else (h / y - 1) * 100
        if diff is None or abs(diff) > 1.5:
            blocked[coin] = f"закрытие не сверилось с Hyperliquid (Yahoo {y:.6g}, HL {h})"
        I = S.indicators(close, kind, M)
        A = S.rule_series(I, rules)
        acts = np.array([rules[r]["act"] if r >= 0 else strat["base"] for r in A], float)
        grps = np.array([rules[r].get("grp", 0) if r >= 0 else 0 for r in A], int)
        if a.force_rule is not None:
            A[-1] = a.force_rule
            acts[-1], grps[-1] = rules[a.force_rule]["act"], rules[a.force_rule].get("grp", 0)
        hist[coin] = (close, acts, grps, I)
        row = I.iloc[-1].to_dict()
        ri = int(A[-1])
        poss = S.robustness(row, rules, [x for x in stale_inds if any(c["ind"] == x for R in rules for c in R["conds"])])
        if len(poss) > 1:
            flags.append("решение зависит от устаревших данных: возможны правила " + ", ".join(map(str, sorted(poss))))
        near = []
        for R in rules[: ri + 1 if ri >= 0 else len(rules)]:
            for c in R["conds"]:
                v = row.get(c["ind"])
                if v is not None and pd.notna(v) and c["v"] != 0 and abs(v / c["v"] - 1) < NEAR and c["ind"] not in ("hi90", "qt", "dly20_100f"):
                    near.append(f"{c['ind']} {v:.4g} {c['op']} {c['v']}")
        if near:
            flags.append("на грани порога: " + "; ".join(sorted(set(near))[:4]))
        act = acts[-1]
        g = grps[-1]
        what = "обычный взнос" if ri < 0 else (f"взнос + {act - 1:.0%} резерва" if act > 1 else ("только взнос" if act == 1 else f"продать {-act:.1%}"))
        L = lev.get(int(g), 1.0)
        report[coin] = {"rule": ri, "act": act, "grp": int(g), "lev": L, "what": what, "close": float(y), "hl_close": h, "diff_pct": diff, "flags": flags}
        print(f"  {coin:5} закрытие {y:<10.6g} HL {h if h is None else f'{h:.6g}':<10} ({'—' if diff is None else f'{diff:+.2f}%'}) | правило {ri:>2}: {what}"
              + (f", плечо ×{L:g}" if L > 1 else "") + (f" | {coin in blocked and 'СТОП: ' + blocked[coin] or ''}"))
        for fl in flags:
            print(f"        ! {fl}")

    # шорт BTC (только схема с маржой)
    short_on = short_was = 0
    if strat["short"] and "BTC" in hist:
        sh = S.short_state(hist["BTC"][3], strat["short"])
        short_on, short_was = int(sh.iloc[-1]), int(sh.iloc[-2])

    print("\n3) Состояние и ордера на сегодня (по живому стакану Hyperliquid, ничего не отправляется)")
    states, all_orders, notes = {}, [], []
    usdc_total, longs, shorts, mmr = 0.0, {}, {}, {}
    for coin, (close, acts, grps, I) in hist.items():
        m = mk[coin]
        st = P.simulate_state(close, acts, grps, lev, cfg["unit_usd"], a.since)
        # simulate_state включает день решения как «вчерашнее исполнение»; сегодняшняя сделка — по плану дня решения и текущей цене
        price = m["spot"]["mid"] if m["spot"] and m["spot"]["mid"] else m["perp"]["mark"] / m["perp"]["mult"]
        states[coin] = {**st, "price_now": price, "equity": st["reserve"] + st["units"] * price - st["debt"] + 0.0}
        if coin in blocked:
            continue
        legs = P.intents(coin, acts[-1], grps[-1], lev, st, cfg["unit_usd"], price, m, cfg)
        for lg in legs:
            mm = m["perp"] if lg["leg"].startswith("perp") else m["spot"]
            if mm and mm["book"] not in books:
                books[mm["book"]] = H.l2(mm["book"])
        orders, nt = P.build_orders(str(exec_day.date()), coin, legs, m, books, cfg, deferred)
        all_orders += orders
        notes += nt
        usdc_total += st["reserve"] + cfg["unit_usd"] - sum(o["usd"] for o in orders if o["is_buy"] and o["leg"] == "spot_buy")
        if not m["spot"]:
            usdc_total += st["units"] * price - st["debt"]          # залог и прибыль перп-позиции монеты без спота (DOGE, PEPE)
        perp_long = st["debt"] + (0 if m["spot"] else st["units"] * price) + sum(o["usd"] for o in orders if o["leg"] == "perp_long")
        if perp_long > 0:
            longs[coin] = perp_long
            mmr[coin] = 1 / (2 * m["perp"]["maxLeverage"])
    equity = sum(s["equity"] for s in states.values())
    if strat["short"]:
        size = strat["short"]["size"]
        print(f"   шорт BTC: сигнал {'ДЕРЖАТЬ' if short_on else 'нет'} (вчера {'был' if short_was else 'не было'}); при открытии — {size:.0%} капитала ≈ ${size * equity:,.2f}")
        if short_on and not short_was:
            books.setdefault("BTC", H.l2("BTC"))
            o, nt = P.build_orders(str(exec_day.date()), "BTC", [{"leg": "perp_reduce", "usd": size * equity}], {"perp": mk["BTC"]["perp"], "spot": None}, books, cfg, {})
            for x in o:
                x.update({"leg": "perp_short_open", "reduce_only": False})
            all_orders += o
            notes += nt
        if short_on:
            shorts["BTC"] = size * equity
            mmr["BTC"] = 1 / (2 * mk["BTC"]["perp"]["maxLeverage"])
    for coin, st in states.items():
        print(f"   {coin:5} резерв ${st['reserve']:9.2f} | монет {st['units']:.6g} (${st['units'] * st['price_now']:,.2f}) | плечевая нога ${st['debt']:,.2f}")
    print(f"   капитал модели: ${equity:,.2f}")

    print("\n   ордера:")
    if not all_orders:
        print("   — нет")
    for o in all_orders:
        print(f"   {o['coin']:5} {o['leg']:12} {o['market']:6} {'BUY ' if o['is_buy'] else 'SELL'} sz {o['sz']:<12g} лимит {o['limit_px']:<10g} IOC"
              f"{' reduceOnly' if o['reduce_only'] else ''} ≈ ${o['usd']:,.2f} | спред {o['spread_bp']} б.п., по стакану {o['impact_bp']} б.п.,"
              f" комиссия ${o['fee_usd']:.3f} | cloid {o['cloid'][:10]}…" + (f" | ! {o['warn']}" if o.get("warn") else ""))
    for n in notes:
        print("   · " + n)

    total, ok = P.apply_daily_cap(all_orders, cfg["max_daily_usd"])
    drop = P.margin_health(max(usdc_total, 0), longs, shorts, mmr) if longs else 1.0
    lev_orders = [o for o in all_orders if o["lev_leg"]]
    print("\n4) Предохранители")
    print(f"   объём дня ${total:,.2f} (предел ${cfg['max_daily_usd']:,.0f}) — {'ок' if ok else 'ПРЕВЫШЕН: день требует ручного подтверждения'}")
    if longs:
        print(f"   перп-лонги ${sum(longs.values()):,.2f}, USDC-залог ≈ ${usdc_total:,.2f}: ликвидация счёта при равномерном падении ≈ {drop:.0%}"
              f" — {'ок' if drop >= cfg['min_liq_drop'] else 'МАЛО: плечевые ноги отменяются'}")
    if lev_orders and drop < cfg["min_liq_drop"]:
        all_orders = [o for o in all_orders if not o["lev_leg"]]
    if blocked:
        print("   заблокированы монеты: " + "; ".join(f"{k}: {v}" for k, v in blocked.items()))
    print("   итог: СУХОЙ РЕЖИМ — ордера не отправлены.")

    if a.json:
        os.makedirs(os.path.dirname(a.json) or ".", exist_ok=True)
        json.dump({"strategy": strat["name"], "decision_day": str(dec_day.date()), "exec_day": str(exec_day.date()), "sources": ld,
                   "signals": report, "blocked": blocked, "states": states, "orders": all_orders, "notes": notes, "deferred": deferred,
                   "short": {"on": short_on, "was": short_was}, "daily_total": total, "liq_drop": drop},
                  open(a.json, "w"), ensure_ascii=False, indent=1, default=float)
        print(f"   журнал: {a.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
