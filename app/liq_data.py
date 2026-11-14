"""Рынок деривативов для правил входа: открытый интерес, соотношение лонгов и шортов, перевес агрессивных покупок/продаж (Binance, с 2020-09),
фандинг (Binance с 2019-09) по BTCUSDT и ETHUSDT. Источник — открытый архив data.binance.vision (API Binance отсюда закрыт).
Прямой истории ликвидаций в открытом доступе нет; их следы — резкий сброс открытого интереса.
Запуск: python3 app/liq_data.py  → app/found/liq_extra.json"""
import io, json, os, zipfile, datetime as dt
from concurrent.futures import ThreadPoolExecutor
import pandas as pd, requests

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache", "binance_vision"); os.makedirs(CACHE, exist_ok=True)
BASE = "https://data.binance.vision/data/futures/um/"
S = requests.Session()


def get(path):
    f = os.path.join(CACHE, path.replace("/", "_"))
    if os.path.exists(f):
        return open(f, "rb").read() or None
    for _ in range(4):
        try:
            r = S.get(BASE + path, timeout=30)
            if r.status_code == 404:
                open(f, "wb").close(); return None
            r.raise_for_status(); open(f, "wb").write(r.content); return r.content
        except Exception:
            pass
    return None


def csv(b):
    if not b:
        return None
    z = zipfile.ZipFile(io.BytesIO(b)); t = z.read(z.namelist()[0]).decode()
    first = t.split("\n", 1)[0]
    return pd.read_csv(io.StringIO(t), header=0 if any(ch.isalpha() for ch in first) else None)


def metrics(sym):
    days = pd.date_range("2020-09-01", dt.date.today() - dt.timedelta(days=2))
    with ThreadPoolExecutor(24) as ex:
        parts = list(ex.map(lambda d: csv(get(f"daily/metrics/{sym}/{sym}-metrics-{d:%Y-%m-%d}.zip")), days))
    rows = []
    for d, p in zip(days, parts):
        if p is None or not len(p):
            continue
        rows.append({"d": d, "oi": p["sum_open_interest_value"].iloc[-1], "oic": p["sum_open_interest"].iloc[-1], "tls": p["sum_toptrader_long_short_ratio"].mean(),
                     "ls": p["count_long_short_ratio"].mean(), "taker": p["sum_taker_long_short_vol_ratio"].mean(),
                     "oimin": p["sum_open_interest_value"].min(), "oimax": p["sum_open_interest_value"].max()})
    return pd.DataFrame(rows).set_index("d")


def funding(sym):
    months = pd.date_range("2019-09-01", dt.date.today(), freq="MS")
    with ThreadPoolExecutor(12) as ex:
        parts = list(ex.map(lambda m: csv(get(f"monthly/fundingRate/{sym}/{sym}-fundingRate-{m:%Y-%m}.zip")), months))
    p = pd.concat([x for x in parts if x is not None])
    p.columns = ["t", "interval", "rate"][: len(p.columns)] if p.columns[0] != "calc_time" else p.columns
    tcol = p.columns[0]; rcol = p.columns[-1]
    s = pd.Series(pd.to_numeric(p[rcol], errors="coerce").values, index=pd.to_datetime(pd.to_numeric(p[tcol]), unit="ms"))
    return s.resample("D").sum() * 100           # % за день


if __name__ == "__main__":
    out = {}
    for sym, k in [("BTCUSDT", "b"), ("ETHUSDT", "e")]:
        m = metrics(sym); f = funding(sym)
        print(sym, "metrics", m.index[0].date(), "…", m.index[-1].date(), len(m), "| funding", f.index[0].date(), "…", f.index[-1].date())
        for col in m:
            out[k + col] = m[col]
        out[k + "fund"] = f
    D = pd.DataFrame(out).sort_index()
    D.index = pd.to_datetime(D.index).normalize()
    D = D[~D.index.duplicated()]
    t = [(d - pd.Timestamp("1970-01-01")).days for d in D.index]
    js = {"t": t, **{c: [None if pd.isna(v) else round(float(v), 6) for v in D[c]] for c in D}}
    json.dump(js, open(os.path.join(HERE, "found", "liq_extra.json"), "w"))
    print(D.tail(3).T)
