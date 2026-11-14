"""Соотношение лонгов и шортов (Binance, BTCUSDT, с 2020-09) вместе со следами ликвидаций: что было с ценой после таких дней.
ls — лонги/шорты по счетам, tls — по позициям крупных трейдеров. Цена: BTC и среднее по ETH, SOL, DOGE.
Запуск: python3 app/ls_study.py"""
import sys, os, json
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data

d = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "liq_extra.json")))
X = pd.DataFrame({k: d[k] for k in ("boic", "bls", "btls", "bfund", "btaker")}, index=pd.to_datetime(d["t"], unit="D"), dtype=float)
oic = X["boic"].copy(); last = np.nan
for i, v in enumerate(oic.values):
    if v > 0 and not (v < 0.7 * last): last = v
    oic.iloc[i] = last
X = X[X.index >= "2020-09-01"]; oic = oic[oic.index >= "2020-09-01"]
F = pd.DataFrame(index=X.index)
F["oidd"] = (oic / oic.rolling(30, min_periods=1).max() - 1) * 100
F["oic7"] = (oic / oic.shift(7) - 1) * 100
F["ls"] = X["bls"]; F["tls"] = X["btls"]
F["lsr"] = X["bls"] / X["bls"].rolling(90).mean(); F["tlsr"] = X["btls"] / X["btls"].rolling(90).mean()
F["ls7"] = (X["bls"] / X["bls"].shift(7) - 1) * 100; F["tls7"] = (X["btls"] / X["btls"].shift(7) - 1) * 100
F["div"] = F["tlsr"] / F["lsr"]                                           # крупные лонгуют сильнее толпы
F["fund7"] = X["bfund"].rolling(7).sum()
F["oic3"] = (oic / oic.shift(3) - 1) * 100
F["flush"] = F["oidd"].rolling(14).min()                                  # был ли вынос за последние 2 недели
px = {s: data.history(s)[0] for s in ("BTC-USD", "ETH-USD", "SOL-USD", "DOGE-USD")}
P = pd.DataFrame({k: v.reindex(F.index, method="ffill") for k, v in px.items()})
fwd = {n: (P.shift(-n) / P - 1) * 100 for n in (30, 90, 180)}
lo90 = (P / P[::-1].rolling(90, min_periods=1).min()[::-1] - 1) * 100       # насколько выше будущего минимума за 90 дней


def show(name, mask):
    m = mask.fillna(False)
    if m.sum() == 0:
        print(f"{name:85} — ни разу"); return
    days = F.index[m]; ep = 1 + int((np.diff(days.values).astype("timedelta64[D]").astype(int) > 20).sum())
    alt = lambda df: df[["ETH-USD", "SOL-USD", "DOGE-USD"]].mean(axis=1)    # noqa: E731
    print(f"{name:85} дней {m.sum():4d}, эпизодов {ep:2d} | BTC через 30/90/180: {fwd[30]['BTC-USD'][m].median():+4.0f}/{fwd[90]['BTC-USD'][m].median():+4.0f}/{fwd[180]['BTC-USD'][m].median():+4.0f}%"
          f" | альты: {alt(fwd[30])[m].median():+4.0f}/{alt(fwd[90])[m].median():+4.0f}/{alt(fwd[180])[m].median():+4.0f}% | выше будущего дна BTC на {lo90['BTC-USD'][m].median():.0f}%, альтов {alt(lo90)[m].median():.0f}%")


show("любой день", F["oidd"].notna())
show("уже в стратегии: волна ликвидаций (OI −28% от макс.)", F["oidd"] < -28)
show("OI −20% от макс.", F["oidd"] < -20)
for x in (-10, -15, -20):
    show(f"лонги выброшены: OI −15%+ и доля лонгов у счетов за 7 дней {x}%", (F["oidd"] < -15) & (F["ls7"] < x))
for x in (0.85, 0.9):
    show(f"после выноса (OI был −20% за 2 недели) и толпа в шортах (лонги/шорты к средней < {x})", (F["flush"] < -20) & (F["lsr"] < x))
for x in (1.1, 1.2):
    show(f"расхождение: крупные лонгуют сильнее толпы в {x}+ раза и OI −15%+", (F["div"] > x) & (F["oidd"] < -15))
    show(f"расхождение в {x}+ раза (без условия на OI)", F["div"] > x)
show("после выноса толпа в шортах, а OI снова растёт (3 дня +3%)", (F["flush"] < -20) & (F["lsr"] < 0.9) & (F["oic3"] > 3))
show("вынос + фандинг за 7 дней < 0 + лонги/шорты ниже обычного", (F["oidd"] < -15) & (F["fund7"] < 0) & (F["lsr"] < 0.95))
show("крупные трейдеры добавили лонги +10% за 7 дней, а OI −15%+", (F["tls7"] > 10) & (F["oidd"] < -15))
show("крупные трейдеры добавили лонги +20% за 7 дней", F["tls7"] > 20)
show("доля лонгов у счетов на минимуме за 90 дней и OI −15%+", (F["ls"] <= F["ls"].rolling(90).min()) & (F["oidd"] < -15))

print("\n--- лонги/шорты как уточнение правила ликвидаций ---")
for th in (-28, -24, -20):
    show(f"OI {th}% от макс.", F["oidd"] < th)
    show(f"OI {th}% и доля лонгов у счетов упала на 10%+ за 7 дней", (F["oidd"] < th) & (F["ls7"] < -10))
    show(f"OI {th}% и доля лонгов НЕ упала (вынесло шорты/хедж?)", (F["oidd"] < th) & (F["ls7"] >= -10))
    show(f"OI {th}% и толпа в шортах (к средней < 0,9)", (F["oidd"] < th) & (F["lsr"] < 0.9))
    show(f"OI {th}% и крупные лонгуют сильнее толпы (1,1+)", (F["oidd"] < th) & (F["div"] > 1.1))
