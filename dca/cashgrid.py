"""Стратегии с резервом: продажи возвращают деньги в резерв, резерв потом реинвестируется.

Модель:
- каждый день в резерв приходит $10 (столько же, сколько тратит обычный DCA) — деньги на входе одинаковые;
- сигнал делит дни на 4 зоны (от «страха» к «жадности»);
- в каждой зоне одно действие: купить на X% резерва, ничего не делать или продать X% позиции;
- итог = позиция + резерв. Сравнение: итог стратегии / итог DCA - 1.

Перебираются все сочетания действий по зонам. Отбор по первой половине истории, экзамен на второй.
Набор монет — топ-40 на январь 2018 (включая умершие).

Запуск: python3 dca/cashgrid.py
"""
import itertools
import os

import numpy as np
import pandas as pd
from numba import njit, prange

import backtest as bt
import quant

START = "2018-03-01"
COINS = quant.UNIVERSE["Крипта: топ-2018"]
TOLW = 2.0            # %: в этих пределах итог считаем «наравне» с DCA
N_SHIFT = 1000

# действие: > 0 — купить на эту долю резерва, < 0 — продать эту долю позиции, 0 — ждать
ACTIONS = [-0.05, -0.02, -0.01, -0.005, -0.0025, -0.001, 0.0, 0.01, 0.02, 0.05, 0.10, 0.25, 0.50, 1.0]

# имя: (сигнал, пороги). Зоны идут от дешёвого/страха к дорогому/жадности.
SIGNALS = {
    "Fear&Greed 25/45/75": ("fng", (25, 45, 75)),
    "Fear&Greed 20/50/80": ("fng", (20, 50, 80)),
    "Fear&Greed 30/50/70": ("fng", (30, 50, 70)),
    "Цена/SMA200 0.8/1.0/1.4": ("sma", (0.8, 1.0, 1.4)),
    "Цена/SMA200 0.9/1.1/1.5": ("sma", (0.9, 1.1, 1.5)),
    "RSI14 30/50/70": ("rsi", (30, 50, 70)),
    "Монета/BTC к SMA200 0.8/1.0/1.4": ("alt_btc", (0.8, 1.0, 1.4)),
}


@njit(cache=True)
def sim(price, zone, act):
    """Итог (позиция + резерв) и средняя доля резерва в капитале."""
    cash = 0.0
    units = 0.0
    cash_share = 0.0
    n = len(price)
    for i in range(n):
        cash += bt.UNIT
        a = act[zone[i]]
        p = price[i]
        if a > 0:
            amt = a * cash
            units += amt / p
            cash -= amt
        elif a < 0:
            amt = -a * units * p
            units += -amt / p
            cash += amt
        cash_share += cash / (cash + units * p)
    return cash + units * price[n - 1], cash_share / n


@njit(parallel=True, cache=True)
def run_block(price, zone, acts, base):
    k = acts.shape[0]
    out = np.empty(k, dtype=np.float32)
    for j in prange(k):
        out[j] = (sim(price, zone, acts[j])[0] / base - 1) * 100
    return out


@njit(cache=True)
def shift_test(price, zone, act, base, offs):
    out = np.empty(len(offs))
    for k in range(len(offs)):
        out[k] = (sim(price, np.roll(zone, offs[k]), act)[0] / base - 1) * 100
    return out


def fmt(a):
    if a == 0:
        return "ждать"
    return (f"купить на {a * 100:g}% резерва" if a > 0 else f"продать {-a * 100:g}% позиции")


def describe(name, th, act):
    z = [f"<{th[0]}", f"{th[0]}–{th[1]}", f"{th[1]}–{th[2]}", f">{th[2]}"]
    return name.split(" ")[0] + ": " + "; ".join(f"{zz}: {fmt(a)}" for zz, a in zip(z, act))


def load():
    btc = bt.yahoo("BTC-USD")["close"]
    fng = bt.fear_greed().reindex(btc.index, method="ffill")
    data = {}
    for sym in COINS:
        close = bt.yahoo(sym)["close"]
        sig = pd.DataFrame({
            "sma": close / close.rolling(200, min_periods=bt.WARMUP).mean(),
            "rsi": bt.rsi(close),
            "alt_btc": (lambda r: r / r.rolling(200, min_periods=bt.WARMUP).mean())(close / btc.reindex(close.index)),
            "fng": fng.reindex(close.index),
        }).shift(1)                                   # сигнал по вчерашнему закрытию
        if sym == "BTC-USD":
            sig["alt_btc"] = np.nan
        close = close[close.index >= START]
        if len(close) >= 500:
            data[sym] = (close, sig.loc[close.index])
    return data


def zones(sig, key, th):
    x = sig[key].values
    z = np.searchsorted(np.array(th, dtype=float), x, side="right").astype(np.int8)
    z[np.isnan(x)] = 4                                # нет сигнала -> как DCA
    return z


def stats(E):
    return (E < -TOLW).sum(axis=0), (E > TOLW).sum(axis=0), np.median(E, axis=0)


