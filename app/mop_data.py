"""mop: данные опционного рынка для металлов (research/mop_journal.md). Пишет cache/mop_vol.json:
{символ: {"d": ["YYYY-MM-DD", …], "c": [закрытие, …]}, "_log": [что не удалось]}.

Источники:
  Yahoo (через data._get, тот же запрос, что data.history, но с 2000-01-01 — у data.history история с 2009):
    ^GVZ (CBOE Gold ETF Volatility, с 2008-06), ^OVX (нефть, с 2007-05), ^VIX, ^VIX3M (с 2007-12), ^VIX9D (с 2011), ^VVIX, ^SKEW, ^MOVE, ^GSPC (для реализованной вол S&P).
  CBOE (cdn.cboe.com, публичные CSV истории индексов): VXSLV (CBOE Silver ETF Volatility, 2011-03…2022-02 и с 2025-05),
    VXGDX (добытчики золота, те же даты). У Yahoo по ^VXSLV / ^VXGDX — только последняя точка, ^EVZ — 404; у CBOE EVZ — 403 (снят).
Запуск: python3 app/mop_data.py"""
import csv
import io
import json
import os
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone

import data

YH = ["^GVZ", "^OVX", "^VIX", "^VIX3M", "^VIX9D", "^VVIX", "^SKEW", "^MOVE", "^GSPC"]
CBOE = ["VXSLV", "VXGDX"]
out = {"_log": []}


def yahoo(sym, p1=946684800):
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/" + urllib.parse.quote(sym)
           + f"?period1={p1}&period2=9999999999&interval=1d")
    r = data._get(url)["chart"]["result"][0]
    t, c = r.get("timestamp") or [], r["indicators"]["quote"][0].get("close") or []
    today = datetime.now(timezone.utc).date()
    rows = {}
    for a, b in zip(t, c):
        if b is None or b <= 0:
            continue
        d = datetime.fromtimestamp(a, timezone.utc).date()
        if d < today:
            rows[d.isoformat()] = float(b)
    ks = sorted(rows)
    return {"d": ks, "c": [rows[k] for k in ks]}


def cboe(sym):
    url = f"https://cdn.cboe.com/api/global/us_indices/daily_prices/{sym}_History.csv"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        txt = r.read().decode()
    rows = {}
    today = datetime.now(timezone.utc).date()
    for row in csv.DictReader(io.StringIO(txt)):
        d = datetime.strptime(row["DATE"], "%m/%d/%Y").date()
        v = float(row.get("CLOSE") or row.get(sym) or 0)
        if v > 0 and d < today:
            rows[d.isoformat()] = v
    ks = sorted(rows)
    return {"d": ks, "c": [rows[k] for k in ks]}


for s in YH:
    try:
        out[s] = yahoo(s)
        print(s, len(out[s]["d"]), out[s]["d"][0], out[s]["d"][-1], out[s]["c"][-1])
    except Exception as e:  # noqa: BLE001
        out["_log"].append(f"Yahoo {s}: {e}")
        print(s, "нет:", e)
    time.sleep(1.0)
for s in CBOE:
    try:
        out[s] = cboe(s)
        print(s, len(out[s]["d"]), out[s]["d"][0], out[s]["d"][-1], out[s]["c"][-1])
    except Exception as e:  # noqa: BLE001
        out["_log"].append(f"CBOE {s}: {e}")
        print(s, "нет:", e)
for s in ("^VXSLV", "^VXGDX", "^EVZ"):
    try:
        y = yahoo(s)
        out["_log"].append(f"Yahoo {s}: точек {len(y['d'])} (истории нет)")
    except Exception as e:  # noqa: BLE001
        out["_log"].append(f"Yahoo {s}: {e}")
try:
    cboe("EVZ")
except Exception as e:  # noqa: BLE001
    out["_log"].append(f"CBOE EVZ: {e}")
out["_log"].append("опционные метрики GLD/SLV (put/call, skew, OI) — бесплатной истории нет; не берём")
path = os.path.join(data.CACHE, "mop_vol.json")
with open(path, "w") as f:
    json.dump(out, f)
print("\n".join(out["_log"]))
print("записано", path)
