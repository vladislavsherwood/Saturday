"""Агент «ЛОУКАП»: сбор и загрузка выборки лоукап-альтов с полными данными (только открытые read-only источники).

Источники (дни по UTC):
  - CoinMarketCap data-api (historical): дневные OHLCV в долларах, капитализация, предложение в обращении;
  - Hyperliquid info API: дневные свечи перпа (объём на Hyperliquid), список перпов (в т. ч. снятых);
  - data.binance.vision: фандинг USDⓈ-M по месяцам (fundingRate), открытый интерес и лонги/шорты по дням (metrics, каждый 2-й день).
Yahoo (data.search/history) — только сверка цен (округление мелких цен).

Стадии (кэш сырья — в scratchpad/lowcap/raw):
  python3 app/lowcap_data.py cands   — кандидаты: перпы Hyperliquid + мемы/ИИ-агенты CoinMarketCap (≤ 1200 места)
  python3 app/lowcap_data.py cmc     — история CoinMarketCap по каждому кандидату
  python3 app/lowcap_data.py select  — признак «лоукап» по данным, разбиение отбор/проверка (зафиксировано, seed 20261114)
  python3 app/lowcap_data.py hl      — свечи Hyperliquid
  python3 app/lowcap_data.py bnf     — фандинг Binance
  python3 app/lowcap_data.py bnm     — OI Binance (каждый 2-й день)
  python3 app/lowcap_data.py build   — компактный app/found/lowcap_data.json
Загрузка: from lowcap_data import load; D = load()  →  {name: DataFrame(c,h,l,v,mcap,supply,hlv,fund,oi,lsr)}, D.meta
"""
import csv
import io
import json
import os
import random
import sys
import time
import urllib.request
import zipfile
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.environ.get("LOWCAP_RAW", "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/lowcap/raw")
OUT = os.path.join(HERE, "found", "lowcap_data.json")
UA = {"User-Agent": "Mozilla/5.0"}
CUT = "2025-11-14"          # история ≥ 1 года к 2026-11-14
SPLIT_DATE = "2025-06-01"   # время: до / после


def get(url, data=None, timeout=60, raw=False, tries=4):
    h = dict(UA)
    if data is not None:
        h["Content-Type"] = "application/json"
        data = json.dumps(data).encode()
    last = None
    for a in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, data=data, headers=h), timeout=timeout) as r:
                b = r.read()
                return b if raw else json.loads(b)
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            last = e
        except Exception as e:  # noqa
            last = e
        time.sleep(1.5 * (a + 1))
    raise last


def jload(p, d=None):
    try:
        with open(p) as f:
            return json.load(f)
    except Exception:
        return d


def jsave(p, v):
    with open(p + ".tmp", "w") as f:
        json.dump(v, f)
    os.replace(p + ".tmp", p)


# ---------- кандидаты ----------
EXTRA = ["ACT", "GIGA", "MOG", "TIBBIR", "JELLYJELLY", "AI16Z", "ELIZAOS"]


def bn_symbols():
    p = f"{RAW}/bn_syms.json"
    if os.path.exists(p):
        return jload(p)
    out, marker = [], ""
    import re
    while True:
        u = "https://s3-ap-northeast-1.amazonaws.com/data.binance.vision?delimiter=/&prefix=data/futures/um/monthly/fundingRate/" + (f"&marker={marker}" if marker else "")
        b = get(u, raw=True).decode()
        out += re.findall(r"<Prefix>data/futures/um/monthly/fundingRate/([A-Z0-9]+)/</Prefix>", b)
        m = re.search(r"<NextMarker>(.*?)</NextMarker>", b)
        if not m:
            break
        marker = m.group(1)
    jsave(p, out)
    return out