def main():
    data = load()
    syms = list(data)
    combos = np.array(list(itertools.product(ACTIONS, repeat=4)))
    combos = combos[(combos > 0).any(axis=1)]                     # хотя бы одна покупка
    acts = np.concatenate([combos, np.ones((len(combos), 1))], axis=1)
    dca = np.ones(5)
    n = len(SIGNALS) * len(acts)
    print(f"монет: {len(syms)}, сигналов: {len(SIGNALS)}, наборов действий: {len(acts):,}, стратегий: {n:,}")

    W = np.empty((len(syms), 3, n), dtype=np.float32)             # монета; первая, вторая половина, весь период
    for ti, s in enumerate(syms):
        close, sig = data[s]
        price = close.values
        mid = len(price) // 2
        for si, (name, (key, th)) in enumerate(SIGNALS.items()):
            z = zones(sig, key, th)
            for h, sl in enumerate((slice(0, mid), slice(mid, len(price)), slice(0, len(price)))):
                base = sim(price[sl], np.zeros(len(price[sl]), dtype=np.int8), dca)[0]
                W[ti, h, si * len(acts):(si + 1) * len(acts)] = run_block(price[sl], z[sl], acts, base)

    np.save(os.path.join(bt.CACHE, "cashgrid_W.npy"), W)
    w1, b1, m1 = stats(W[:, 0, :])
    w2, b2, m2 = stats(W[:, 1, :])
    wf, bf, mf = stats(W[:, 2, :])
    need = (len(syms) + 1) // 2
    p1 = (w1 == 0) & (b1 >= need)
    p2 = (w2 == 0) & (b2 >= need)
    has_sell = np.tile((combos < 0).any(axis=1), len(SIGNALS))
    sig_of = np.repeat(list(SIGNALS), len(acts))

    print(f"\nкритерий: ни на одной монете итог не хуже DCA больше чем на {TOLW:g}%, и лучше минимум на {need} из {len(syms)}")
    print(f"прошли на 1-й половине: {p1.sum():,}; на 2-й: {p2.sum():,}; на обеих: {(p1 & p2).sum():,}")
    cand = np.where(w1 <= 2)[0]
    top = cand[np.argsort(-m1[cand])][:1000]
    print(f"топ-1000 по 1-й половине (не более 2 проигрышей): медиана +{np.median(m1[top]):.0f}% на 1-й -> "
          f"{np.median(m2[top]):+.0f}% на 2-й; проигрышей на 2-й в среднем {w2[top].mean():.1f} монет из {len(syms)}")

    # мягкий отбор: мало проигрышей в обеих половинах, сортировка по худшей из двух медиан
    def table(mask, k, title):
        idx = np.where(mask)[0]
        idx = idx[np.argsort(-np.minimum(m1, m2)[idx])][:k]
        rows = []
        for i in idx:
            name = sig_of[i]
            th = SIGNALS[name][1]
            rows.append({"стратегия": describe(name, th, combos[i % len(acts)]),
                         "1-я половина %": round(float(m1[i])), "2-я половина %": round(float(m2[i])),
                         "весь период %": round(float(mf[i])),
                         "хуже DCA, монет (1/2/весь)": f"{w1[i]}/{w2[i]}/{wf[i]}",
                         "BTC %": round(float(W[syms.index('BTC-USD'), 2, i])),
                         "ETH %": round(float(W[syms.index('ETH-USD'), 2, i])), "_i": i})
        t = pd.DataFrame(rows)
        print(f"\n{title}")
        if len(t):
            print(t.drop(columns="_i").to_string(index=False))
        return t

    pd.set_option("display.width", 320, "display.max_colwidth", 200)
    ok = (w1 <= 2) & (w2 <= 2)
    print(f"\nне более 2 проигравших монет в каждой половине: {ok.sum():,} стратегий, из них с продажами {(ok & has_sell).sum():,}")
    t_all = table(ok, 8, "лучшие устойчивые (любые):")
    t_sell = table(ok & has_sell, 8, "лучшие устойчивые с продажами:")
    t_buy = table(ok & ~has_sell, 5, "лучшие устойчивые без продаж:")
    pd.concat([t_all, t_sell, t_buy]).drop(columns="_i").to_csv(os.path.join(bt.OUT, "cashgrid_top.csv"), index=False)

    print("\nпо сигналам: сколько устойчивых и лучшая худшая-из-двух медиана")
    for name in SIGNALS:
        m = (sig_of == name) & ok
        best = np.minimum(m1, m2)[m].max() if m.any() else float("nan")
        print(f"  {name}: {m.sum():,} (с продажами {(m & has_sell).sum():,}), лучшая {best:+.0f}%")

    # тест на случайность для лучших
    fr = np.random.default_rng(5).uniform(0.1, 0.9, N_SHIFT)
    print("\nтест на случайность (сдвиг сигнала по времени), весь период:")
    for label, t in (("любая", t_all), ("с продажами", t_sell), ("без продаж", t_buy)):
        if not len(t):
            continue
        i = int(t["_i"].iloc[0])
        name = sig_of[i]
        key, th = SIGNALS[name]
        act = acts[i % len(acts)]
        P = []
        for s in syms:
            close, sig = data[s]
            price = close.values
            base = sim(price, np.zeros(len(price), dtype=np.int8), dca)[0]
            P.append(shift_test(price, zones(sig, key, th), act, base, (fr * len(price)).astype(np.int64)))
        pm = np.median(np.array(P), axis=0)
        p = (1 + (pm >= mf[i]).sum()) / (N_SHIFT + 1)
        print(f"  лучшая {label}: факт {mf[i]:+.0f}%, случайный сдвиг в среднем {pm.mean():+.0f}%, p = {p:.3f}")


if __name__ == "__main__":
    main()
