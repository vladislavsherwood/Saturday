"""Агент 4E: сбор новых рядов рынка (только чтение открытых данных) → app/found/agent4e_data.json.
Ряды по дням (t = дни с 1970-01-01, как X.t в стенде):
  фандинг Binance (% за день) по крупным альтам: f_<SYM>; премия фьючерса к споту (базис, % закрытия дня): prem_btc, prem_eth;
  ETH: OI в монетах (eoic), фандинг (efund), лонги/шорты (els), тейкеры (etaker) — из found/liq_extra.json;
  стейблкоины (DefiLlama, вся капитализация $): stab; TVL DeFi: tvl;
  ончейн BTC (blockchain.info): hash, fees (комиссии $), rev (выручка майнеров $), addr (уник. адреса);
  CoinMetrics community: mvrv_eth, adr_btc, adr_eth (активные адреса);
  макро: y10, y2, y3m (Treasury, %), dxy (долларовый индекс).
Кеш загрузок — app/cache (в .gitignore). Запуск: python3 app/agent4e_data.py"""
import io, json, os, zipfile, datetime as dt
from concurrent.futures import ThreadPoolExecutor
import pandas as pd, requests

HERE = os.path.dirname(os.path.abspath(__file__))
CA = os.path.join(HERE, "cache"); BV = os.path.join(CA, "binance_vision"); os.makedirs(BV, exist_ok=True)
SES = requests.Session(); SES.headers["User-Agent"] = "research-client"


def bv(path):
    f = os.path.join(BV, path.replace("/", "_"))
    if os.path.exists(f):
        return open(f, "rb").read() or None
    for _ in range(4):
        try:
            r = SES.get("https://data.binance.vision/data/futures/um/" + path, timeout=30)
            if r.status_code == 404:
                open(f, "wb").close(); return None
            r.raise_for_status(); open(f, "wb").write(r.content); return r.content
        except Exception:
            pass
    return None


def zcsv(b):
    if not b:
        return None
    z = zipfile.ZipFile(io.BytesIO(b)); t = z.read(z.namelist()[0]).decode()
    first = t.split("\n", 1)[0]
    return pd.read_csv(io.StringIO(t), header=0 if any(ch.isalpha() for ch in first) else None)


MONTHS = pd.date_range("2019-09-01", dt.date.today() - dt.timedelta(days=20), freq="MS")


def funding(sym):
    with ThreadPoolExecutor(12) as ex:
        parts = [p for p in ex.map(lambda m: zcsv(bv(f"monthly/fundingRate/{sym}/{sym}-fundingRate-{m:%Y-%m}.zip")), MONTHS) if p is not None]
    if not parts:
        return None
    p = pd.concat(parts)
    s = pd.Series(pd.to_numeric(p.iloc[:, -1], errors="coerce").values, index=pd.to_datetime(pd.to_numeric(p.iloc[:, 0]), unit="ms"))
    return s.resample("D").sum(min_count=1) * 100


def premium(sym):
    with ThreadPoolExecutor(12) as ex:
        parts = [p for p in ex.map(lambda m: zcsv(bv(f"monthly/premiumIndexKlines/{sym}/1d/{sym}-1d-{m:%Y-%m}.zip")), MONTHS) if p is not None]
    for x in parts:
        x.columns = range(len(x.columns))
    p = pd.concat(parts)
    return pd.Series(pd.to_numeric(p.iloc[:, 4]).values * 100, index=pd.DatetimeIndex(pd.to_datetime(pd.to_numeric(p.iloc[:, 0]), unit="ms")).normalize())


def jget(url, name, refresh=True):
    f = os.path.join(CA, name)
    if refresh or not os.path.exists(f):
        try:
            r = SES.get(url, timeout=60); r.raise_for_status(); open(f, "w").write(r.text)
        except Exception as e:  # noqa: BLE001
            print("  не скачано", name, e)
    return json.load(open(f))