def cands():
    L = []
    for s in (1, 1001, 2001, 3001):
        p = f"{RAW}/cmc_list_{s}.json"
        if not os.path.exists(p):
            jsave(p, get(f"https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?start={s}&limit=1000&sortBy=market_cap&sortType=desc&convert=USD&cryptoType=all&tagType=all&audited=false&aux=tags,date_added,circulating_supply,total_supply"))
        L += jload(p)["data"]["cryptoCurrencyList"]
    rank = {x["id"]: i + 1 for i, x in enumerate(L)}
    by = {}
    for x in L:
        by.setdefault(x["symbol"].upper(), []).append(x)
    hlm = jload(f"{RAW}/hl_meta.json")
    if hlm is None:
        hlm = get("https://api.hyperliquid.xyz/info", {"type": "metaAndAssetCtxs"})
        jsave(f"{RAW}/hl_meta.json", hlm)
    bns = set(bn_symbols())
    alias = {"NEIROETH": None, "RNDR": None, "JELLY": "JELLYJELLY", "kNEIRO": "NEIRO"}
    out = {}

    def add(sym, x, hl):
        if x is None:
            return
        if x["id"] in out:
            if hl and not out[x["id"]]["hl"]:
                out[x["id"]]["hl"] = hl
            return
        bn = next((p + sym + "USDT" for p in ("", "1000", "1000000", "1M") if p + sym + "USDT" in bns), None)
        out[x["id"]] = {"sym": sym, "id": x["id"], "slug": x["slug"], "name": x["name"], "tags": x["tags"], "added": x["dateAdded"][:10],
                        "rank": rank[x["id"]], "mcap_now": x["quotes"][0]["marketCap"], "hl": hl, "bn": bn}

    for u in hlm[0]["universe"]:
        n = u["name"]
        s = alias.get(n, n[1:] if n.startswith("k") and n[1:].isupper() else n)
        if s is None:
            continue
        c = by.get(s.upper())
        if c:
            x = max(c, key=lambda q: q["quotes"][0]["marketCap"] or 0)
            if x["dateAdded"][:10] >= "2021-01-01":
                add(s, x, n)
    for x in L[:1200]:
        if ("memes" in x["tags"] or "ai-agents" in x["tags"]) and "2021-01-01" <= x["dateAdded"][:10] <= CUT and x["symbol"].isascii():
            add(x["symbol"].upper(), x, None)
    for s in EXTRA:
        c = by.get(s)
        if c:
            add(s, max(c, key=lambda q: q["quotes"][0]["marketCap"] or 0), None)
    v = sorted(out.values(), key=lambda q: q["rank"])
    jsave(f"{RAW}/cands.json", v)
    print(len(v), "кандидатов;", sum(1 for q in v if q["hl"]), "на Hyperliquid;", sum(1 for q in v if q["bn"]), "на Binance")


# ---------- CoinMarketCap ----------
def cmc_one(q):
    p = f"{RAW}/cmc_{q['id']}.json"
    if os.path.exists(p):
        return
    rows = {}
    y0 = max(2017, int(q["added"][:4]) - 1)
    for year in range(y0, 2027):
        t0 = int(datetime(year, 1, 1, tzinfo=timezone.utc).timestamp())
        t1 = int(datetime(year + 1, 1, 1, tzinfo=timezone.utc).timestamp())
        u = get(f"https://api.coinmarketcap.com/data-api/v3/cryptocurrency/historical?id={q['id']}&convertId=2781&timeStart={t0}&timeEnd={t1}&interval=1d")
        for r in ((u or {}).get("data") or {}).get("quotes") or []:
            x = r["quote"]
            rows[r["timeOpen"][:10]] = [x["open"], x["high"], x["low"], x["close"], x.get("volume") or 0, x.get("marketCap") or 0, x.get("circulatingSupply") or 0]
        time.sleep(0.3)
    jsave(p, {"t": sorted(rows), "v": [rows[k] for k in sorted(rows)]})


def cmc():
    C = jload(f"{RAW}/cands.json")
    with ThreadPoolExecutor(4) as ex:
        for i, _ in enumerate(ex.map(cmc_one, C)):
            if i % 20 == 0:
                print("cmc", i, len(C), flush=True)


