"""op: отношение объёмов пут/колл CBOE (put/call ratio), 2006-11 … сегодня → cache/op_pc.json.
Источники (открытые, без ключа):
  до 2019-10-04 — CSV cdn.cboe.com/resources/options/volume_and_call_put_ratios/{totalpc,equitypc,indexpc}.csv (архив CBOE);
  с 2019-10-07 — дневная сводка cdn.cboe.com/data/us/options/market_statistics/daily/YYYY-MM-DD_daily_options (поле ratios).
Ряды: total, equity, index, vix (P/C по опционам на VIX, только с 2019-10), spx (SPX+SPXW, только с 2019-10).
Дата — торговая дата CBOE (публикуется после закрытия, ~21–22 UTC). Перенос на календарь крипты — в op_lib.js (только прошлое).
Уже скачанные дни берутся из кэша (повторный запуск докачивает только новые).
Запуск: python3 op_pc.py"""
import csv
import io
import json
import os
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone

import data

UA = {"User-Agent": "Mozilla/5.0"}
PATH = os.path.join(data.CACHE, "op_pc.json")


def get(url):
    req = urllib.request.Request(url, headers=UA)
    for _ in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.read().decode("utf-8", "replace")
        except Exception:  # noqa: BLE001
            pass
    return None


old = {}
if os.path.exists(PATH):
    with open(PATH) as f:
        old = json.load(f).get("days", {})
days = dict(old)

# архив CSV
for key, f in (("total", "totalpc"), ("equity", "equitypc"), ("index", "indexpc")):
    txt = get(f"https://cdn.cboe.com/resources/options/volume_and_call_put_ratios/{f}.csv")
    if not txt:
        print("нет", f)
        continue
    rows = list(csv.reader(io.StringIO(txt)))
    for r in rows:
        if len(r) < 5 or "/" not in r[0]:
            continue
        try:
            d = datetime.strptime(r[0].strip(), "%m/%d/%Y").strftime("%Y-%m-%d")
            v = float(r[4])
        except ValueError:
            continue
        days.setdefault(d, {})[key] = v

# дневные сводки
NAMES = {"TOTAL PUT/CALL RATIO": "total", "INDEX PUT/CALL RATIO": "index", "EQUITY PUT/CALL RATIO": "equity",
         "CBOE VOLATILITY INDEX (VIX) PUT/CALL RATIO": "vix", "SPX + SPXW PUT/CALL RATIO": "spx", "SPX + SPXW + SPXO PUT/CALL RATIO": "spx"}
today = datetime.now(timezone.utc).date()
todo = []
d = date(2019, 10, 5)
while d < today:
    s = d.isoformat()
    if d.weekday() < 5 and not (s in old and old[s].get("src") == "daily"):
        todo.append(s)
    d += timedelta(days=1)


def one(s):
    txt = get(f"https://cdn.cboe.com/data/us/options/market_statistics/daily/{s}_daily_options")
    if not txt:
        return s, None
    try:
        js = json.loads(txt)
    except ValueError:
        return s, None
    o = {"src": "daily"}
    for r in js.get("ratios", []):
        k = NAMES.get(r.get("name", "").strip())
        try:
            if k:
                o[k] = float(r["value"])
        except (TypeError, ValueError):
            pass
    return s, (o if "total" in o else None)


print("докачать дней:", len(todo))
with ThreadPoolExecutor(8) as ex:
    for i, (s, o) in enumerate(ex.map(one, todo)):
        if o:
            days[s] = o
        if i % 200 == 0:
            print(i, s, o)
ks = sorted(days)
with open(PATH, "w") as f:
    json.dump({"days": {k: days[k] for k in ks}}, f)
print("записано", PATH, len(ks), ks[0], ks[-1])
