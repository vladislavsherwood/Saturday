"""Агент 3: фандинг Binance (USDⓈ-M) по каждой монете стенда, у которой есть фьючерс — из открытого архива data.binance.vision.
Сумма ставок за день, % (как fund у BTC в liq_extra.json). Кеш — app/cache/binance_vision (в .gitignore).
Запуск: python3 app/agent3_funding.py <coins.json {имя: {sym, start}}> <выход.json>"""
import io, json, os, sys, zipfile, datetime as dt, time
from concurrent.futures import ThreadPoolExecutor
import urllib.request
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
BV = os.path.join(HERE, "cache", "binance_vision"); os.makedirs(BV, exist_ok=True)


def bv(path):
    f = os.path.join(BV, path.replace("/", "_"))
    if os.path.exists(f):
        return open(f, "rb").read() or None
    for k in range(4):
        try:
            req = urllib.request.Request("https://data.binance.vision/data/futures/um/" + path, headers={"User-Agent": "research-client"})
            b = urllib.request.urlopen(req, timeout=30).read(); open(f, "wb").write(b); return b
        except urllib.error.HTTPError as e:
            if e.code == 404:
                open(f, "wb").close(); return None
        except Exception:
            time.sleep(1 + k)
    return None


def zcsv(b):
    if not b:
        return None
    z = zipfile.ZipFile(io.BytesIO(b)); t = z.read(z.namelist()[0]).decode()
    first = t.split("\n", 1)[0]
    return pd.read_csv(io.StringIO(t), header=0 if any(ch.isalpha() for ch in first) else None)


def funding(sym, start):
    m0 = max(pd.Timestamp("2019-09-01"), pd.Timestamp(start, unit="D").replace(day=1))
    months = pd.date_range(m0, dt.date.today() - dt.timedelta(days=20), freq="MS")
    with ThreadPoolExecutor(8) as ex:
        parts = [p for p in ex.map(lambda m: zcsv(bv(f"monthly/fundingRate/{sym}/{sym}-fundingRate-{m:%Y-%m}.zip")), months) if p is not None]
    if not parts:
        return None
    p = pd.concat(parts); p.columns = [str(c) for c in p.columns]
    tc, rc = (("calc_time", "last_funding_rate") if "calc_time" in p.columns else (p.columns[0], p.columns[-1]))
    s = pd.Series(p[rc].astype(float).values * 100, index=pd.to_datetime(p[tc].astype("int64"), unit="ms").dt.normalize())
    d = s.groupby(level=0).sum().sort_index()
    return {"t": [int(x) for x in (d.index - pd.Timestamp("1970-01-01")).days], "f": [round(float(v), 5) for v in d.values]}


if __name__ == "__main__":
    coins = json.load(open(sys.argv[1])); out = {}
    for i, (nm, c) in enumerate(coins.items()):
        try:
            r = funding(c["sym"], c["start"])
        except Exception as e:  # noqa: BLE001
            print(nm, "ошибка", e, flush=True); r = None
        if r:
            out[nm] = {"sym": c["sym"], **r}
        print(f"{i + 1}/{len(coins)} {nm} {c['sym']}: {len(r['t']) if r else 0} дней", flush=True)
        json.dump(out, open(sys.argv[2], "w"))