def bc(chart):
    j = jget(f"https://api.blockchain.info/charts/{chart}?timespan=all&format=json&sampled=false", f"bc_{chart}.json")
    v = j["values"]
    return pd.Series([x["y"] for x in v], index=pd.to_datetime([x["x"] for x in v], unit="s").normalize())


def cm(asset, metric):
    rows, url = [], f"https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets={asset}&metrics={metric}&page_size=10000&start_time=2010-01-01"
    f = os.path.join(CA, f"cm_{asset}_{metric}.json")
    try:
        while url:
            j = SES.get(url, timeout=60).json(); rows += j["data"]; url = j.get("next_page_url")
        json.dump(rows, open(f, "w"))
    except Exception as e:  # noqa: BLE001
        print("  coinmetrics", asset, metric, e); rows = json.load(open(f)) if os.path.exists(f) else []
    return pd.Series([float(r[metric]) for r in rows], index=pd.to_datetime([r["time"][:10] for r in rows]))


if __name__ == "__main__":
    out = {}
    for sym in ["SOL", "XRP", "DOGE", "BNB", "ADA", "LINK", "LTC", "AVAX", "DOT", "TRX", "BCH", "ETC", "ETH", "BTC"]:
        f = funding(sym + "USDT")
        if f is not None:
            out["f_" + sym] = f; print(sym, "фандинг с", f.dropna().index[0].date())
    out["prem_btc"] = premium("BTCUSDT"); out["prem_eth"] = premium("ETHUSDT")
    L = json.load(open(os.path.join(HERE, "found", "liq_extra.json")))
    li = pd.to_datetime(L["t"], unit="D")
    for k in ["eoic", "els", "etaker", "etls"]:
        out[k] = pd.Series(L[k], index=li, dtype=float)
    st = jget("https://stablecoins.llama.fi/stablecoincharts/all", "llama_stables.json")
    out["stab"] = pd.Series([x["totalCirculatingUSD"].get("peggedUSD", 0) for x in st], index=pd.to_datetime([int(x["date"]) for x in st], unit="s").normalize())
    tv = jget("https://api.llama.fi/v2/historicalChainTvl", "llama_tvl.json")
    out["tvl"] = pd.Series([x["tvl"] for x in tv], index=pd.to_datetime([int(x["date"]) for x in tv], unit="s").normalize())
    for k, ch in [("hash", "hash-rate"), ("fees", "transaction-fees-usd"), ("rev", "miners-revenue"), ("addr", "n-unique-addresses")]:
        out[k] = bc(ch)
    out["mvrv_eth"] = cm("eth", "CapMVRVCur"); out["adr_btc"] = cm("btc", "AdrActCnt"); out["adr_eth"] = cm("eth", "AdrActCnt")
    T = json.load(open(os.path.join(CA, "treasury_nominal.json")))
    ti = pd.to_datetime(list(T))
    for k, col in [("y10", "10 Yr"), ("y2", "2 Yr"), ("y3m", "3 Mo")]:
        out[k] = pd.Series([T[d].get(col) for d in T], index=ti, dtype=float).sort_index()
    D = json.load(open(os.path.join(CA, "long_DX_Y_NYB.json")))
    out["dxy"] = pd.Series(D["c"], index=pd.to_datetime(D["t"], unit="s").normalize(), dtype=float)
    for k in out:
        s = out[k]; s = s[~s.index.duplicated(keep="last")].sort_index(); out[k] = s
    Df = pd.DataFrame(out); Df = Df[Df.index >= "2014-01-01"]
    t0 = pd.Timestamp("1970-01-01")
    js = {"t": [(d - t0).days for d in Df.index]}
    for c in Df:
        js[c] = [None if pd.isna(v) else float(f"{v:.5g}") for v in Df[c]]
        nz = Df[c].dropna(); print(f"  {c}: {nz.index[0].date()} … {nz.index[-1].date()} ({len(nz)})")
    json.dump(js, open(os.path.join(HERE, "found", "agent4e_data.json"), "w"), separators=(",", ":"))
    print("сохранено found/agent4e_data.json", os.path.getsize(os.path.join(HERE, "found", "agent4e_data.json")) // 1024, "КБ")
