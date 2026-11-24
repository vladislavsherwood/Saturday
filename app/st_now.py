"""st: что фильтры «крипта против акций» говорят сейчас (последний закрытый день). Индикаторы считаются так же, как в st_lib.js / found/st-best.json.
Запуск: python3 st_now.py"""
import json
import os

import numpy as np
import pandas as pd

import data

mk = json.load(open(os.path.join(data.CACHE, "st_mkt.json")))
tr = {s: pd.Series(v["c"], index=pd.to_datetime(v["d"])) for s, v in mk.items()}
btc, _, _ = data.history("BTC-USD")
cal = pd.date_range("2014-09-17", btc.index[-1], freq="D")
btc = btc.reindex(cal).ffill()
f = lambda s: s.reindex(cal.union(s.index)).ffill().reindex(cal)  # noqa: E731  торговые дни → календарь (ffill)
ndx, vix, dxy = f(tr["^NDX"]), f(tr["^VIX"]), f(tr["DX-Y.NYB"])
I = pd.DataFrame({
    "btcr90": (btc / btc.shift(90) - 1) * 100,
    "st_bxr90": (np.log(btc / btc.shift(90)) - np.log(ndx / ndx.shift(90))) * 100,
    "st_bxr30": (np.log(btc / btc.shift(30)) - np.log(ndx / ndx.shift(30))) * 100,
    "st_vix": vix, "st_vixr": f(tr["^VIX"] / tr["^VIX"].rolling(50).mean()),
    "st_ndx200": f(tr["^NDX"] / tr["^NDX"].rolling(200).mean()), "st_ndxr90": (ndx / ndx.shift(90) - 1) * 100,
    "st_dxyr90": (dxy / dxy.shift(90) - 1) * 100,
    "btc200": btc / btc.rolling(200).mean(),
})
try:
    I["fng"] = data.fear_greed().reindex(cal).ffill()
except Exception as e:  # noqa: BLE001
    print("страх недоступен:", e)
try:
    I["usdtd"] = data.usdt_dominance().reindex(cal).ffill()
except Exception as e:  # noqa: BLE001
    print("usdt.d недоступна:", e)
pd.set_option("display.width", 200)
print(I.tail(12).round(2).to_string())
x = I.iloc[-1]
print("\nпоследний день", I.index[-1].date())
print(f"AB (не продавать на страхе): btcr90 {x.btcr90:+.1f} < −25? {x.btcr90 < -25}; BTC−NDX 90д {x.st_bxr90:+.1f} < −30? {x.st_bxr90 < -30}; страх {x.get('fng', np.nan):.0f} < 52, usdtd {x.get('usdtd', np.nan):.2f} < 7,6")
print(f"B (покупки ×2): VIX/SMA50 {x.st_vixr:.2f} > 1,5? {x.st_vixr > 1.5}")
print(f"F (не продавать на фандинге): VIX {x.st_vix:.1f} > 30? {x.st_vix > 30}")
