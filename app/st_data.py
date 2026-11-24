"""st: дневные ряды фондового рынка для исследования «крипта против акций» (research/st_journal.md).
Берёт закрытия из Yahoo через data.history (кэш data.py) и пишет cache/st_mkt.json: {символ: {"d": ["YYYY-MM-DD", …], "c": [закрытие, …]}}.
День — торговая дата биржи (закрытие США ~21:00 UTC, раньше закрытия суток крипты 00:00 UTC). Выходные/праздники переносятся вперёд в st_lib.js.
Запуск: python3 st_data.py"""
import json
import os

import data

SYMS = ["^GSPC", "^NDX", "QQQ", "SPY", "NVDA", "GC=F", "DX-Y.NYB", "^TNX", "^VIX"]
out = {}
for s in SYMS:
    c, price, cur = data.history(s)
    c = c.dropna()
    c = c[c > 0]
    out[s] = {"d": [d.strftime("%Y-%m-%d") for d in c.index], "c": [float(x) for x in c.values]}
    print(s, len(c), out[s]["d"][0], out[s]["d"][-1])
path = os.path.join(data.CACHE, "st_mkt.json")
with open(path, "w") as f:
    json.dump(out, f)
print("записано", path)
