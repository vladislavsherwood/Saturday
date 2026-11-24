"""op: данные опционного рынка для исследования «опционы и стратегия» (research/op_journal.md).
Пишет cache/op_mkt.json: {символ: {"d": ["YYYY-MM-DD", …], "c": [закрытие, …], "h": [...], "l": [...]}}.
  Yahoo (через data.history, кэш data.py): ^VIX, ^VIX9D, ^VIX3M, ^VIX6M, ^VVIX, ^SKEW, ^GVZ, ^OVX, ^MOVE, ^GSPC, GC=F, SI=F, ^VXN.
  Deribit (публичный API, без ключа): DVOL BTC и ETH (индекс 30-дн. подразумеваемой волатильности, дневные свечи, с 2021-03-24);
    ключи "DVOL_BTC", "DVOL_ETH"; дата свечи — открытие суток UTC (значение close — на конец этих суток UTC).
Торговые даты Yahoo — дата биржи (закрытие США ~20–21 UTC). Перенос на календарь крипты — в op_lib.js (только прошлое).
Запуск: python3 op_data.py"""
import json
import os
import time
import urllib.request
from datetime import datetime, timezone

import data

YH = ["^VIX", "^VIX9D", "^VIX3M", "^VIX6M", "^VVIX", "^SKEW", "^GVZ", "^OVX", "^MOVE", "^VXN", "^GSPC", "GC=F", "SI=F"]
out = {}
for s in YH:
    try:
        c, price, cur = data.history(s)
        df = data._ohlc[s]
        df = df[df["c"] > 0]
        out[s] = {"d": [d.strftime("%Y-%m-%d") for d in df.index], "c": [float(x) for x in df["c"].values],
                  "h": [float(x) for x in df["h"].values], "l": [float(x) for x in df["l"].values]}
        print(s, len(df), out[s]["d"][0], out[s]["d"][-1])
    except Exception as e:  # noqa: BLE001
        print(s, "нет:", e)
    time.sleep(1.5)


def deribit(cur):
    """DVOL с 2021-03-24 по сегодня, дневные свечи [ts, o, h, l, c]; API отдаёт ≤ 1000 точек за запрос, с continuation."""
    end = int(datetime.now(timezone.utc).timestamp() * 1000)
    start = int(datetime(2021, 1, 1, tzinfo=timezone.utc).timestamp() * 1000)
    rows = {}
    e = end
    for _ in range(20):
        url = (f"https://www.deribit.com/api/v2/public/get_volatility_index_data?currency={cur}"
               f"&start_timestamp={start}&end_timestamp={e}&resolution=1D")
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=30) as r:
            js = json.load(r)["result"]
        for ts, o, h, l, c in js["data"]:
            rows[ts] = (o, h, l, c)
        cont = js.get("continuation")
        if not cont or not js["data"]:
            break
        e = int(cont)
        if e <= start:
            break
        time.sleep(0.5)
    ks = sorted(rows)
    today = datetime.now(timezone.utc).date()
    ks = [k for k in ks if datetime.fromtimestamp(k / 1000, timezone.utc).date() < today]  # незакрытые сутки не берём
    return {"d": [datetime.fromtimestamp(k / 1000, timezone.utc).strftime("%Y-%m-%d") for k in ks],
            "c": [rows[k][3] for k in ks], "h": [rows[k][1] for k in ks], "l": [rows[k][2] for k in ks]}


for cur in ("BTC", "ETH"):
    try:
        out["DVOL_" + cur] = deribit(cur)
        o = out["DVOL_" + cur]
        print("DVOL", cur, len(o["d"]), o["d"][0], o["d"][-1])
    except Exception as e:  # noqa: BLE001
        print("DVOL", cur, "нет:", e)

path = os.path.join(data.CACHE, "op_mkt.json")
with open(path, "w") as f:
    json.dump(out, f)
print("записано", path)
