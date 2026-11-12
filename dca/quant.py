"""Проверка «по-квантовски»: мало гипотез, широкий набор активов без выбора задним числом,
тест на случайность, скользящие окна и риск.

Гипотезы заданы заранее (3 из исходного каталога) + 1 найденная перебором, она проверяется
на активах, которых перебор не видел.

Запуск: python3 dca/quant.py
"""
import os

import numpy as np
import pandas as pd
from numba import njit

import backtest as bt
import grid

TOL = bt.TOL
N_SHIFT = 1000
RNG = np.random.default_rng(7)

# Наборы активов. ETF выбраны как категории, а не как победители.
# Крипта — монеты из топ-40 по капитализации на январь 2018, включая те, что потом умерли.
UNIVERSE = {
    "Акции: ETF": ["SPY", "QQQ", "IWM", "DIA", "XLK", "XLF", "XLE", "XLV", "XLY", "XLP", "XLI", "XLU", "XLB",
                   "EFA", "EEM", "EWJ", "EWG", "EWU", "FXI", "EWZ", "INDA", "VNQ"],
    "Израиль": ["^TA125.TA", "^TA35.TA", "EIS"],
    "Металлы, сырьё, облигации": ["GLD", "SLV", "USO", "DBC", "TLT", "CPER", "PPLT"],
    "Крипта: топ-2018": ["BTC-USD", "XRP-USD", "ETH-USD", "BCH-USD", "ADA-USD", "XEM-USD", "LTC-USD", "XLM-USD",
                         "IOTA-USD", "TRX-USD", "DASH-USD", "NEO-USD", "XMR-USD", "EOS-USD", "QTUM-USD", "BTG-USD",
                         "ICX-USD", "ETC-USD", "LSK-USD", "XNO-USD", "XVG-USD", "OMG-USD", "SC-USD", "BCN-USD",
                         "ZEC-USD", "PPT-USD", "BNB-USD", "STRAX-USD", "ARDR-USD", "BTS-USD", "KCS-USD", "DOGE-USD",
                         "VET-USD", "WAVES-USD", "STEEM-USD", "SNT-USD", "REP-USD", "DGB-USD"],
}
CRYPTO_START = "2018-01-01"

INF = 1e9
# имя: (индикатор, пороги, действия по зонам)
HYPOTHESES = {
    "SMA200 (исходная)": ("sma", (0.8, 1.0, 1.4), (3, 2, 1, 0)),
    "RSI14 (исходная)": ("rsi", (30, 40, 70), (3, 2, 1, 0)),
    "Просадка (исходная)": ("dd", (0.10, 0.20, INF), (1, 2, 3, 3)),
    "SMA200 (из перебора)": ("sma", (0.8, 0.95, 1.2), (1, 3, 1, 0)),
}


