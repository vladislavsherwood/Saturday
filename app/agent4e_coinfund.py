"""Агент 4E, круг 9: собственный фандинг каждой монеты стенда (бессрочные фьючерсы Binance USDT-M, data.binance.vision, помесячно).
Пробует <NAME>USDT и 1000<NAME>USDT; монеты без фьючерса пропускаются (правило по ним молчит).
Выход: app/found/agent4e_coinfund.json = {"t0": день начала, "c": {NAME: [фандинг % за день или null, ...]}} (дни с 2019-09-01).
Запуск: python3 app/agent4e_coinfund.py <names.json>"""
import sys, os, json, datetime as dt
from concurrent.futures import ThreadPoolExecutor
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4e_data import bv, zcsv, HERE

MONTHS = pd.date_range("2019-09-01", dt.date.today() - dt.timedelta(days=20), freq="MS")
PROBE = [m for m in MONTHS if m.strftime("%Y-%m") in ("2021-06", "2023-06", "2024-06", "2025-06", "2026-09")]


def exists(sym):
    return any(bv(f"monthly/fundingRate/{sym}/{sym}-fundingRate-{m:%Y-%m}.zip") for m in PROBE)


def series(sym):
    parts = [zcsv(bv(f"monthly/fundingRate/{sym}/{sym}-fundingRate-{m:%Y-%m}.zip")) for m in MONTHS]
    parts = [p for p in parts if p is not None and len(p)]
    if not parts:
        return None
    for x in parts:
        x.columns = range(len(x.columns))
    p = pd.concat(parts)
    s = pd.Series(pd.to_numeric(p.iloc[:, -1], errors="coerce").values, index=pd.to_datetime(pd.to_numeric(p.iloc[:, 0]), unit="ms"))
    return s.resample("D").sum(min_count=1) * 100


def one(name):
    for sym in (name + "USDT", "1000" + name + "USDT"):
        if exists(sym):
            s = series(sym)
            if s is not None and s.notna().sum() > 60:
                return name, sym, s
    return name, None, None


if __name__ == "__main__":
    names = json.load(open(sys.argv[1]))
    with ThreadPoolExecutor(16) as ex:
        res = list(ex.map(one, names))
    t0 = pd.Timestamp("2019-09-01"); idx = pd.date_range(t0, dt.date.today())
    out = {"t0": (t0 - pd.Timestamp("1970-01-01")).days, "c": {}}
    for name, sym, s in res:
        if sym is None:
            continue
        s = s[~s.index.duplicated()].reindex(idx)
        out["c"][name] = [None if pd.isna(v) else round(float(v), 3) for v in s]
        print(f"{name}: {sym} с {s.first_valid_index().date()}")
    print("монет с фандингом:", len(out["c"]), "из", len(names))
    f = os.path.join(HERE, "found", "agent4e_coinfund.json"); json.dump(out, open(f, "w"), separators=(",", ":"))
    print("сохранено", f, os.path.getsize(f) // 1024, "КБ")
