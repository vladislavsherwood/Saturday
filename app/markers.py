"""Разработка «от обратного»: что объединяет хорошие точки входа и выхода.

1. На каждой монете задним числом размечаются крупные вершины и впадины: разворот считается крупным, если после него цена
   ушла минимум вдвое (−50% от вершины, +100% от впадины). Зона вершины — 30 дней до и после неё при цене не ниже 85% вершины;
   зона дна — так же, при цене не выше 118% дна.
2. На каждый день считается ~90 признаков без заглядывания в будущее: цена и скорость, волатильность, объём, форма свечей,
   время, сила к биткоину, состояние рынка, ширина рынка по всем монетам, данные вне графиков (стейблкоины, DeFi, сеть биткоина).
3. Для каждого признака — насколько он отличает зону вершины и зону дна от остальных дней (AUC: 0,5 — никак, 1 или 0 — идеально),
   отдельно на знакомых монетах и на 50 случайных, отдельно до и после 2022 года. Маркер засчитывается, только если работает везде.

Запуск: python3 app/markers.py <куда.json>
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
import build_builder as bb  # noqa: E402

KNOWN = bb.PAGES["crypto"][0] + bb.PAGES["valid"][0] + bb.PAGES["exam"][0] + ["shib", "pepe", "bonk", "wif", "floki", "fartcoin"]
HALVINGS = pd.to_datetime(["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-20"])


def load(cfg):
    if cfg.get("exchange"):
        return data.exchange_ohlc(*cfg["exchange"])
    if cfg.get("cmc"):
        return data.cmc_ohlc(cfg["cmc"], cfg.get("from_year", 2013))
    data.history(cfg["symbol"])
    return data.ohlc(cfg["symbol"])


def pivots(c, factor=2.0):
    """Крупные развороты задним числом: список (индекс, +1 вершина / −1 дно). Последний неподтверждённый экстремум отбрасывается."""
    out, lo, hi, ilo, ihi, mode = [], c[0], c[0], 0, 0, 0
    for i in range(1, len(c)):
        x = c[i]
        if mode >= 0 and x > hi:
            hi, ihi = x, i
        if mode <= 0 and x < lo:
            lo, ilo = x, i
        if mode >= 0 and x <= hi / factor:          # упали вдвое от вершины — вершина подтверждена
            if mode == 1 or ihi > 0:
                out.append((ihi, 1))
            mode, lo, ilo = -1, x, i
        elif mode <= 0 and x >= lo * factor:        # выросли вдвое от дна — дно подтверждено
            if mode == -1 or ilo > 0:
                out.append((ilo, -1))
            mode, hi, ihi = 1, x, i
    return out


def roll(s, n, f="mean"):
    return getattr(s.rolling(n, min_periods=max(5, n // 2)), f)()


def since_extreme(s, n, kind):
    """Сколько дней прошло с максимума (минимума) за окно n."""
    f = (lambda w: len(w) - 1 - np.argmax(w)) if kind == "max" else (lambda w: len(w) - 1 - np.argmin(w))
    return s.rolling(n, min_periods=30).apply(f, raw=True)


def coin_features(df, btc):
    o, h, l, c, v = (df[k] for k in "ohlcv")
    r = c.pct_change()
    lr = np.log(c).diff()
    F = pd.DataFrame(index=df.index)
    # цена и скорость
    F["Просадка от годового максимума, %"] = (1 - c / roll(c, 365, "max")) * 100
    F["До исторического максимума, %"] = (1 - c / c.cummax()) * 100
    F["Рост от годового минимума, раз"] = c / roll(c, 365, "min")
    F["Цена к средней за 200 дней"] = c / roll(c, 200)
    F["Цена к средней за 50 дней"] = c / roll(c, 50)
    F["Средняя 50 к средней 200"] = roll(c, 50) / roll(c, 200)
    for n in (7, 30, 90, 180):
        F[f"Изменение за {n} дней, %"] = (c / c.shift(n) - 1) * 100
    F["Ускорение: месяц против квартала"] = (c / c.shift(30) - 1) * 100 - (c / c.shift(90) - 1) * 100 / 3
    sd30 = roll(lr, 30, "std")
    F["Рост за месяц в единицах волатильности"] = (np.log(c) - np.log(c.shift(30))) / (sd30 * np.sqrt(30))
    F["Отклонение от средней 200 в сигмах"] = (np.log(c) - roll(np.log(c), 200)) / roll(np.log(c), 200, "std")
    F["RSI за 14 дней"] = 100 - 100 / (1 + r.clip(lower=0).ewm(alpha=1 / 14).mean() / (-r.clip(upper=0)).ewm(alpha=1 / 14).mean())
    wk = c.resample("W").last()
    wr = (wk.diff() > 0).astype(int)
    F["Зелёных недель подряд"] = wr.groupby((wr != wr.shift()).cumsum()).cumsum().where(wr == 1, 0).reindex(df.index, method="ffill")
    wd = (wk.diff() < 0).astype(int)
    F["Красных недель подряд"] = wd.groupby((wd != wd.shift()).cumsum()).cumsum().where(wd == 1, 0).reindex(df.index, method="ffill")
    F["Доля зелёных дней за месяц, %"] = roll((c > o).astype(float), 30) * 100
    # волатильность
    F["Волатильность за 30 дней, %"] = sd30 * 100
    F["Волатильность: 10 дней к 90"] = roll(lr, 10, "std") / roll(lr, 90, "std")
    F["Волатильность: 30 дней к году"] = sd30 / roll(lr, 365, "std")
    F["Размах дня, средний за 14 дней, %"] = roll((h / l - 1) * 100, 14)
    F["Размах дня к среднему за 90 дней"] = roll(h / l - 1, 7) / roll(h / l - 1, 90)
    F["Самый большой дневной обвал за месяц, %"] = roll(r, 30, "min") * 100
    F["Самый большой дневной взлёт за месяц, %"] = roll(r, 30, "max") * 100
    # объём
    if (v > 0).mean() > 0.9:
        dv = v.where(v > 0)
        F["Объём к среднему за 20 дней"] = dv / roll(dv, 20)
        F["Объём: месяц к году"] = roll(dv, 30) / roll(dv, 365)
        F["Объём: неделя к кварталу"] = roll(dv, 7) / roll(dv, 90)
        F["Пиковый всплеск объёма за 10 дней"] = roll(dv / roll(dv, 20), 10, "max")
        F["Доля объёма в зелёные дни за месяц, %"] = roll(dv.where(c > o, 0), 30, "sum") / roll(dv, 30, "sum") * 100
        F["Объём на 1% движения цены (к году)"] = (roll(dv, 14) / roll(r.abs(), 14)) / (roll(dv, 365) / roll(r.abs(), 365))
        F["Дней с последнего рекорда объёма за год"] = since_extreme(dv, 365, "max")
    # форма свечей
    rng = (h - l).replace(0, np.nan)
    F["Верхняя тень, доля свечи (10 дней)"] = roll((h - np.maximum(o, c)) / rng, 10)
    F["Нижняя тень, доля свечи (10 дней)"] = roll((np.minimum(o, c) - l) / rng, 10)
    F["Где закрытие внутри свечи (10 дней)"] = roll((c - l) / rng, 10)
    F["Тело свечи, доля (10 дней)"] = roll((c - o).abs() / rng, 10)
    red = (c < o).astype(int)
    F["Красных свечей подряд"] = red.groupby((red != red.shift()).cumsum()).cumsum().where(red == 1, 0)
    grn = (c > o).astype(int)
    F["Зелёных свечей подряд"] = grn.groupby((grn != grn.shift()).cumsum()).cumsum().where(grn == 1, 0)
    # время
    F["Дней с исторического максимума"] = (c.cummax() != c.cummax().shift()).astype(int).groupby((c.cummax() != c.cummax().shift()).cumsum()).cumcount()
    F["Дней с годового максимума"] = since_extreme(c, 365, "max")
    F["Дней с годового минимума"] = since_extreme(c, 365, "min")
    F["Возраст монеты, дней"] = np.arange(len(c))
    F["Новых максимумов за 90 дней (по 90-дневному окну)"] = roll((c >= roll(c, 90, "max")).astype(float), 90, "sum")
    F["Новых минимумов за 90 дней (по 90-дневному окну)"] = roll((c <= roll(c, 90, "min")).astype(float), 90, "sum")
    # сила к биткоину
    b = btc.reindex(df.index, method="ffill")
    pair = c / b
    F["Монета/BTC к своей средней за 200 дней"] = pair / roll(pair, 200)
    F["Монета/BTC: изменение за 30 дней, %"] = (pair / pair.shift(30) - 1) * 100
    F["Монета/BTC: изменение за 90 дней, %"] = (pair / pair.shift(90) - 1) * 100
    F["Монета/BTC: просадка от годового максимума, %"] = (1 - pair / roll(pair, 365, "max")) * 100
    br = b.pct_change()
    F["Связь с биткоином за 30 дней (корреляция)"] = r.rolling(30, min_periods=20).corr(br)
    F["Чувствительность к биткоину (бета, 60 дней)"] = r.rolling(60, min_periods=30).cov(br) / br.rolling(60, min_periods=30).var()
    return F


def market_features(btc, panel):
    idx = panel.index
    M = pd.DataFrame(index=idx)
    fng = data.fear_greed().reindex(idx, method="ffill")
    dom = data.dominances().reindex(idx, method="ffill")
    full = data.dominances()
    M["Страх и жадность"] = fng
    M["Страх и жадность, среднее за 30 дней"] = roll(fng, 30)
    M["Страх и жадность: изменение за 30 дней"] = fng - fng.shift(30)
    M["Дней сильного страха (<25) за 90 дней"] = roll((fng < 25).astype(float), 90, "sum")
    M["Дней сильной жадности (>75) за 90 дней"] = roll((fng > 75).astype(float), 90, "sum")
    M["USDT.D, %"] = dom["usdt"]
    M["USDT.D к своей средней за 200 дней"] = (full["usdt"] / full["usdt"].rolling(200).mean()).reindex(idx, method="ffill")
    M["USDT.D: изменение за 30 дней, %"] = (dom["usdt"] / dom["usdt"].shift(30) - 1) * 100
    M["BTC.D, %"] = dom["btc"]
    M["BTC.D: изменение за 90 дней, п.п."] = dom["btc"] - dom["btc"].shift(90)
    M["ETH.D, %"] = dom["eth"]
    M["Доля альткоинов, %"] = dom["oth"]
    M["Доля альткоинов: изменение за 90 дней, п.п."] = dom["oth"] - dom["oth"].shift(90)
    b = btc.reindex(idx, method="ffill")
    M["Биткоин к средней за 200 дней"] = b / roll(b, 200)
    M["Биткоин: до исторического максимума, %"] = (1 - b / b.cummax()) * 100
    M["Биткоин: изменение за 30 дней, %"] = (b / b.shift(30) - 1) * 100
    M["Биткоин: изменение за 90 дней, %"] = (b / b.shift(90) - 1) * 100
    M["Биткоин: волатильность за 30 дней, %"] = roll(np.log(b).diff(), 30, "std") * 100
    M["Биткоин: дней с исторического максимума"] = (b.cummax() != b.cummax().shift()).astype(int).groupby((b.cummax() != b.cummax().shift()).cumsum()).cumcount()
    h = pd.Series([(d - HALVINGS[HALVINGS <= d][-1]).days if (HALVINGS <= d).any() else np.nan for d in idx], index=idx)
    M["Дней после халвинга биткоина"] = h
    M["Месяц года"] = idx.month
    M["День недели"] = idx.dayofweek
    # ширина рынка: по всем монетам выборки, у которых в этот день есть история
    P = panel
    n = P.notna().sum(axis=1).where(lambda s: s >= 8)
    M["Ширина: доля монет выше средней 200, %"] = (P > P.rolling(200, min_periods=120).mean()).sum(axis=1) / P.rolling(200, min_periods=120).mean().notna().sum(axis=1).where(lambda s: s >= 8) * 100
    M["Ширина: доля монет выше средней 50, %"] = (P > P.rolling(50, min_periods=30).mean()).sum(axis=1) / P.rolling(50, min_periods=30).mean().notna().sum(axis=1).where(lambda s: s >= 8) * 100
    M["Ширина: доля монет на 90-дневном максимуме, %"] = (P >= P.rolling(90, min_periods=60).max()).sum(axis=1) / n * 100
    M["Ширина: доля монет на 90-дневном минимуме, %"] = (P <= P.rolling(90, min_periods=60).min()).sum(axis=1) / n * 100
    M["Ширина: монет на максимуме за 30 дней (среднее), %"] = roll(M["Ширина: доля монет на 90-дневном максимуме, %"], 30)
    M["Ширина: монет на минимуме за 30 дней (среднее), %"] = roll(M["Ширина: доля монет на 90-дневном минимуме, %"], 30)
    R30 = P / P.shift(30) - 1
    M["Ширина: медианное изменение монет за 30 дней, %"] = R30.median(axis=1) * 100
    M["Ширина: разброс изменений монет за 30 дней"] = (R30.quantile(0.75, axis=1) - R30.quantile(0.25, axis=1)) * 100
    M["Ширина: доля монет, выросших за 30 дней вдвое, %"] = (R30 > 1).sum(axis=1) / R30.notna().sum(axis=1).where(lambda s: s >= 8) * 100
    M["Ширина: доля монет, упавших за 30 дней на треть, %"] = (R30 < -0.33).sum(axis=1) / R30.notna().sum(axis=1).where(lambda s: s >= 8) * 100
    DD = 1 - P / P.rolling(365, min_periods=120).max()
    M["Ширина: медианная просадка монет от годового максимума, %"] = DD.median(axis=1) * 100
    D = P.pct_change()
    M["Ширина: доля растущих монет за день (среднее за 14 дней), %"] = roll((D > 0).sum(axis=1) / D.notna().sum(axis=1).where(lambda s: s >= 8) * 100, 14)
    mean_r = D.mean(axis=1)
    M["Синхронность рынка: все монеты ходят вместе (30 дней)"] = roll(mean_r, 30, "var") / roll((D ** 2).mean(axis=1), 30)
    # данные вне графиков
    try:
        M["MVRV биткоина"] = data.mvrv_history().reindex(idx, method="ffill")
    except Exception as e:  # noqa: BLE001
        print("mvrv:", e)
    try:
        d = data._cached("llama_stables.json", 86400, lambda: data._get("https://stablecoins.llama.fi/stablecoincharts/all", timeout=60))
        s = pd.Series({pd.to_datetime(int(x["date"]), unit="s").normalize(): float(x["totalCirculatingUSD"]["peggedUSD"]) for x in d if x.get("totalCirculatingUSD")}).reindex(idx, method="ffill")
        M["Стейблкоины: рост предложения за 30 дней, %"] = (s / s.shift(30) - 1) * 100
        M["Стейблкоины: рост предложения за 90 дней, %"] = (s / s.shift(90) - 1) * 100
        M["Стейблкоины: ускорение роста (30 дней против 90)"] = (s / s.shift(30) - 1) * 100 - (s / s.shift(90) - 1) * 100 / 3
    except Exception as e:  # noqa: BLE001
        print("стейблкоины:", e)
    try:
        d = data._cached("llama_tvl.json", 86400, lambda: data._get("https://api.llama.fi/v2/historicalChainTvl", timeout=60))
        t = pd.Series({pd.to_datetime(int(x["date"]), unit="s").normalize(): float(x["tvl"]) for x in d}).reindex(idx, method="ffill").where(lambda s: s > 1e8)
        M["DeFi: изменение заблокированных средств за 30 дней, %"] = (t / t.shift(30) - 1) * 100
        M["DeFi: просадка заблокированных средств от максимума, %"] = (1 - t / t.cummax()) * 100
    except Exception as e:  # noqa: BLE001
        print("defi:", e)
    for key, name in (("miners-revenue", "rev"), ("hash-rate", "hash"), ("n-unique-addresses", "addr"), ("n-transactions", "tx")):
        try:
            d = data._cached(f"bc_{key}.json", 86400, lambda key=key: data._get(f"https://api.blockchain.info/charts/{key}?timespan=all&format=json&sampled=false", timeout=90))
            s = pd.Series({pd.to_datetime(x["x"], unit="s").normalize(): float(x["y"]) for x in d["values"]})
            s = s[~s.index.duplicated()].sort_index()
            if name == "rev":
                M["Доход майнеров к среднему за год (Puell)"] = (s / s.rolling(365).mean()).reindex(idx, method="ffill")
            elif name == "hash":
                M["Хешрейт: средняя 30 к средней 60 (капитуляция майнеров)"] = (s.rolling(30).mean() / s.rolling(60).mean()).reindex(idx, method="ffill")
            elif name == "addr":
                M["Активные адреса биткоина: месяц к году"] = (s.rolling(30).mean() / s.rolling(365).mean()).reindex(idx, method="ffill")
            else:
                M["Транзакции биткоина: месяц к году"] = (s.rolling(30).mean() / s.rolling(365).mean()).reindex(idx, method="ffill")
        except Exception as e:  # noqa: BLE001
            print(key, e)
    return M


def auc(x, y):
    """Площадь под кривой: вероятность, что у случайного дня из зоны признак выше, чем у случайного дня вне зоны."""
    m = ~np.isnan(x)
    x, y = x[m], y[m]
    n1, n0 = y.sum(), (~y).sum()
    if n1 < 30 or n0 < 30:
        return np.nan
    rk = pd.Series(x).rank().values
    return (rk[y].sum() - n1 * (n1 + 1) / 2) / (n1 * n0)


def main(out):
    coins = [(k, bb.ASSETS[k], "знакомые") for k in KNOWN]
    for c in json.load(open(os.path.join(HERE, "found", "random50.json"), encoding="utf-8")):
        coins.append((c["ticker"].lower(), {"cmc": c["cid"], "from_year": c["year"], "ticker": c["ticker"]}, "случайные"))
    btc = load(bb.ASSETS["btc"])["c"]
    frames, panel = {}, {}
    for key, cfg, grp in coins:
        try:
            df = load(cfg)
        except Exception as e:  # noqa: BLE001
            print(key, "нет данных", e)
            continue
        df = df[~df.index.duplicated()]
        if len(df) < 400:
            continue
        frames[key] = (df, grp, cfg.get("ticker", key.upper()))
        panel[key] = df["c"]
    P = pd.DataFrame(panel).sort_index()
    P = P[P.index >= "2015-01-01"]
    M = market_features(btc, P)
    rows, piv_all = [], []
    for key, (df, grp, ticker) in frames.items():
        c = df["c"].values
        pv = pivots(c)
        F = coin_features(df, btc)
        top = np.zeros(len(c), bool); bot = np.zeros(len(c), bool); rel = np.full(len(c), np.nan); kind = np.zeros(len(c))
        for i, s in pv:
            a, b = max(0, i - 30), min(len(c), i + 31)
            seg = np.arange(a, b)
            if s > 0:
                top[seg[c[seg] >= 0.85 * c[i]]] = True
            else:
                bot[seg[c[seg] <= c[i] / 0.85]] = True
            a2, b2 = max(0, i - 90), min(len(c), i + 61)
            for j in range(a2, b2):                     # для «кино» вокруг разворота: день относительно разворота
                if np.isnan(rel[j]) or abs(j - i) < abs(rel[j]):
                    rel[j], kind[j] = j - i, s
            piv_all.append((ticker, grp, str(df.index[i].date()), s, float(c[i])))
        F = F.join(M, how="left")
        F["top"], F["bot"], F["rel"], F["kind"], F["grp"], F["coin"] = top, bot, rel, kind, grp, ticker
        cs = df["c"]
        F["_c"] = cs
        for n in (30, 90, 180):
            F[f"_f{n}"] = (cs.shift(-n) / cs - 1) * 100              # что стало с ценой дальше — только для оценки, в признаки не входит
        F["_fmax90"] = (cs[::-1].rolling(90, min_periods=30).max()[::-1].shift(-1) / cs - 1) * 100
        F["_fmin90"] = (cs[::-1].rolling(90, min_periods=30).min()[::-1].shift(-1) / cs - 1) * 100
        F["_hi90"] = ((cs >= cs.rolling(90, min_periods=60).max()).rolling(7).max() > 0)
        F["_lo90"] = ((cs <= cs.rolling(90, min_periods=60).min()).rolling(7).max() > 0)
        # последние дни после последнего подтверждённого разворота не размечаются: там ещё неизвестно, вершина это или нет
        last = pv[-1][0] if pv else 0
        F = F.iloc[60:last + 31] if pv else F.iloc[0:0]
        rows.append(F)
        print(f"{ticker:9} {grp:10} дней {len(df):5}, разворотов {len(pv):2} (вершин {sum(1 for _, s in pv if s > 0)}, впадин {sum(1 for _, s in pv if s < 0)})", flush=True)
    A = pd.concat(rows)
    A = A[A.index >= "2015-06-01"]
    feats = [k for k in A.columns if k not in ("top", "bot", "rel", "kind", "grp", "coin") and not k.startswith("_")]
    print(f"\nмонет {A.coin.nunique()}, дней {len(A)}, зона вершины {A.top.mean() * 100:.1f}% дней, зона дна {A.bot.mean() * 100:.1f}% дней; разворотов всего {len(piv_all)}")
    cells = {"знакомые до 2022": (A.grp == "знакомые") & (A.index < "2022-01-01"), "знакомые после": (A.grp == "знакомые") & (A.index >= "2022-01-01"),
             "случайные до 2022": (A.grp == "случайные") & (A.index < "2022-01-01"), "случайные после": (A.grp == "случайные") & (A.index >= "2022-01-01")}
    res = []
    for f in feats:
        x = A[f].values.astype(float)
        rec = {"f": f, "cover": float(np.isfinite(x).mean())}
        for lab in ("top", "bot"):
            y = A[lab].values
            rec[lab] = auc(x, y)
            rec[lab + "_cells"] = [auc(x[m.values], y[m.values]) for m in cells.values()]
            v = [a for a in rec[lab + "_cells"] if not np.isnan(a)]
            rec[lab + "_ok"] = len(v) >= 3 and (all(a > 0.5 for a in v) or all(a < 0.5 for a in v))
            rec[lab + "_min"] = min(abs(a - 0.5) for a in v) if v else 0
            # насколько чаще зона встречается в крайних 10% значений признака
            fin = np.isfinite(x)
            if fin.sum() > 1000:
                lo, hi = np.nanquantile(x, 0.1), np.nanquantile(x, 0.9)
                base = y[fin].mean()
                rec[lab + "_lift_hi"] = float(y[fin & (x >= hi)].mean() / base) if base else np.nan
                rec[lab + "_lift_lo"] = float(y[fin & (x <= lo)].mean() / base) if base else np.nan
                rec["q10"], rec["q90"] = float(lo), float(hi)
        res.append(rec)
    R = pd.DataFrame(res)
    for lab, title in (("top", "МАРКЕРЫ ВЕРШИН"), ("bot", "МАРКЕРЫ ДНА")):
        print(f"\n=== {title}: признаки, которые работают в одну сторону во всех четырёх срезах ===")
        print(f"{'признак':62} {'AUC':>5} {'знак.до':>8} {'знак.после':>10} {'случ.до':>8} {'случ.после':>10} {'в верхних 10%':>14} {'в нижних 10%':>13}")
        q = R[R[lab + "_ok"]].sort_values(lab + "_min", ascending=False).head(22)
        for _, r in q.iterrows():
            cs = r[lab + "_cells"]
            print(f"{r.f[:62]:62} {r[lab]:5.2f} " + " ".join(f"{(a if not np.isnan(a) else 0):>9.2f}" for a in cs) + f" {r.get(lab + '_lift_hi', np.nan):13.1f}× {r.get(lab + '_lift_lo', np.nan):12.1f}×")
        print("  обманчивые (сильные в целом, но меняют знак между срезами): " + "; ".join(f"{r.f} ({r[lab]:.2f})" for _, r in R[~R[lab + "_ok"]].assign(d=lambda d: (d[lab] - 0.5).abs()).sort_values("d", ascending=False).head(6).iterrows()))
    # «кино» вокруг разворота: средний процентиль признака за 90 дней до и 60 после
    print("\n=== КАК ВЕДУТ СЕБЯ ЛУЧШИЕ МАРКЕРЫ ВОКРУГ РАЗВОРОТА (средний процентиль признака, 50 — обычный день) ===")
    days = [-90, -60, -30, -14, -7, 0, 7, 14, 30, 60]
    movie = {}
    for lab, s, title in (("top", 1, "вершина"), ("bot", -1, "дно")):
        q = R[R[lab + "_ok"]].sort_values(lab + "_min", ascending=False).head(12)
        print(f"-- {title}: день относительно разворота →  " + " ".join(f"{d:>5}" for d in days))
        for _, r in q.iterrows():
            pct = A[r.f].rank(pct=True) * 100
            line = []
            for d in days:
                m = (A.kind == s) & (A.rel >= d - 3) & (A.rel <= d + 3)
                line.append(pct[m].mean())
            movie[lab + ":" + r.f] = [None if np.isnan(x) else round(float(x), 1) for x in line]
            print(f"   {r.f[:58]:58} " + " ".join(f"{x:5.0f}" for x in line))
    # совпадают ли развороты монет с разворотами биткоина
    bp = [pd.Timestamp(d) for t, g, d, s, p in piv_all if t == "BTC"]
    for s, title in ((1, "вершин"), (-1, "впадин")):
        ds = [pd.Timestamp(d) for t, g, d, k, p in piv_all if k == s and t != "BTC"]
        bs = [pd.Timestamp(d) for t, g, d, k, p in piv_all if k == s and t == "BTC"]
        near = sum(1 for d in ds if any(abs((d - b).days) <= 45 for b in bs))
        print(f"\nиз {len(ds)} {title} альткоинов в пределах 45 дней от такой же точки биткоина: {near} ({100 * near / max(1, len(ds)):.0f}%)")
    json.dump({"R": json.loads(R.to_json(orient="records")), "movie": movie, "days": days, "pivots": piv_all}, open(out, "w", encoding="utf-8"), ensure_ascii=False)
    A.to_pickle(out.replace(".json", ".pkl"))


if __name__ == "__main__":
    main(sys.argv[1])
