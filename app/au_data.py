"""au: дневные ряды металлов для исследования «золото и крипта» (research/au_journal.md).
Берёт закрытия из Yahoo через data.history (кэш data.py) и пишет cache/au_mkt.json: {символ: {"d": ["YYYY-MM-DD", …], "c": [закрытие, …]}}.
GC=F, SI=F — фьючерсы COMEX: день — торговая дата (закрытие ~17:00 Нью-Йорк ≈ 21–22 UTC, раньше закрытия суток крипты 00:00 UTC);
GLD, SLV — фонды (закрытие 16:00 Нью-Йорк); PAXG-USD, XAUT-USD — токенизированное золото, торгуется 24/7 (сутки UTC, как монеты).
Выходные и праздники переносятся вперёд (только прошлое) в au_lib.js. Запуск: python3 au_data.py"""
import json
import os

import data

SYMS = ["GC=F", "SI=F", "GLD", "SLV", "PAXG-USD", "XAUT-USD"]
out = {}
for s in SYMS:
    try:
        c, price, cur = data.history(s)
    except Exception as e:  # noqa: BLE001
        print(s, "нет данных:", e)
        continue
    c = c.dropna()
    c = c[c > 0]
    out[s] = {"d": [d.strftime("%Y-%m-%d") for d in c.index], "c": [float(x) for x in c.values]}
    print(s, len(c), out[s]["d"][0], out[s]["d"][-1], round(out[s]["c"][-1], 2))
path = os.path.join(data.CACHE, "au_mkt.json")
with open(path, "w") as f:
    json.dump(out, f)
print("записано", path)
