"""Металлы за 55 лет помесячно: особенности вершин и дна.

Данные (все помесячно):
- металлы и нефть — Всемирный банк, «розовый лист» CMO, с 1960: золото, серебро, платина, медь, алюминий, никель, свинец, цинк, нефть;
- ставка ФРС (с 1954), 3-месячные векселя, доходность 10-летних облигаций (с 1953) — ФРС, ряд H15, через DBnomics;
- инфляция (с 1947) и безработица (с 1948) — BLS через DBnomics; нейтральная ставка r* — ФРС Нью-Йорка, модель Лаубаха — Уильямса (с 1961);
- доллар — индекс BIS к 27 валютам (1964–2025), продлён индексом ФРС Broad Dollar; акции — S&P 500 из Yahoo.
Без заглядывания в будущее: инфляция и безработица известны через месяц, r* — через 4 месяца.
Золото и серебро считаются с 1972 года: до отмены золотого стандарта их цена была фиксированной или регулируемой.

Инфляция и безработица — копия ОЭСР через DBnomics: последние месяцы, пока данных нет, тянутся последним известным значением.

Запуск: python3 app/metals_long.py <куда.json>
"""
import json
import os
import sys
import warnings

import numpy as np
import pandas as pd

warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import data  # noqa: E402
import macro  # noqa: E402
from markers import auc  # noqa: E402

WB = "https://thedocs.worldbank.org/en/doc/74e8be41ceb20fa0da750cda2f6b9e4e-0050012026/related/CMO-Historical-Data-Monthly.xlsx"
# металл: (колонка Всемирного банка, название, во сколько раз должна уйти цена, чтобы разворот считался крупным, группа)
METALS = {"gold": ("Gold", "Золото", 1.5, "драг"), "silver": ("Silver", "Серебро", 1.8, "драг"), "platinum": ("Platinum", "Платина", 1.6, "драг"),
          "copper": ("Copper", "Медь", 1.6, "пром"), "aluminum": ("Aluminum", "Алюминий", 1.5, "пром"), "nickel": ("Nickel", "Никель", 1.8, "пром"),
          "lead": ("Lead", "Свинец", 1.6, "пром"), "zinc": ("Zinc", "Цинк", 1.6, "пром")}


def worldbank():
    path = os.path.join(data.CACHE, "wb_cmo_monthly.xlsx")
    if not os.path.exists(path) or os.path.getsize(path) < 100000:
        os.makedirs(data.CACHE, exist_ok=True)
        open(path, "wb").write(macro._text(WB, 120))
    x = pd.read_excel(path, sheet_name="Monthly Prices", header=None)
    names = [str(v).strip() for v in x.iloc[4].values]
    body = x.iloc[6:]
    idx = pd.to_datetime(body.iloc[:, 0].astype(str).str.replace("M", "-") + "-01") + pd.offsets.MonthEnd(0)
    out = pd.DataFrame(index=idx)
    for k, (col, _, _, _) in METALS.items():
        out[k] = pd.to_numeric(body.iloc[:, names.index(col)], errors="coerce").values
    out["oil"] = pd.to_numeric(body.iloc[:, names.index("Crude oil, average")], errors="coerce").values
    return out


def dbn(provider, dataset, code):
    def load():
        d = json.loads(macro._text(f"https://api.db.nomics.world/v22/series/{provider}/{dataset}/{code}?observations=1"))["series"]["docs"][0]
        return {"t": d["period_start_day"], "v": d["value"]}
    d = data._cached(f"dbn_{provider}_{dataset}_{code}.json".replace("/", "_"), 86400, load)
    s = pd.Series([np.nan if v in ("NA", None) else float(v) for v in d["v"]], index=pd.to_datetime(d["t"]) + pd.offsets.MonthEnd(0))
    return s[~s.index.duplicated()].dropna()


