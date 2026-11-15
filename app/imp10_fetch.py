"""imp10: дневные цена/объём/капитализация с CoinMarketCap (открытый data-api v3) для вселенной монет: все cmcv_* из кэша + монеты Yahoo наборов.
Пишет по файлу на монету в каталог OUT (по умолчанию scratchpad/imp10_mcap). Запуск: python3 app/imp10_fetch.py [OUT]"""
import os, sys, json, time, glob, urllib.request
from datetime import datetime, timezone
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("IMP10_MCAP", "imp10_mcap")
os.makedirs(OUT, exist_ok=True)
YAHOO = {"BTC-USD": 1, "ETH-USD": 1027, "SOL-USD": 5426, "HYPE32196-USD": 32196, "PUMP36507-USD": 36507, "DOGE-USD": 74, "PEPE24478-USD": 24478,
         "ENA-USD": 30171, "ZEC-USD": 1437, "XRP-USD": 52, "BNB-USD": 1839, "ADA-USD": 2010, "LINK-USD": 1975, "AVAX-USD": 5805, "LTC-USD": 2,
         "SHIB-USD": 5994, "WIF-USD": 28752, "BONK-USD": 23095, "FLOKI-USD": 10804, "FARTCOIN-USD": 33597, "TRX-USD": 1958, "DOT-USD": 6636,
         "BCH-USD": 1831, "NEAR-USD": 6535, "FIL-USD": 2280, "ATOM-USD": 3794, "MYX36410-USD": 36410, "XMR-USD": 328, "XLM-USD": 512, "ETC-USD": 1321,
         "VET-USD": 3077, "ALGO-USD": 4030, "AAVE-USD": 7278, "VVV35509-USD": 35509}
cids = set(YAHOO.values())
for f in glob.glob(os.path.join(HERE, "cache", "cmcv_*.json")):
    cids.add(int(os.path.basename(f)[5:-5]))
first = {}
for f in glob.glob(os.path.join(HERE, "cache", "cmcv_*.json")):
    d = json.load(open(f)); first[int(os.path.basename(f)[5:-5])] = int(d["t"][0][:4]) if d["t"] else 2013


def get(u):
    for i in range(4):
        try:
            req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
            return json.load(urllib.request.urlopen(req, timeout=60))
        except Exception as e:  # noqa: BLE001
            time.sleep(2 + 3 * i); err = e
    print("fail", u, err, flush=True); return {}


ONLY_Y = len(sys.argv) > 2 and sys.argv[2] == "y"
LST = sorted(set(YAHOO.values())) if ONLY_Y else sorted(cids)
if len(sys.argv) > 2 and sys.argv[2].startswith("part:"):          # part:i:n — только каждая n-я монета, с i-й, в обратном порядке
    _, i, nn = sys.argv[2].split(":"); LST = LST[int(i)::int(nn)][::-1]
for cid in LST:
    fn = os.path.join(OUT, f"{cid}.json")
    if os.path.exists(fn):
        continue
    rows = {}; sym = None
    for year in range(max(2014, first.get(cid, 2014)), 2027):
        t0 = int(datetime(year, 1, 1, tzinfo=timezone.utc).timestamp()); t1 = int(datetime(year + 1, 1, 1, tzinfo=timezone.utc).timestamp())
        u = get(f"https://api.coinmarketcap.com/data-api/v3/cryptocurrency/historical?id={cid}&convertId=2781&timeStart={t0}&timeEnd={t1}&interval=1d")
        dd = u.get("data") or {}; sym = sym or dd.get("symbol")
        for q in dd.get("quotes") or []:
            x = q["quote"]; rows[q["timeOpen"][:10]] = [x["close"], x.get("volume") or 0, x.get("marketCap") or 0]
        time.sleep(0.2)
    days = sorted(rows)
    json.dump({"cid": cid, "sym": sym, "t": days, "v": [rows[k] for k in days]}, open(fn, "w"))
    print(cid, sym, len(days), flush=True)
print("done", flush=True)