@njit(cache=True)
def edge_of(price, zone, act, years, base_irr):
    cf = np.empty((len(price) - 1) // grid.BUCKET + 2)
    irr, profit, invested, _ = grid._sim(price, zone, act, years, cf)
    return irr - base_irr, profit, invested


@njit(cache=True)
def shifts(price, zone, act, years, base_irr, offs):
    """Тест на случайность: тот же набор сигналов, сдвинутый по времени."""
    out = np.empty(len(offs))
    for k in range(len(offs)):
        z = np.roll(zone, offs[k])
        out[k] = edge_of(price, z, act, years, base_irr)[0]
    return out


@njit(cache=True)
def risk(price, zone, act):
    """Худший «бумажный убыток» позиции и максимум трат за 30 дней."""
    n = len(price)
    units = cost = 0.0
    worst = 0.0
    spend = np.zeros(n)
    for i in range(n):
        a = act[zone[i]]
        if a > 0:
            units += a * bt.UNIT / price[i]
            cost += a * bt.UNIT
            spend[i] = a * bt.UNIT
        if i >= 60 and cost > 0:
            r = units * price[i] / cost - 1
            if r < worst:
                worst = r
    mx = 0.0
    s = 0.0
    for i in range(n):
        s += spend[i]
        if i >= 30:
            s -= spend[i - 30]
        if s > mx:
            mx = s
    return worst * 100, mx


def prepare(sym, start):
    data = bt.yahoo(sym)
    close = data["close"]
    ind = pd.DataFrame({
        "sma": close / close.rolling(200, min_periods=bt.WARMUP).mean(),
        "rsi": bt.rsi(close),
        "dd": 1 - close / close.rolling(252, min_periods=1).max(),
    }).shift(1)                                    # сигнал по вчерашнему закрытию
    first = max(pd.Timestamp(start), close.index[min(bt.WARMUP, len(close) - 1)])
    close = close[close.index >= first]
    return close, ind.loc[close.index]


def zones(ind, key, th):
    x = ind[key].values
    z = np.searchsorted(np.array(th, dtype=float), x, side="right").astype(np.int8)
    z[np.isnan(x)] = 4
    return z


def main():
    dca = np.ones(5, dtype=np.int8)
    rows, perm, skipped = [], {}, []
    for group, syms in UNIVERSE.items():
        start = CRYPTO_START if group.startswith("Крипта") else bt.START
        for sym in syms:
            try:
                close, ind = prepare(sym, start)
            except Exception:  # noqa: BLE001
                skipped.append(sym)
                continue
            if len(close) < 500:
                skipped.append(sym)
                continue
            price = close.values
            years = (close.index[-1] - close.index[0]).days / 365.25
            z0 = np.zeros(len(price), dtype=np.int8)
            b_edge, b_profit, b_inv = edge_of(price, z0, dca, years, 0.0)      # b_edge = доходность DCA
            b_worst, b_spend = risk(price, z0, dca)
            offs = RNG.integers(int(len(price) * 0.1), int(len(price) * 0.9), N_SHIFT)
            # скользящие окна по 3 года с шагом 1 год
            wins = []
            t = close.index[0]
            while t + pd.DateOffset(years=3) <= close.index[-1]:
                m = (close.index >= t) & (close.index < t + pd.DateOffset(years=3))
                wins.append(np.where(m)[0])
                t += pd.DateOffset(years=1)
            for hname, (key, th, act) in HYPOTHESES.items():
                a = np.array(list(act) + [1], dtype=np.int8)
                z = zones(ind, key, th)
                e, profit, inv = edge_of(price, z, a, years, b_edge)
                worst, spend = risk(price, z, a)
                perm[(group, sym, hname)] = shifts(price, z, a, years, b_edge, offs)
                wedges = []
                for w in wins:
                    wy = (close.index[w[-1]] - close.index[w[0]]).days / 365.25
                    wb = edge_of(price[w], z0[w], dca, wy, 0.0)[0]
                    wedges.append(edge_of(price[w], z[w], a, wy, wb)[0])
                rows.append({
                    "group": group, "ticker": sym, "hypothesis": hname, "years": round(years, 1),
                    "dca_irr": round(b_edge, 1), "edge": e,
                    "p_ticker": (1 + (perm[(group, sym, hname)] >= e).sum()) / (N_SHIFT + 1),
                    "money": inv / b_inv,
                    # прибыль против DCA, вложившего ту же сумму равномерно
                    "profit_vs_equal_money": (profit / inv - b_profit / b_inv) * 100,
                    "worst_loss": worst, "dca_worst_loss": b_worst,
                    "max_30d_spend": spend,
                    "win_n": len(wedges),
                    "win_not_worse": int(sum(x >= -TOL for x in wedges)),
                    "win_better": int(sum(x > TOL for x in wedges)),
                })
    df = pd.DataFrame(rows)
    os.makedirs(bt.OUT, exist_ok=True)
    df.to_csv(os.path.join(bt.OUT, "quant_tickers.csv"), index=False)
    if skipped:
        print("нет данных или мало истории:", ", ".join(skipped))

    out = []
    for (group, hname), g in df.groupby(["group", "hypothesis"], sort=False):
        P = np.array([perm[(group, s, hname)] for s in g.ticker])           # тикеры x сдвиги
        actual = g.edge.median()
        p = (1 + (np.median(P, axis=0) >= actual).sum()) / (N_SHIFT + 1)
        out.append({
            "группа": group, "гипотеза": hname, "тикеров": len(g),
            "медиана_пп": round(actual, 2),
            "лучше": int((g.edge > TOL).sum()), "хуже": int((g.edge < -TOL).sum()),
            "p_случайность": round(p, 3),
            "окна_не_хуже_%": round(g.win_not_worse.sum() / max(g.win_n.sum(), 1) * 100),
            "окна_лучше_%": round(g.win_better.sum() / max(g.win_n.sum(), 1) * 100),
            "деньги_к_DCA": round(g.money.median(), 2),
            "убыток_хуже_DCA_пп": round((g.worst_loss - g.dca_worst_loss).median(), 1),
            "макс_трата_30д": round(g.max_30d_spend.median()),
        })
    summ = pd.DataFrame(out)
    summ.to_csv(os.path.join(bt.OUT, "quant_summary.csv"), index=False)
    pd.set_option("display.width", 250, "display.max_rows", 100)
    print(summ.to_string(index=False))
    print("\nкрипта, по монетам (SMA200 исходная):")
    c = df[(df.group == "Крипта: топ-2018") & (df.hypothesis == "SMA200 (исходная)")]
    print(c[["ticker", "years", "dca_irr", "edge", "p_ticker", "money", "worst_loss", "dca_worst_loss"]].round(2).to_string(index=False))


if __name__ == "__main__":
    main()
