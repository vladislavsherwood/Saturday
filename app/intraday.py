"""Сигнал внутри сигнала: в день сделки выбирается момент по четырёхчасовым свечам.

Для каждого дня у монеты шесть свечей по 4 часа (UTC). Сравнивается цена, по которой удалось бы купить (или продать)
по внутридневному правилу, с ценой «в случайный момент дня» (средняя типичная цена шести свечей).
Плюс — купили дешевле (продали дороже), чем в случайный момент. Правила без подглядывания: решение принимается
по уже закрытым четырёхчасовым свечам, сделка — по закрытию свечи, где условие выполнилось; если за день не выполнилось —
по закрытию дня. Лимитные заявки исполняются по своей цене, если минимум (максимум) дня её достал.

Запуск: python3 app/intraday.py
"""
import json
import os
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data  # noqa: E402

COINS = ["BTC", "ETH", "SOL", "DOGE", "XRP", "BNB", "ADA", "LTC", "LINK", "AVAX", "TRX", "XLM", "DOT", "BCH",
         "ETC", "ATOM", "ALGO", "VET", "FIL", "NEAR", "AAVE", "SHIB", "PEPE", "BONK", "WIF", "FLOKI"]
EXAM = {"ETC", "ATOM", "ALGO", "VET", "FIL", "NEAR", "AAVE", "SHIB", "PEPE", "BONK", "WIF", "FLOKI"}


def bars(sym):
    def load():
        out, start = [], 0
        while True:
            d = data._get(f"https://data-api.binance.vision/api/v3/klines?symbol={sym}USDT&interval=4h&startTime={start}&limit=1000")
            out += [[k[0], float(k[1]), float(k[2]), float(k[3]), float(k[4])] for k in d]
            if len(d) < 1000:
                return out
            start = d[-1][0] + 1
    d = data._cached(f"bn4h_{sym}.json", 86400 * 3, load)
    df = pd.DataFrame(d, columns=["t", "o", "h", "l", "c"])
    df.index = pd.to_datetime(df["t"], unit="ms")
    return df


def rsi(c, n=14):
    d = np.diff(c, prepend=c[0])
    up = pd.Series(np.maximum(d, 0)).ewm(alpha=1 / n, adjust=False).mean().values
    dn = pd.Series(np.maximum(-d, 0)).ewm(alpha=1 / n, adjust=False).mean().values
    return 100 - 100 / (1 + up / np.maximum(dn, 1e-12))


def day_table(df):
    """Дни с полным набором из шести свечей: массивы [дней, 6]."""
    df = df.copy()
    df["rsi"] = rsi(df["c"].values)
    df["day"] = df.index.normalize()
    df["k"] = df.index.hour // 4
    full = df.groupby("day")["k"].count()
    df = df[df["day"].isin(full[full == 6].index)]
    days = df["day"].unique()
    A = {k: df[k].values.reshape(-1, 6) for k in ("o", "h", "l", "c", "rsi")}
    return pd.DatetimeIndex(days), A


def first_true(cond, close):
    """Цена закрытия первой свечи дня, где условие истинно; иначе закрытие дня. Последняя свеча и так закрытие дня."""
    idx = np.where(cond.any(axis=1), cond.argmax(axis=1), 5)
    return close[np.arange(len(close)), idx], cond[:, :5].any(axis=1)


