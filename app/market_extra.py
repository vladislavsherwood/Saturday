"""Рыночные ряды для маркеров вершин и дна, которых нет в страницах конструктора: ширина рынка, сеть биткоина, DeFi, MVRV.
Пишет один файл по дням (номер дня с 1970 года), его подхватывает lab.js.

Запуск: python3 app/market_extra.py <куда.json>
"""
import json
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import build_builder as bb  # noqa: E402
import markers as mk  # noqa: E402

COLS = {"breadth": "Ширина: доля монет выше средней 200, %", "btctx": "Транзакции биткоина: месяц к году", "btcaddr": "Активные адреса биткоина: месяц к году",
        "tvldd": "DeFi: просадка заблокированных средств от максимума, %", "mvrv": "MVRV биткоина"}


def main(out):
    coins = [(k, bb.ASSETS[k]) for k in mk.KNOWN]
    for c in json.load(open(os.path.join(HERE, "found", "random50.json"), encoding="utf-8")):
        coins.append((c["ticker"].lower(), {"cmc": c["cid"], "from_year": c["year"]}))
    btc = mk.load(bb.ASSETS["btc"])["c"]
    panel = {}
    for key, cfg in coins:
        try:
            df = mk.load(cfg)
            df = df[~df.index.duplicated()]
            if len(df) >= 400:
                panel[key] = df["c"]
        except Exception as e:  # noqa: BLE001
            print(key, e)
    P = pd.DataFrame(panel).sort_index()
    P = P[P.index >= "2015-01-01"]
    M = mk.market_features(btc, P)
    res = {"t": [int(x) for x in (M.index - pd.Timestamp("1970-01-01")).days]}
    for k, col in COLS.items():
        res[k] = [None if (x != x or np.isinf(x)) else round(float(x), 4) for x in M[col].values]
        print(k, "с", M[col].first_valid_index().date(), "последнее", M[col].dropna().iloc[-1])
    json.dump(res, open(out, "w"))


if __name__ == "__main__":
    main(sys.argv[1])
