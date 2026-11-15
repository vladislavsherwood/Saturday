"""imp9: выгрузка для хеджа в node — цена и максимум дня BTC по номеру дня (дни с 1970-01-01) и дневной фандинг монет (% в день).
Запуск: python3 app/imp9_export.py -> scratchpad/imp9_aux.json"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.environ.get("IMP9_AUX", "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp9_aux.json")
df = data.history("BTC-USD")[0]; df = df[~df.index.duplicated()]
o = data._ohlc["BTC-USD"]; o = o[~o.index.duplicated()]
day = lambda ix: [int(x.value // 86400_000_000_000) for x in ix]
hi = o["h"].reindex(df.index).values; cc = df.values.astype(float)
hi = np.where(np.isfinite(hi) & (hi > 0), np.maximum(hi, cc), cc)
F = json.load(open(os.path.join(HERE, "found", "agent3-coin-funding.json")))
json.dump({"btc": {"t": day(df.index), "c": [float(x) for x in cc], "h": [float(x) for x in hi]},
           "fund": {k: {"t": v["t"], "f": v["f"]} for k, v in F.items()}}, open(OUT, "w"))
print("ok", len(cc), df.index[0], df.index[-1])