def rules(A, side):
    """side = +1 покупка (ищем цену ниже), −1 продажа (ищем цену выше). Возвращает {название: (цена, доля дней, когда правило сработало)}."""
    o, h, l, c, r = A["o"], A["h"], A["l"], A["c"], A["rsi"]
    red = (c < o) if side > 0 else (c > o)                      # свеча «в нужную сторону»: красная для покупки, зелёная для продажи
    word = "красной" if side > 0 else "зелёной"
    out = {}
    for k in range(6):
        out[f"всегда в {4 * (k + 1):02d}:00 UTC"] = (c[:, k], np.ones(len(c), bool))
    out[f"после первой {word} 4ч-свечи"] = first_true(red, c)
    two = red.copy(); two[:, 0] = False; two[:, 1:] = red[:, 1:] & red[:, :-1]
    out[f"после двух {word[:-2]}ых подряд"] = first_true(two, c)
    three = two.copy(); three[:, :2] = False; three[:, 2:] = red[:, 2:] & red[:, 1:-1] & red[:, :-2]
    out[f"после трёх {word[:-2]}ых подряд"] = first_true(three, c)
    for v in ((30, 40) if side > 0 else (70, 60)):
        out[f"4ч RSI {'<' if side > 0 else '>'} {v}"] = first_true((r < v) if side > 0 else (r > v), c)
    day_open = o[:, :1]
    for x in (1, 2, 3, 5):
        out[f"4ч-свеча закрылась на {x}% {'ниже' if side > 0 else 'выше'} открытия дня"] = first_true((c <= day_open * (1 - x / 100)) if side > 0 else (c >= day_open * (1 + x / 100)), c)
    rev = np.zeros_like(red); rev[:, 1:] = ~red[:, 1:] & red[:, :-1]
    out["разворот: свеча против движения после свечи по движению"] = first_true(rev, c)
    lo, hi = l.min(axis=1), h.max(axis=1)
    for x in (1, 2, 3, 5):
        lim = day_open[:, 0] * (1 - side * x / 100)
        hit = (lo <= lim) if side > 0 else (hi >= lim)
        out[f"лимитная заявка на {x}% {'ниже' if side > 0 else 'выше'} открытия дня"] = (np.where(hit, lim, c[:, 5]), hit)
    out["ПОТОЛОК: точный минимум/максимум дня (недостижимо)"] = (lo if side > 0 else hi, np.ones(len(c), bool))
    return out


def main():
    fng = data.fear_greed()
    dom = data.dominances()
    usdt_r = dom["usdt"] / dom["usdt"].rolling(200, min_periods=200).mean()
    buy_sig = ((usdt_r > 1.07) & (dom["oth"] < 25))
    sell_sig = ((fng.reindex(dom.index, method="ffill") < 52) & (dom["usdt"] < 7.6)) & ~buy_sig
    rows = []
    for sym in COINS:
        try:
            days, A = day_table(bars(sym))
        except Exception as e:  # noqa: BLE001
            print(sym, "нет данных:", e)
            continue
        ref = ((A["o"] + A["h"] + A["l"] + A["c"]) / 4).mean(axis=1)          # цена «в случайный момент дня»
        prev = days - pd.Timedelta(days=1)                                      # сигнал известен по закрытию предыдущего дня
        half = np.arange(len(days)) >= len(days) // 2
        for side, sig, name in ((1, buy_sig, "buy"), (-1, sell_sig, "sell")):
            on = sig.reindex(prev).fillna(False).values.astype(bool)
            for rule, (px, fired) in rules(A, side).items():
                gain = (ref / px - 1) * 100 if side > 0 else (px / ref - 1) * 100
                for scope, m in (("all", np.ones(len(days), bool)), ("sig", on), ("sig1", on & ~half), ("sig2", on & half)):
                    if m.sum():
                        rows.append((sym, name, rule, scope, gain[m].mean(), np.median(gain[m]), fired[m].mean() * 100, int(m.sum()), (gain[m] > 0).mean() * 100))
        print(f"{sym}: дней {len(days)} с {days[0].date()}", flush=True)
    R = pd.DataFrame(rows, columns=["coin", "side", "rule", "scope", "mean", "med", "fired", "n", "win"])
    R.to_csv(sys.argv[1] if len(sys.argv) > 1 else "intraday.csv", index=False)
    for side, title in (("buy", "ПОКУПКА"), ("sell", "ПРОДАЖА")):
        print(f"\n=== {title}: выигрыш в цене против случайного момента дня, % (среднее по монетам) ===")
        print(f"{'правило':62} {'все дни':>8} {'дни сигнала':>12} {'1-я пол.':>9} {'2-я пол.':>9} {'экзамен':>8} {'монет в +':>10} {'срабат.':>8}")
        order = list(dict.fromkeys(R[R.side == side].rule))
        for rule in order:
            q = R[(R.side == side) & (R.rule == rule)]
            g = lambda scope, coins=None: q[(q.scope == scope) & (q.coin.isin(coins) if coins else True)]["mean"].mean()  # noqa: E731
            s = q[q.scope == "sig"]
            print(f"{rule:62} {g('all'):8.2f} {g('sig'):12.2f} {g('sig1'):9.2f} {g('sig2'):9.2f} {g('sig', EXAM):8.2f} {int((s['mean'] > 0).sum()):>6}/{len(s):<3} {s['fired'].mean():7.0f}%")
        s = R[(R.side == side) & (R.scope == "sig")].groupby("coin")["n"].first()
        print(f"дней сигнала на монету: медиана {int(s.median())}, всего {int(s.sum())}")


if __name__ == "__main__":
    main()
