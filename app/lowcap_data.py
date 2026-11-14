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
    # лоукап по данным: медианная капитализация за всю историю ≤ $1,5 млрд, максимум ≥ $30 млн, медианный объём ≥ $1 млн в день,
    # история ≥ 365 дней к 2026-11-14 и есть капитализация хотя бы у половины дней; стейблкоины и обёртки — вон
    bad = ("stablecoin", "wrapped-tokens", "tokenized-gold", "asset-backed-stablecoin")
    ok = [r for r in rows if r["first"] <= CUT and r["mc_med"] and r["mc_share"] >= 0.5 and r["mc_med"] <= 1.5e9 and r["mc_max"] >= 3e7
          and r["vol_med"] >= 1e6 and not any(t in r["tags"] for t in bad)]
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
    print("не вошли:", " ".join(f"{r['sym']}({'молод' if r['first'] > CUT else 'кап' if (r['mc_med'] or 0) > 1.5e9 else 'мал' if (r['mc_max'] or 0) < 3e7 else 'объём' if r['vol_med'] < 1e6 else 'нет кап' if not r['mc_med'] or r['mc_share'] < 0.5 else 'тег'})" for r in rej))


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


# ---------- компактный файл ----------
def sig(x, k=4):
    if x is None or x != x or x == 0:
        return 0
    from math import floor, log10
    return round(x, -int(floor(log10(abs(x)))) + (k - 1))


def build():
    S = jload(f"{RAW}/selected.json")
    out = {"about": "Лоукапы агента ЛОУКАП: дни с first; c — закрытие $, h/l — к закрытию, v — объём $ (CMC), mc — капитализация $ (CMC, 0 = нет), "
                    "sup — предложение в обращении, hv — объём перпа Hyperliquid $, f — фандинг Binance за день %, oi — OI Binance $ (каждый 2-й день, 0 = нет), "
                    "ls — лонги/шорты счетов Binance. Разбиение part: sel — отбор, chk — проверка (по монетам, seed 20261114); время — до/после " + SPLIT_DATE,
           "coins": {}}
    for q in S:
        d = jload(f"{RAW}/cmc_{q['id']}.json")
        T = [t for t, v in zip(d["t"], d["v"]) if t >= q["first"]]
        V = [v for t, v in zip(d["t"], d["v"]) if t >= q["first"]]
        hl_ = {}
        if q["hl"]:
            for x in jload(f"{RAW}/hl_{q['hl']}.json", []) or []:
                dd = datetime.fromtimestamp(x["t"] / 1000, timezone.utc).strftime("%Y-%m-%d")
                hl_[dd] = float(x["v"]) * float(x["c"])
        fu = jload(f"{RAW}/bnf_{q['bn']}.json", {}) if q["bn"] else {}
        om = jload(f"{RAW}/bnm_{q['bn']}.json", {}) if q["bn"] else {}
        c = [v[3] for v in V]
        out["coins"][q["sym"]] = {
            "id": q["id"], "name": q["name"], "part": q["part"], "first": T[0], "hl": q["hl"], "bn": q["bn"],
            "meme": int("memes" in q["tags"]), "ai": int("ai-agents" in q["tags"] or "ai-memes" in q["tags"]),
            "c": [sig(x, 5) for x in c],
            "h": [round(v[1] / v[3], 3) if v[3] else 1 for v in V], "l": [round(v[2] / v[3], 3) if v[3] else 1 for v in V],
            "v": [sig(v[4], 3) for v in V], "mc": [sig(v[5], 3) for v in V], "sup": [sig(v[6], 3) for v in V],
            "hv": [sig(hl_.get(t), 3) for t in T], "f": [round(fu[t], 4) if t in fu else None for t in T],
            "oi": [sig((om.get(t) or [None])[0], 3) for t in T], "ls": [round((om.get(t) or [None, None])[1] or 0, 3) for t in T],
        }
    jsave(OUT, out)
    print("записано", OUT, os.path.getsize(OUT) // 1024, "КБ,", len(out["coins"]), "монет")


# ---------- загрузчик ----------
def load(path=OUT):
    import pandas as pd
    j = jload(path)
    D = {}
    for k, x in j["coins"].items():
        idx = pd.date_range(x["first"], periods=len(x["c"]), freq="D")
        df = pd.DataFrame({"c": x["c"], "v": x["v"], "mcap": x["mc"], "supply": x["sup"], "hlv": x["hv"], "oi": x["oi"], "lsr": x["ls"]}, index=idx, dtype=float)
        df["h"] = df["c"] * pd.Series(x["h"], index=idx)
        df["l"] = df["c"] * pd.Series(x["l"], index=idx)
        df["fund"] = pd.Series([v if v is not None else float("nan") for v in x["f"]], index=idx)
        for col in ("v", "mcap", "supply", "hlv", "oi", "lsr"):
            df[col] = df[col].where(df[col] > 0)
        D[k] = df
    meta = {k: {q: v for q, v in x.items() if not isinstance(v, list)} for k, x in j["coins"].items()}
    return D, meta


if __name__ == "__main__":
    os.makedirs(RAW, exist_ok=True)
    {"cands": cands, "cmc": cmc, "select": select, "hl": hl, "bnf": bnf, "bnm": bnm, "build": build}[sys.argv[1]]()