def monthly_table():
    W = worldbank()
    idx = W.index
    m = lambda s: s.resample("ME").last().reindex(idx, method="ffill")       # noqa: E731
    lag = lambda s, k: s.shift(k)                                            # noqa: E731
    X = W.copy()
    X["ff"] = dbn("FED", "H15", "RIFSPFF_N.M").reindex(idx)
    X["y10"] = dbn("FED", "H15", "RIFLGFCY10_N.M").reindex(idx)
    X["tb3"] = dbn("FED", "H15", "RIFSGFSM03_N.M").reindex(idx)
    # инфляция и безработица — копия ОЭСР (у BLS через DBnomics ряды обрываются на январе 2025); последние месяцы до выхода данных тянутся прежним значением
    cpi = dbn("OECD", "DSD_PRICES@DF_PRICES_ALL", "USA.M.N.CPI.IX._T.N._Z")
    X["cpi"] = lag(cpi.reindex(idx), 1).ffill(limit=8)
    un = dbn("OECD", "DSD_LFS@DF_IALFS_UNE_M", "USA.UNE_LF_M.PT_LF_SUB._Z.Y._T.Y_GE15..M")
    X["unemp"] = lag(un.reindex(idx), 1).ffill(limit=8)
    rs = macro.rstar()
    X["rstar"] = lag(rs.set_axis(rs.index + pd.offsets.MonthEnd(0)).resample("ME").ffill().reindex(idx, method="ffill"), 4)
    old = dbn("BIS", "WS_EER", "M.N.N.US")
    new = dbn("FED", "H10", "JRXWTFB_N.M")
    k = (old / new.reindex(old.index)).dropna().iloc[-12:].mean()
    X["usd"] = pd.concat([old, new[new.index > old.index[-1]] * k]).reindex(idx)
    X["spx"] = m(macro.long_history("^GSPC")["c"])
    return X[X.index >= "1965-01-01"]


def ma(s, n):
    return s.rolling(n, min_periods=int(n * 0.7)).mean()


def features(X, k):
    c = X[k]
    F = pd.DataFrame(index=X.index)
    cpi_y = (X["cpi"] / X["cpi"].shift(12) - 1) * 100
    real = c / X["cpi"]
    F["Цена к средней за 10 лет"] = c / ma(c, 120)
    F["Цена к средней за 3 года"] = c / ma(c, 36)
    F["Изменение за год, %"] = (c / c.shift(12) - 1) * 100
    F["Изменение за 3 года, %"] = (c / c.shift(36) - 1) * 100
    F["Рост от минимума за 5 лет, раз"] = c / c.rolling(60, min_periods=36).min()
    F["До исторического максимума, %"] = (1 - c / c.cummax()) * 100
    F["Реальная цена (с поправкой на инфляцию) к средней за 20 лет"] = real / ma(real, 240)
    F["Лет с прошлого исторического максимума"] = (c.cummax() != c.cummax().shift()).astype(int).groupby((c.cummax() != c.cummax().shift()).cumsum()).cumcount() / 12
    F["Инфляция за год, %"] = cpi_y
    F["Инфляция: изменение за год, п.п."] = cpi_y - cpi_y.shift(12)
    F["Ставка ФРС, %"] = X["ff"]
    F["Ставка ФРС: изменение за год, п.п."] = X["ff"] - X["ff"].shift(12)
    F["Реальная ставка ФРС (ставка минус инфляция), %"] = X["ff"] - cpi_y
    F["Реальная ставка: изменение за год, п.п."] = (X["ff"] - cpi_y).diff(12)
    F["Отклонение реальной ставки от нейтральной r*, п.п."] = X["ff"] - cpi_y - X["rstar"]
    F["Доходность 10 лет, %"] = X["y10"]
    F["Реальная доходность 10 лет (минус инфляция), %"] = X["y10"] - cpi_y
    F["Кривая: 10 лет минус ставка ФРС, п.п."] = X["y10"] - X["ff"]
    F["Безработица, %"] = X["unemp"]
    F["Безработица: изменение за год, п.п."] = X["unemp"] - X["unemp"].shift(12)
    F["Безработица выше минимума за 3 года, п.п."] = X["unemp"] - X["unemp"].rolling(36, min_periods=24).min()
    F["Нефть к средней за 3 года"] = X["oil"] / ma(X["oil"], 36)
    F["Нефть: изменение за год, %"] = (X["oil"] / X["oil"].shift(12) - 1) * 100
    F["Доллар: изменение за год, %"] = (X["usd"] / X["usd"].shift(12) - 1) * 100
    F["Доллар к средней за 5 лет"] = X["usd"] / ma(X["usd"], 60)
    F["Акции: изменение за год, %"] = (X["spx"] / X["spx"].shift(12) - 1) * 100
    F["Акции: до максимума, %"] = (1 - X["spx"] / X["spx"].cummax()) * 100
    sr, br = X["spx"].pct_change(), -8 * X["y10"].diff() / 100 + X["y10"].shift() / 1200           # доход облигаций из изменения доходности
    F["Связь акций и облигаций (корреляция за 3 года)"] = sr.rolling(36, min_periods=24).corr(br)
    F["Связь металла с акциями (корреляция за 3 года)"] = c.pct_change().rolling(36, min_periods=24).corr(sr)
    F["Акции к золоту: соотношение к средней за 10 лет"] = (X["spx"] / X["gold"]) / ma(X["spx"] / X["gold"], 120)
    F["Золото к серебру: уровень"] = X["gold"] / X["silver"]
    F["Золото к нефти: соотношение к средней за 10 лет"] = (X["gold"] / X["oil"]) / ma(X["gold"] / X["oil"], 120)
    F["Медь к золоту: соотношение к средней за 3 года"] = (X["copper"] / X["gold"]) / ma(X["copper"] / X["gold"], 36)
    F["Металл к золоту: соотношение к средней за 3 года"] = (c / X["gold"]) / ma(c / X["gold"], 36)
    return F


