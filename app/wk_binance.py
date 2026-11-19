"""wk: свечи Binance для монет пользователя (проверка ловушки на ценах Binance). Спот — data.binance_daily (data-api.binance.vision);
перпы USDⓈ-M — месячные/дневные архивы data.binance.vision (FARTCOIN, USELESS, HYPE, XMR после делистинга спота): дни, которых нет на споте.
LIT пользователя — Lighter; LITUSDT на Binance — Litentry (другая монета), её не берём. Итог — JSON {монета: {t: [дни с 1970], o, h, l, c, src}}.
Запуск: python3 app/wk_binance.py <папка для архивов> <выход.json>"""
import io, os, sys, json, zipfile, urllib.request
from datetime import date, timedelta
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data as DT  # noqa: E402

SPOT = {"BTC": "BTCUSDT", "ETH": "ETHUSDT", "SOL": "SOLUSDT", "DOGE": "DOGEUSDT", "PEPE": "PEPEUSDT", "ENA": "ENAUSDT", "ZEC": "ZECUSDT",
        "PENGU": "PENGUUSDT", "PUMP": "PUMPUSDT", "XMR": "XMRUSDT", "HYPE": "HYPEUSDT"}
PERP = {"FARTCOIN": ("FARTCOINUSDT", "2024-11"), "USELESS": ("USELESSUSDT", "2025-07"), "HYPE": ("HYPEUSDT", "2025-04"), "XMR": ("XMRUSDT", "2023-06")}
END = date(2026, 11, 12)


def get(url, path):
    if os.path.exists(path):
        return open(path, "rb").read()
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "python"}), timeout=30) as r:
            b = r.read()
    except Exception:  # noqa: BLE001  нет архива за месяц (до листинга) — пропуск
        b = b""
    open(path, "wb").write(b)
    return b


def rows(b):
    if not b:
        return []
    z = zipfile.ZipFile(io.BytesIO(b)); out = []
    for ln in z.read(z.namelist()[0]).decode().splitlines():
        p = ln.split(",")
        if not p[0].isdigit():
            continue
        t = int(p[0]); t = t // 1000 if t > 1e14 else t     # мс (бывают мкс)
        out.append([t // 86400000, float(p[1]), float(p[2]), float(p[3]), float(p[4])])
    return out


def perp(sym, start, cache):
    y, m = map(int, start.split("-")); out = []
    while date(y, m, 1) <= END:
        if (y, m) < (END.year, END.month):
            out += rows(get(f"https://data.binance.vision/data/futures/um/monthly/klines/{sym}/1d/{sym}-1d-{y}-{m:02d}.zip", f"{cache}/{sym}-{y}-{m:02d}.zip"))
        else:
            d = date(y, m, 1)
            while d <= END:
                out += rows(get(f"https://data.binance.vision/data/futures/um/daily/klines/{sym}/1d/{sym}-1d-{d}.zip", f"{cache}/{sym}-{d}.zip")); d += timedelta(days=1)
        m += 1
        if m > 12: y, m = y + 1, 1
    return out


if __name__ == "__main__":
    cache, outp = sys.argv[1], sys.argv[2]; os.makedirs(cache, exist_ok=True); R = {}
    for nm in sorted(set(SPOT) | set(PERP)):
        d = {}
        if nm in SPOT:
            try:
                df = DT.binance_daily(SPOT[nm])
                for ts, r in df.iterrows():
                    d[int(ts.value // 86400_000_000_000)] = [r.o, r.h, r.l, r.c, "спот"]
            except Exception as e:  # noqa: BLE001
                print(nm, "спот недоступен:", e)
        if nm in PERP:
            for t, o, h, l, c in perp(*PERP[nm], cache):
                if t not in d: d[t] = [o, h, l, c, "перп"]
        ts = sorted(t for t in d if t <= (END - date(1970, 1, 1)).days)
        R[nm] = {"t": ts, "o": [d[t][0] for t in ts], "h": [d[t][1] for t in ts], "l": [d[t][2] for t in ts], "c": [d[t][3] for t in ts], "src": [d[t][4] for t in ts]}
        src = {s: R[nm]["src"].count(s) for s in ("спот", "перп")}
        print(f"{nm}: {len(ts)} дн, {date(1970, 1, 1) + timedelta(days=ts[0]) if ts else '-'} … {date(1970, 1, 1) + timedelta(days=ts[-1]) if ts else '-'} | {src}", flush=True)
    json.dump(R, open(outp, "w"))
