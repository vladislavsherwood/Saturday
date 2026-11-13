"""Случайная выборка монет для проверки стратегии на чужих данных.

30 монет — из топ-300 CoinMarketCap на 2 января 2022 года (чтобы в выборку попали и те, что потом умерли: без ошибки выжившего),
20 монет — из сегодняшнего топ-300, появившихся после этой даты. Стейблкоины, обёрнутые токены и монеты, на которых стратегия
уже проверялась, исключены. Зерно случайности фиксировано.

Запуск: python3 app/pick_random.py <куда.json>
"""
import json
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data  # noqa: E402

SEEN = set("SOL ETH BTC DOGE XRP BNB TON HYPE PUMP ADA LTC LINK AVAX TRX XLM DOT BCH ETC XMR ATOM ALGO VET FIL NEAR AAVE SHIB PEPE BONK WIF FLOKI FARTCOIN USELESS".split())
BAD_TAGS = {"stablecoin", "wrapped-tokens", "tokenized-gold", "asset-backed-stablecoin", "fiat-stablecoin", "usd-stablecoin", "algorithmic-stablecoin", "eur-stablecoin", "tokenized-stock",
            "liquid-staking-derivatives", "rehypothecated-crypto", "tokenized-assets", "tokenized-treasury-bills"}
BAD_WORDS = ("wrapped", "staked", "usd", "bridged", "tether", "dai", "restaked", "btcb", "weth", "steth", " eth", "bitcoin bep", "gold", "euro")
B = "https://api.coinmarketcap.com/data-api/v3/cryptocurrency"


def ok(c):
    tags = c.get("tags") or []
    tags = {(t.get("slug") if isinstance(t, dict) else t) for t in tags}
    name = c["name"].lower()
    return c["symbol"].upper() not in SEEN and not (tags & BAD_TAGS) and not any(w in name for w in BAD_WORDS)


def main(out):
    rnd = random.Random(2026)
    old = data._get(f"{B}/listings/historical?date=2022-01-02&start=1&limit=300&convertId=2781")["data"]
    new = data._get(f"{B}/listing?start=1&limit=300&sortBy=market_cap&sortType=desc&convert=USD&cryptoType=all&tagType=all")["data"]["cryptoCurrencyList"]
    old_ids = {c["id"] for c in old}
    pools = [("2022", [c for c in old if ok(c)], 30), ("new", [c for c in new if ok(c) and c["id"] not in old_ids and (c.get("dateAdded") or "")[:10] > "2022-01-02"], 20)]
    picked, used = [], set()
    for group, pool, need in pools:
        print(f"группа {group}: подходящих {len(pool)}, нужно {need}")
        rnd.shuffle(pool)
        got = 0
        for c in pool:
            if got == need:
                break
            if c["symbol"].upper() in used:
                continue
            year = max(2013, int((c.get("dateAdded") or "2013")[:4]))
            try:
                df = data.cmc_ohlc(c["id"], year)
            except Exception as e:  # noqa: BLE001
                print("  пропуск", c["symbol"], e)
                continue
            if len(df) < 420:                    # меньше года после разогрева — нечего считать
                print(f"  пропуск {c['symbol']}: всего {len(df)} дней")
                continue
            skip = 205 if len(df) > 1280 else 20
            picked.append({"cid": c["id"], "ticker": c["symbol"].upper(), "name": c["name"], "group": group, "rank": c.get("cmcRank"), "year": year, "skip": skip,
                           "days": len(df), "first": str(df.index[0].date()), "last": str(df.index[-1].date()), "mult": round(float(df["c"].iloc[-1] / df["c"].iloc[skip]), 4)})
            used.add(c["symbol"].upper())
            got += 1
            print(f"  {got:2}. {c['symbol']:8} {c['name'][:28]:28} место {c.get('cmcRank')}, {len(df)} дней {df.index[0].date()}…{df.index[-1].date()}, цена ×{picked[-1]['mult']}", flush=True)
    json.dump(picked, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("выбрано", len(picked))


if __name__ == "__main__":
    main(sys.argv[1])