def pivots(c, factor):
    """Крупные развороты задним числом по месячным ценам: (индекс, +1 вершина / −1 дно)."""
    out, lo, hi, ilo, ihi, mode = [], c[0], c[0], 0, 0, 0
    for i in range(1, len(c)):
        x = c[i]
        if mode >= 0 and x > hi:
            hi, ihi = x, i
        if mode <= 0 and x < lo:
            lo, ilo = x, i
        if mode >= 0 and x <= hi / factor:
            out.append((ihi, 1)); mode, lo, ilo = -1, x, i
        elif mode <= 0 and x >= lo * factor:
            out.append((ilo, -1)); mode, hi, ihi = 1, x, i
    return out


def main(out):
    X = monthly_table()
    print("данные:", X.index[0].date(), "—", X.index[-1].date(), "| начало рядов:", {k: str(X[k].first_valid_index().date())[:7] for k in ("ff", "y10", "cpi", "unemp", "rstar", "usd", "spx")})
    rows, eps = [], []
    for k, (_, name, factor, grp) in METALS.items():
        start = "1972-01-01" if k in ("gold", "silver") else "1965-01-01"
        F = features(X, k)
        c = X[k][X.index >= start].dropna()
        F = F.reindex(c.index)
        pv = pivots(c.values, factor)
        top = np.zeros(len(c), bool); bot = np.zeros(len(c), bool)
        prev = None
        for i, s in pv:
            seg = np.arange(max(0, i - 6), min(len(c), i + 7))
            if s > 0:
                top[seg[c.values[seg] >= c.values[i] / (1 + (factor - 1) * 0.25)]] = True
            else:
                bot[seg[c.values[seg] <= c.values[i] * (1 + (factor - 1) * 0.25)]] = True
            nxt = next((j for j, t in pv if j > i), None)
            eps.append({"metal": name, "grp": grp, "kind": "вершина" if s > 0 else "дно", "date": str(c.index[i].date())[:7], "price": float(c.values[i]),
                        "from_prev": (float(c.values[i] / c.values[prev]) if prev is not None else None), "months_prev": (i - prev if prev is not None else None),
                        "to_next": (float(c.values[nxt] / c.values[i]) if nxt is not None else None), "months_next": (nxt - i if nxt is not None else None),
                        **{f: (None if pd.isna(v) else float(v)) for f, v in F.iloc[i].items()}})
            prev = i
        F["top"], F["bot"], F["metal"], F["grp"] = top, bot, name, grp
        F["_f12"] = (c.shift(-12) / c - 1) * 100
        F["_f36"] = (c.shift(-36) / c - 1) * 100
        rows.append(F.iloc[: pv[-1][0] + 7] if pv else F.iloc[0:0])
        print(f"{name:9} {len(c)} мес. с {c.index[0].date():%Y-%m}; вершины: " + ", ".join(str(c.index[i].date())[:7] for i, s in pv if s > 0)
              + " | дно: " + ", ".join(str(c.index[i].date())[:7] for i, s in pv if s < 0))
    A = pd.concat(rows)
    feats = [f for f in A.columns if f not in ("top", "bot", "metal", "grp") and not f.startswith("_")]
    E = pd.DataFrame(eps)
    # процентиль признака в день разворота относительно всей истории этого признака (по всем металлам)
    pct = {f: A[f].rank(pct=True) for f in feats}
    for f in feats:
        E[f + "_p"] = [np.nan if pd.isna(v) else float((A[f].dropna() < v).mean() * 100) for v in E[f]]
    early = lambda d: d < "1999"                                                                       # noqa: E731
    print(f"\nвсего разворотов: вершин {sum(E.kind == 'вершина')}, дна {sum(E.kind == 'дно')}")
    res = {}
    for kind, lab in (("вершина", "top"), ("дно", "bot")):
        e = E[E.kind == kind]
        print(f"\n=== ОСОБЕННОСТИ: {kind.upper()} — где стоял признак в месяц разворота (процентиль за всю историю; 50 — обычный месяц) ===")
        print(f"{'признак':58} {'медиана':>8} {'до 1999':>8} {'с 1999':>7} {'драг':>6} {'пром':>6} | {'выше 70':>8} {'ниже 30':>8} | AUC зоны: до 1999 / с 1999")
        rr = []
        for f in feats:
            p = e[f + "_p"].dropna()
            if len(p) < 8:
                continue
            g = lambda m: e[m][f + "_p"].median()                                                   # noqa: E731
            parts = [g(e.date.map(early)), g(~e.date.map(early)), g(e.grp == "драг"), g(e.grp == "пром")]
            y = A[lab].values
            a1 = auc(A[f].values[A.index < "1999"], y[A.index < "1999"]); a2 = auc(A[f].values[A.index >= "1999"], y[A.index >= "1999"])
            same = all(x > 55 for x in parts) or all(x < 45 for x in parts)
            rr.append((abs(p.median() - 50), f, p.median(), parts, (p > 70).mean() * 100, (p < 30).mean() * 100, a1, a2, same))
        for d, f, med, parts, hi, lo, a1, a2, same in sorted(rr, key=lambda r: -r[0]):
            if not same:
                continue
            print(f"{f[:58]:58} {med:8.0f} " + " ".join(f"{x:7.0f}" for x in parts) + f" | {hi:7.0f}% {lo:7.0f}% | {a1:.2f} / {a2:.2f}")
        print("  не постоянны (меняются между периодами или группами): " + "; ".join(f"{f} ({med:.0f})" for d, f, med, parts, *_r, same in sorted(rr, key=lambda r: -r[0]) if not same)[:900])
        res[kind] = rr
    # золото и серебро — каждый разворот подробно
    cols = [("from_prev", "×от прошлого"), ("months_prev", "мес."), ("to_next", "×до след."), ("Инфляция за год, %", "инфл."), ("Инфляция: изменение за год, п.п.", "Δинфл."),
            ("Реальная ставка ФРС (ставка минус инфляция), %", "реал.ст."), ("Отклонение реальной ставки от нейтральной r*, п.п.", "−r*"), ("Ставка ФРС: изменение за год, п.п.", "Δставка"),
            ("Безработица: изменение за год, п.п.", "Δбезраб."), ("Нефть: изменение за год, %", "нефть,%"), ("Доллар: изменение за год, %", "доллар,%"), ("Акции: до максимума, %", "акции↓%"),
            ("Акции к золоту: соотношение к средней за 10 лет", "акц/зол"), ("Золото к серебру: уровень", "зол/сер"), ("Цена к средней за 10 лет", "к 10 г."), ("Реальная цена (с поправкой на инфляцию) к средней за 20 лет", "реал.ц.")]
    for metal in ("Золото", "Серебро", "Платина", "Медь"):
        e = E[E.metal == metal]
        print(f"\n=== {metal.upper()}: каждый крупный разворот ===\n{'дата':8} {'что':8} {'цена':>8} " + " ".join(f"{t:>9}" for _, t in cols))
        for _, r in e.iterrows():
            print(f"{r['date']:8} {r['kind']:8} {r['price']:8.0f} " + " ".join(f"{(r[c] if r[c] is not None and not pd.isna(r[c]) else float('nan')):9.1f}" for c, _ in cols))
    # маркеры, что сейчас
    last = {f: (None if pd.isna(v) else round(float(v), 2)) for f, v in features(X, "gold").iloc[-1].items()}
    print("\nЗОЛОТО СЕЙЧАС (" + str(X.index[-1].date())[:7] + "): " + "; ".join(f"{k} {v}" for k, v in last.items() if v is not None))
    json.dump({"episodes": E.to_dict("records")}, open(out, "w", encoding="utf-8"), ensure_ascii=False, default=str)
    A.to_pickle(out.replace(".json", ".pkl"))


if __name__ == "__main__":
    main(sys.argv[1])
