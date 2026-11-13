"""Макроданные для металлов: ставки и кривая доходности (Казначейство США), инфляция и безработица (BLS через DBnomics),
нейтральная ставка r* (ФРС Нью-Йорка, модель Лаубаха — Уильямса), нефть, доллар, акции, облигации, VIX (Yahoo).

FRED из этой среды недоступен (рвёт соединение), поэтому ряды берутся у первоисточников.
Всё, что публикуется с опозданием, сдвигается вперёд на срок публикации, чтобы расчёт не заглядывал в будущее:
инфляция и безработица — на 45 дней от начала месяца, r* — на 120 дней от начала квартала.
"""
import csv
import io
import json
import os
import urllib.request
from datetime import datetime

import numpy as np
import pandas as pd

import data

UA = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120 Safari/537.36"}


def _text(url, timeout=60):
    last = None
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=timeout) as r:
                return r.read()
        except Exception as e:  # noqa: BLE001
            last = e
    raise last


def treasury(kind):
    """Дневная кривая доходности: kind = 'nominal' (с 1990) или 'real' (TIPS, с 2003). Колонки — сроки, значения в процентах."""
    def load():
        rows = {}
        typ = "daily_treasury_yield_curve" if kind == "nominal" else "daily_treasury_real_yield_curve"
        for year in range(1990 if kind == "nominal" else 2003, datetime.utcnow().year + 1):
            url = (f"https://home.treasury.gov/resource-center/data-chart-center/interest-rates/daily-treasury-rates.csv/{year}/all"
                   f"?type={typ}&field_tdr_date_value={year}&page&_format=csv")
            try:
                txt = _text(url).decode()
            except Exception as e:  # noqa: BLE001
                print("казначейство", kind, year, e)
                continue
            for r in csv.DictReader(io.StringIO(txt)):
                d = datetime.strptime(r["Date"], "%m/%d/%Y").strftime("%Y-%m-%d")
                rows[d] = {k.strip(): (float(v) if v not in ("", "N/A") else None) for k, v in r.items() if k != "Date"}
        return rows
    d = data._cached(f"treasury_{kind}.json", 86400, load)
    df = pd.DataFrame.from_dict(d, orient="index")
    df.index = pd.to_datetime(df.index)
    return df.sort_index().astype(float)


def bls(series):
    """Месячный ряд BLS через DBnomics: LNS14000000 — безработица, CUSR0000SA0 — индекс потребительских цен."""
    ds = {"LN": "ln", "CU": "cu"}[series[:2]]

    def load():
        d = json.loads(_text(f"https://api.db.nomics.world/v22/series/BLS/{ds}/{series}?observations=1"))["series"]["docs"][0]
        return {"t": d["period_start_day"], "v": d["value"]}
    d = data._cached(f"bls_{series}.json", 86400, load)
    s = pd.Series([np.nan if v in ("NA", None) else float(v) for v in d["v"]], index=pd.to_datetime(d["t"]))
    return s.dropna()


def rstar():
    """Нейтральная реальная ставка r* по модели Лаубаха — Уильямса (квартальная, односторонняя оценка), в процентах."""
    path = os.path.join(data.CACHE, "lw_rstar.xlsx")
    if not os.path.exists(path) or (datetime.now().timestamp() - os.path.getmtime(path)) > 7 * 86400:
        os.makedirs(data.CACHE, exist_ok=True)
        open(path, "wb").write(_text("https://www.newyorkfed.org/medialibrary/media/research/economists/williams/data/Laubach_Williams_current_estimates.xlsx"))
    x = pd.read_excel(path, sheet_name="data", header=None)
    # строка заголовков — та, где есть слово Date; r* — первая колонка с подписью rstar в односторонних оценках
    hdr = next(i for i in range(len(x)) if any(str(v).strip().lower() == "date" for v in x.iloc[i].values))
    cols = [str(v).strip().lower() for v in x.iloc[hdr].values]
    dcol, rcol = cols.index("date"), next(i for i, v in enumerate(cols) if v.startswith("rstar"))
    body = x.iloc[hdr + 1:]
    s = pd.Series(pd.to_numeric(body.iloc[:, rcol], errors="coerce").values, index=pd.to_datetime(body.iloc[:, dcol], errors="coerce")).dropna()
    return s[s.index.notna()]


def long_history(symbol):
    """Дневные свечи Yahoo за всю доступную историю (обычный загрузчик приложения берёт только с 2009 года)."""
    def load():
        import urllib.parse
        res = data._get("https://query1.finance.yahoo.com/v8/finance/chart/" + urllib.parse.quote(symbol) + "?period1=0&period2=9999999999&interval=1d")["chart"]["result"][0]
        q = res["indicators"]["quote"][0]
        return {"t": res["timestamp"], "c": q["close"], "v": q.get("volume")}
    d = data._cached("long_" + "".join(ch if ch.isalnum() else "_" for ch in symbol) + ".json", 6 * 3600, load)
    idx = pd.to_datetime(d["t"], unit="s").normalize()
    df = pd.DataFrame({"c": pd.Series(d["c"], index=idx, dtype=float), "v": pd.Series(d.get("v") or [0] * len(idx), index=idx, dtype=float).fillna(0)})
    df = df[(df["c"] > 0) & ~df.index.duplicated(keep="last")]
    return df[df.index < pd.Timestamp(datetime.utcnow().date())]


def yahoo(symbol):
    return long_history(symbol)["c"]


def table(idx):
    """Все макроряды по дням idx, уже со сдвигом на срок публикации."""
    nom, real = treasury("nominal"), treasury("real")
    cpi, un, rs = bls("CUSR0000SA0"), bls("LNS14000000"), rstar()
    lag = lambda s, days: s.set_axis(s.index + pd.Timedelta(days=days))     # noqa: E731
    f = lambda s: s.reindex(idx, method="ffill")                             # noqa: E731
    M = pd.DataFrame(index=idx)
    M["y3m"], M["y2"], M["y10"] = f(nom["3 Mo"]), f(nom["2 Yr"]), f(nom["10 Yr"])
    M["real10"] = f(real["10 YR"]) if "10 YR" in real else f(real.iloc[:, -3])
    M["cpi_yoy"] = f(lag((cpi / cpi.shift(12) - 1) * 100, 45))
    M["cpi_3m"] = f(lag(((cpi / cpi.shift(3)) ** 4 - 1) * 100, 45))
    M["unemp"] = f(lag(un, 45))
    M["unemp_low"] = f(lag(un - un.rolling(12).min(), 45))                  # насколько безработица выше своего минимума за год
    M["rstar"] = f(lag(rs, 120))
    for name, sym in (("oil", "CL=F"), ("spx", "^GSPC"), ("tlt", "TLT"), ("dxy", "DX-Y.NYB"), ("vix", "^VIX")):
        try:
            M[name] = f(yahoo(sym))
        except Exception as e:  # noqa: BLE001
            print(name, e)
    return M