# ---------- признак «лоукап» и разбиение ----------
def med(a):
    s = sorted(a)
    return s[len(s) // 2] if s else float("nan")


def select():
    C = jload(f"{RAW}/cands.json")
    rows = []
    for q in C:
        d = jload(f"{RAW}/cmc_{q['id']}.json")
        if not d or not d["t"]:
            continue
        T, V = d["t"], d["v"]
        # начало истории — первый день с объёмом и ценой (до листинга CMC иногда отдаёт нули)
        k0 = next((i for i, v in enumerate(V) if v[3] and v[3] > 0 and v[4] and v[4] > 0), None)
        if k0 is None:
            continue
        T, V = T[k0:], V[k0:]
        mc = [v[5] for v in V if v[5] and v[5] > 0]
        vol = [v[4] for v in V if v[4] and v[4] > 0]
        q2 = dict(q, first=T[0], last=T[-1], n=len(T), mc_med=med(mc) if mc else None, mc_max=max(mc) if mc else None, mc_share=len(mc) / len(V),
                  vol_med=med(vol), ndist=len(set(round(v[3], 12) for v in V)))
        rows.append(q2)
    # лоукап по данным: медианная капитализация за всю историю ≤ $1 млрд, максимум ≥ $30 млн, медианный объём ≥ $2 млн в день,
    # история ≥ 420 дней (год после 20 дней разогрева, как у стенда) и есть капитализация хотя бы у половины дней; стейблкоины и обёртки — вон
    bad = ("stablecoin", "wrapped-tokens", "tokenized-gold", "asset-backed-stablecoin")
    # ошибки данных: ELON — цены 2021 г. округлены (65 повторов закрытия подряд при цене ~1e-8), замены на Hyperliquid/Binance нет
    rows = [r for r in rows if r["sym"] not in ("ELON",)]
    ok = [r for r in rows if r["first"] <= CUT and r["n"] >= 420 and r["mc_med"] and r["mc_share"] >= 0.5 and r["mc_med"] <= 1e9 and r["mc_max"] >= 3e7
          and r["vol_med"] >= 2e6 and not any(t in r["tags"] for t in bad)]
    ok.sort(key=lambda r: r["sym"])
    rnd = random.Random(20261114)
    names = [r["sym"] for r in ok]
    rnd.shuffle(names)
    half = len(names) // 2
    for r in ok:
        r["part"] = "sel" if r["sym"] in names[:half] else "chk"
    jsave(f"{RAW}/selected.json", ok)
    print(len(rows), "с историей;", len(ok), "лоукапов; отбор", half, "проверка", len(ok) - half)
    for r in sorted(ok, key=lambda r: r["first"]):
        print(f"{r['sym']:>10} {r['part']} {r['first']} n={r['n']} mc_med={r['mc_med'] / 1e6:.0f}M max={r['mc_max'] / 1e6:.0f}M vol={r['vol_med'] / 1e6:.1f}M hl={r['hl']} bn={r['bn']} ndist={r['ndist']}")
    rej = [r for r in rows if r not in ok]
    print("не вошли:", " ".join(f"{r['sym']}({'молод' if r['first'] > CUT or r['n'] < 420 else 'кап' if (r['mc_med'] or 0) > 1e9 else 'мал' if (r['mc_max'] or 0) < 3e7 else 'объём' if r['vol_med'] < 2e6 else 'нет кап' if not r['mc_med'] or r['mc_share'] < 0.5 else 'тег'})" for r in rej))


# ---------- Hyperliquid ----------
def hl_one(q):
    if not q["hl"]:
        return
    p = f"{RAW}/hl_{q['hl']}.json"
    if os.path.exists(p):
        return
    d = get("https://api.hyperliquid.xyz/info", {"type": "candleSnapshot", "req": {"coin": q["hl"], "interval": "1d", "startTime": 1640995200000, "endTime": 1800000000000}})
    jsave(p, d or [])
    time.sleep(0.5)


def hl():
    S = jload(f"{RAW}/selected.json")
    with ThreadPoolExecutor(2) as ex:
        list(ex.map(hl_one, S))
    print("hl ok")


# ---------- Binance: фандинг (месяцы) и метрики (каждый 2-й день) ----------
def months(a, b):
    y, m = int(a[:4]), int(a[5:7])
    while f"{y:04d}-{m:02d}" <= b[:7]:
        yield f"{y:04d}-{m:02d}"
        m += 1
        if m == 13:
            y, m = y + 1, 1


def bnf_one(q):
    if not q["bn"]:
        return
    p = f"{RAW}/bnf_{q['bn']}.json"
    if os.path.exists(p):
        return
    s, day = q["bn"], {}
    for ym in months(max(q["first"], "2019-09-01"), "2026-10-31"):
        b = get(f"https://data.binance.vision/data/futures/um/monthly/fundingRate/{s}/{s}-fundingRate-{ym}.zip", raw=True)
        if not b:
            continue
        with zipfile.ZipFile(io.BytesIO(b)) as z:
            txt = z.read(z.namelist()[0]).decode()
        for row in csv.reader(io.StringIO(txt)):
            if not row or not row[0].isdigit():
                continue
            d = datetime.fromtimestamp(int(row[0]) / 1000, timezone.utc).strftime("%Y-%m-%d")
            day[d] = day.get(d, 0) + float(row[2]) * 100
    jsave(p, day)


def bnm_day(args):
    s, d = args
    b = get(f"https://data.binance.vision/data/futures/um/daily/metrics/{s}/{s}-metrics-{d}.zip", raw=True, tries=3)
    if not b:
        return d, None
    with zipfile.ZipFile(io.BytesIO(b)) as z:
        txt = z.read(z.namelist()[0]).decode()
    rows = [r for r in csv.reader(io.StringIO(txt)) if r and r[0][:2] == "20"]
    if not rows:
        return d, None
    r = rows[-1]
    f = lambda x: float(x) if x not in ("", None) else None  # noqa
    return d, [f(r[3]), f(r[6]) if len(r) > 6 else None, f(r[7]) if len(r) > 7 else None]   # OI $, лонги/шорты (счета), тейкеры


def bnm():
    from datetime import timedelta
    S = [q for q in jload(f"{RAW}/selected.json") if q["bn"]]
    if os.environ.get("LOWCAP_REV"):        # второй поток загрузки — с конца списка
        S = S[::-1]
    for q in S:
        p = f"{RAW}/bnm_{q['bn']}.json"
        have = jload(p, {})
        f = jload(f"{RAW}/bnf_{q['bn']}.json", {})
        if not f:
            continue
        d0 = datetime.strptime(min(f), "%Y-%m-%d")
        days, d = [], d0
        while d.strftime("%Y-%m-%d") <= "2026-11-12":
            ds = d.strftime("%Y-%m-%d")
            if ds not in have:
                days.append((q["bn"], ds))
            d += timedelta(days=2)
        if not days:
            continue
        with ThreadPoolExecutor(12) as ex:
            for ds, v in ex.map(bnm_day, days):
                have[ds] = v
        jsave(p, have)
        print("bnm", q["bn"], len(have), flush=True)


def bnf():
    S = jload(f"{RAW}/selected.json")
    with ThreadPoolExecutor(6) as ex:
        list(ex.map(bnf_one, S))
    print("bnf ok")


# ---------- страницы стенда для лоукапов (build_builder.py file:…, по 10 монет) и выгрузка рядов для быстрого оценщика ----------
PAGES_DIR = os.environ.get("LOWCAP_PAGES", os.path.join(os.path.dirname(RAW), "pages"))


def pages():
    import subprocess
    S = jload(f"{RAW}/selected.json")
    os.makedirs(PAGES_DIR, exist_ok=True)
    names = []
    for k in range(0, len(S), 10):
        nm = f"lc{k // 10}"
        lst = [{"cid": q["id"], "ticker": q["sym"], "name": q["name"], "skip": 20, "year": int(q["first"][:4])} for q in S[k:k + 10]]
        jsave(f"{PAGES_DIR}/{nm}.list.json", lst)
        if not os.path.exists(f"{PAGES_DIR}/{nm}.html"):
            subprocess.run([sys.executable, os.path.join(HERE, "build_builder.py"), f"{PAGES_DIR}/{nm}.html", f"file:{PAGES_DIR}/{nm}.list.json"], check=True)
        names.append(nm)
    jsave(f"{PAGES_DIR}/pages.json", {nm: [q["sym"] for q in S[k * 10:k * 10 + 10]] for k, nm in enumerate(names)})
    print("страницы:", " ".join(names))


# ---------- капитализация монет стандартного стенда (для признака «лоукап» на отборе/экзамене/50 случайных/100 новых) ----------
MAIN = ["SOL", "ETH", "BTC", "DOGE", "XRP", "BNB", "TON", "HYPE", "PUMP", "ADA", "LTC", "LINK", "AVAX", "TRX", "XLM", "DOT", "BCH",
        "ETC", "XMR", "ATOM", "ALGO", "VET", "FIL", "NEAR", "AAVE", "SHIB", "PEPE", "BONK", "WIF", "FLOKI", "FARTCOIN"]


def stand_ids():
    L = []
    for s_ in (1, 1001, 2001, 3001):
        L += jload(f"{RAW}/cmc_list_{s_}.json")["data"]["cryptoCurrencyList"]
    by = {}
    for x in L:
        by.setdefault(x["symbol"].upper(), []).append(x)
    out = {}
    for t in MAIN:
        if t == "TON":
            out[t] = {"id": 11419, "year": 2019}
            continue
        x = max(by[t], key=lambda q: q["quotes"][0]["marketCap"] or 0)
        out[t] = {"id": x["id"], "year": max(2013, int(x["dateAdded"][:4]))}
    for f in ("random50", "random100"):
        for c in jload(os.path.join(HERE, "found", f + ".json")):
            out[f + ":" + c["ticker"]] = {"id": c["cid"], "year": c["year"]}
    return out


def standmc():
    ids = stand_ids()
    Q = [{"id": v["id"], "added": f"{v['year'] + 1}-01-01"} for v in ids.values()]
    with ThreadPoolExecutor(3) as ex:
        for i, _ in enumerate(ex.map(cmc_one, Q)):
            if i % 25 == 0:
                print("standmc", i, len(Q), flush=True)
    jsave(f"{RAW}/stand_ids.json", ids)
    print("standmc ok", len(Q))


# ---------- компактный файл ----------
def sig(x, k=4):
    if x is None or x != x or x == 0:
        return 0
    from math import floor, log10
    return round(x, -int(floor(log10(abs(x)))) + (k - 1))


def _enc(arr, kind):
    """Упаковка ряда в base64: f4 — float32; lg — uint16 код (log10(x)+3)·1000 (0 = нет); fu — int16 фандинг ·1e4 % (−32768 = нет)."""
    import base64
    import math
    import struct
    if kind == "f4":
        b = struct.pack(f"<{len(arr)}f", *[x if x is not None else float("nan") for x in arr])
    elif kind == "lg":
        b = struct.pack(f"<{len(arr)}H", *[0 if (x is None or x != x or x <= 0) else max(1, min(65535, round((math.log10(x) + 3) * 1000))) for x in arr])
    else:
        b = struct.pack(f"<{len(arr)}h", *[-32768 if (x is None or x != x) else max(-32767, min(32767, round(x * 1e4))) for x in arr])
    return base64.b64encode(b).decode()


def _enc8(arr, step=0.03):
    """uint8 лог-код с собственным нижним краем ряда: код = round((log10(x) − lo)/step) + 1, 0 = нет; → (base64, lo)."""
    import base64
    import math
    lg = [math.log10(x) for x in arr if x is not None and x == x and x > 0]
    if not lg:
        return "", 0.0
    lo = math.floor(min(lg) * 100) / 100
    b = bytes(0 if (x is None or x != x or x <= 0) else max(1, min(255, round((math.log10(x) - lo) / step) + 1)) for x in arr)
    return base64.b64encode(b).decode(), lo


def _dec8(s, lo, step=0.03):
    import base64
    return [float("nan") if v == 0 else 10 ** ((v - 1) * step + lo) for v in base64.b64decode(s)]


def _dec(s, kind):
    import base64
    import struct
    b = base64.b64decode(s)
    if kind == "f4":
        return list(struct.unpack(f"<{len(b) // 4}f", b))
    if kind == "lg":
        return [float("nan") if v == 0 else 10 ** (v / 1000 - 3) for v in struct.unpack(f"<{len(b) // 2}H", b)]
    return [float("nan") if v == -32768 else v / 1e4 for v in struct.unpack(f"<{len(b) // 2}h", b)]


def _supply(T, V, step=7):
    """Предложение в обращении по неделям (каждый step-й день); дни без капитализации CMC — первым известным значением (оценка, флаг est)."""
    sup = [v[5] / v[3] if v[5] and v[3] else None for v in V]
    first = next((x for x in sup if x), None)
    est = [x is None for x in sup]
    last = first
    full = []
    for x in sup:
        if x:
            last = x
        full.append(last)
    wk = [full[k] for k in range(0, len(full), step)]
    k0 = next((k for k, e in enumerate(est) if not e), len(est))   # дней с оценкой в начале
    return wk, k0


def build():
    S = jload(f"{RAW}/selected.json")
    out = {"about": "Лоукапы агента ЛОУКАП (CoinMarketCap, Hyperliquid, data.binance.vision). Ряды по дням с first (UTC), упакованы в base64: "
                    "c — закрытие $ (float32); v — объём $ CMC, hv — объём перпа Hyperliquid $, oi — открытый интерес Binance $ (каждый 2-й день) — uint8 код round((log10(x) − <ключ>_lo)/0,03) + 1, 0 = нет (точность ±3,5%); "
                    "f — фандинг Binance за день, % (int16 ·1e4, −32768 = нет); sup — предложение в обращении по неделям (каждый 7-й день, uint16 лог-код), "
                    "капитализация = c · sup; sup_est — сколько первых дней без капитализации CMC (предложение взято первым известным, оценка). "
                    "part: sel — отбор, chk — проверка (случайно по монетам, seed 20261114); время — до/после " + SPLIT_DATE + ". "
                    "stand — предложение (по неделям) и объём $ CMC (по дням, uint8) монет стандартного стенда (признаки «лоукап» и оборот на отборе/экзамене/50 случайных/100 новых).",
           "split_date": SPLIT_DATE, "coins": {}, "stand": {}}
    for q in S:
        d = jload(f"{RAW}/cmc_{q['id']}.json")
        T = [t for t in d["t"] if t >= q["first"]]
        V = [v for t, v in zip(d["t"], d["v"]) if t >= q["first"]]
        hl_ = {}
        if q["hl"]:
            for x in jload(f"{RAW}/hl_{q['hl']}.json", []) or []:
                dd = datetime.fromtimestamp(x["t"] / 1000, timezone.utc).strftime("%Y-%m-%d")
                hl_[dd] = float(x["v"]) * float(x["c"])
        fu = jload(f"{RAW}/bnf_{q['bn']}.json", {}) if q["bn"] else {}
        om = jload(f"{RAW}/bnm_{q['bn']}.json", {}) if q["bn"] else {}
        wk, k0 = _supply(T, V)
        out["coins"][q["sym"]] = {
            "id": q["id"], "name": q["name"], "part": q["part"], "first": T[0], "n": len(T), "hl": q["hl"], "bn": q["bn"],
            "meme": int("memes" in q["tags"]), "ai": int("ai-agents" in q["tags"] or "ai-memes" in q["tags"]), "sup_est": k0,
            "c": _enc([v[3] for v in V], "f4"), "sup": _enc(wk, "lg"), "f": _enc([fu.get(t) for t in T], "fu"),
        }
        for key, arr in (("v", [v[4] for v in V]), ("hv", [hl_.get(t) for t in T]), ("oi", [(om.get(t) or [None])[0] for t in T])):
            out["coins"][q["sym"]][key], out["coins"][q["sym"]][key + "_lo"] = _enc8(arr)
    ids = jload(f"{RAW}/stand_ids.json", {})
    for k, v in ids.items():
        d = jload(f"{RAW}/cmc_{v['id']}.json")
        if not d or not d["t"]:
            continue
        k1 = next((i for i, x in enumerate(d["v"]) if x[5]), None)
        if k1 is None:
            continue
        T, V = d["t"][k1:], d["v"][k1:]
        wk, k0 = _supply(T, V)
        vv, vlo = _enc8([x[4] for x in V])
        out["stand"][k] = {"id": v["id"], "first": T[0], "n": len(T), "sup": _enc(wk, "lg"), "v": vv, "v_lo": vlo}
    jsave(OUT, out)
    print("записано", OUT, os.path.getsize(OUT) // 1024, "КБ,", len(out["coins"]), "лоукапов,", len(out["stand"]), "монет стенда")


# ---------- загрузчик ----------
def load(path=OUT):
    """→ (D, meta, stand): D[sym] — DataFrame по дням: c, v, mcap, supply, hlv, fund, oi (NaN = нет); stand[ключ] — DataFrame по дням: supply, v."""
    import pandas as pd
    j = jload(path)
    D, meta = {}, {}
    for k, x in j["coins"].items():
        idx = pd.date_range(x["first"], periods=x["n"], freq="D")
        sup = _dec(x["sup"], "lg")
        sup_d = [sup[min(i // 7, len(sup) - 1)] for i in range(x["n"])]
        d8 = lambda key: _dec8(x[key], x[key + "_lo"]) if x[key] else [float("nan")] * x["n"]  # noqa
        df = pd.DataFrame({"c": _dec(x["c"], "f4"), "v": d8("v"), "supply": sup_d, "hlv": d8("hv"), "fund": _dec(x["f"], "fu"), "oi": d8("oi")}, index=idx)
        df["mcap"] = df["c"] * df["supply"]
        D[k] = df
        meta[k] = {q: v for q, v in x.items() if q not in ("c", "v", "sup", "hv", "f", "oi", "v_lo", "hv_lo", "oi_lo")}
    stand = {}
    for k, x in j.get("stand", {}).items():
        sup = _dec(x["sup"], "lg")
        idx = pd.date_range(x["first"], periods=x["n"], freq="D")
        stand[k] = pd.DataFrame({"supply": [sup[min(i // 7, len(sup) - 1)] for i in range(x["n"])], "v": _dec8(x["v"], x["v_lo"])}, index=idx)
    return D, meta, stand


if __name__ == "__main__":
    os.makedirs(RAW, exist_ok=True)
    {"cands": cands, "cmc": cmc, "select": select, "hl": hl, "bnf": bnf, "bnm": bnm, "build": build, "pages": pages, "standmc": standmc}[sys.argv[1]]()
