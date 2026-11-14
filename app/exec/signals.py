"""Сигналы стратегии для автоисполнения: те же индикаторы, что в исследовательском стенде (agent_margin.indicators + EXTRA из
agent4a_loop7 / agent4b_loop9 / agent4c_loop7), но без тяжёлых импортов стенда — только data.py и engine._liq().

Решение принимается по закрытию последнего завершённого дня UTC (decision_day) и исполняется в следующий день (exec_day).
Правила — found/combo-best.json (без плеча) или found/combo-best-margin.json → best_safe (с группами плеча и шортом BTC).
Ничего не отправляет на биржу."""
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd

APP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, APP)
import data      # noqa: E402
import engine    # noqa: E402

FOUND = os.path.join(APP, "found")

# монеты пользователя: символ Yahoo, вид для индикаторов
COINS = {"BTC": ("BTC-USD", "btc"), "ETH": ("ETH-USD", "alt"), "SOL": ("SOL-USD", "alt"), "HYPE": ("HYPE32196-USD", "alt"),
         "PUMP": ("PUMP36507-USD", "alt"), "DOGE": ("DOGE-USD", "alt"), "PEPE": ("PEPE24478-USD", "alt"), "ENA": ("ENA-USD", "alt"),
         "ZEC": ("ZEC-USD", "alt")}


def load_strategy(margin=False):
    """Правила и (для маржи) плечо по группам и шорт. Без маржи — combo-best.json, все группы с плечом 1."""
    if not margin:
        S = json.load(open(os.path.join(FOUND, "combo-best.json")))
        return {"name": S["name"], "rules": S["rules"], "base": S.get("base", 1), "lev": {}, "short": None, "groups": {}}
    M = json.load(open(os.path.join(FOUND, "combo-best-margin.json")))["best_safe"]
    rs = M["rules_with_sizes"]
    return {"name": M["name"], "rules": rs["rules"], "base": rs.get("base", 1), "lev": {int(k): float(v) for k, v in M["group_leverage"].items()},
            "short": M.get("short"), "groups": M.get("group_names", {})}


class Market:
    """Общие рыночные ряды: страх и жадность, доли рынка, BTC, деривативы Binance (OI, лонги/шорты, фандинг)."""

    def __init__(self):
        self.dom = data.dominances()
        self.fng = data.fear_greed()
        self.btc = data.history("BTC-USD")[0]
        self.btc = self.btc[~self.btc.index.duplicated()]
        self.lq = engine._liq()                                   # OI с заменой дней сбоя архива, фандинг
        lx = json.load(open(engine.LIQ))
        self.bls = pd.Series(lx["bls"], index=pd.to_datetime(lx["t"], unit="D"), dtype=float)
        self.oic_raw = pd.Series(lx["boic"], index=pd.to_datetime(lx["t"], unit="D"), dtype=float)
        self.oidd_cal = (self.lq["oic"] / self.lq["oic"].rolling(30, min_periods=1).max() - 1) * 100
        self.lsr_cal = self.bls / self.bls.rolling(90).mean()
        b = self.btc.values
        m, d, v = -1.0, 0, []
        for x in b:                                               # btcdays: дней с исторического максимума закрытия BTC
            if not (x < m):
                m, d = x, 0
            else:
                d += 1
            v.append(d)
        self.btcdays = pd.Series(v, index=self.btc.index, dtype=float)

    def last_dates(self):
        """Последний день, за который есть каждое значение, — для проверки свежести."""
        ld = lambda s: s.dropna().index[-1].date().isoformat()          # noqa: E731
        return {"btc_close": ld(self.btc), "fng": ld(self.fng), "dominance": ld(self.dom["usdt"]),
                "binance_oi": ld(self.oic_raw), "binance_long_short": ld(self.bls), "funding": ld(self.lq["fund"])}


def _since(m):
    m = np.asarray(m, bool)
    o = np.full(len(m), np.nan)
    s = np.nan
    for i, x in enumerate(m):
        s = 0.0 if x else s + 1
        o[i] = s
    return o


def _hi90(close):
    c = close.values
    n = len(c)
    top = np.zeros(n, bool)
    for j in range(60, n):
        top[j] = c[j] >= c[max(0, j - 89):j].max()
    o = np.array([1.0 if top[max(0, i - 6):i + 1].any() else 0.0 for i in range(n)])
    return pd.Series(o, index=close.index)


def indicators(close, kind, M):
    """Все индикаторы, на которые ссылаются правила combo-best и combo-best-margin, по дням монеты."""
    ix = close.index
    d = M.dom.reindex(ix, method="ffill")
    usdt_r = (M.dom["usdt"] / M.dom["usdt"].rolling(200, min_periods=200).mean()).reindex(ix, method="ffill")
    fng = M.fng.reindex(ix, method="ffill")
    btc = close if kind == "btc" else M.btc.reindex(ix, method="ffill")
    btcath = (1 - M.btc / M.btc.cummax()).reindex(ix, method="ffill") * 100
    oth90 = d["oth"] - d["oth"].shift(90)
    I = pd.DataFrame(index=ix)
    I["fng"], I["usdt"], I["othd"], I["usdtd"] = fng, usdt_r, d["oth"], d["usdt"]
    I["btcr30"] = (btc / btc.shift(30) - 1) * 100
    I["btcath"], I["oth90"] = btcath, oth90
    I["qt"] = ((btcath < 10) & (oth90 > 1.5)).astype(float)
    I["oidd30"] = M.oidd_cal.reindex(ix, method="ffill", limit=3)
    I["fund30"] = M.lq["fund"].rolling(30, min_periods=30).sum().reindex(ix, method="ffill", limit=3)
    on = (M.oidd_cal.rolling(20).min() < -28) & (M.oidd_cal > -28) & (M.lsr_cal > 1.0) & (M.lsr_cal.rolling(20).min() < 0.9)
    I["dly20_100f"] = (on & ~on.shift(1, fill_value=False)).reindex(ix).fillna(False).astype(float)
    I["rel180"] = ((close / close.shift(180)) / (btc / btc.shift(180)) - 1) * 100
    I["up90"] = (close / close.rolling(90, min_periods=1).min() - 1) * 100
    I["hi90"] = _hi90(close)
    I["ago_qt"] = _since(((I["qt"] > 0.5) | ((btcath < 15) & (oth90 > 1))).fillna(False).values)
    I["btcdays"] = M.btcdays.reindex(ix, method="ffill")
    return I


def _ok(v, c):
    return bool(pd.notna(v) and (v < c["v"] if c["op"] == "<" else v > c["v"]))


def first_rule(row, rules):
    """Номер первого сработавшего правила по значениям одного дня (dict/Series) или −1."""
    for r, R in enumerate(rules):
        if all(_ok(row.get(c["ind"]), c) for c in R["conds"]):
            return r
    return -1


def rule_series(I, rules):
    conds = []
    for R in rules:
        m = pd.Series(True, index=I.index)
        for c in R["conds"]:
            s = I[c["ind"]]
            m &= (s < c["v"]) if c["op"] == "<" else (s > c["v"])
        conds.append(m.fillna(False).values)
    return np.select(conds, list(range(len(rules))), default=-1)


def robustness(row, rules, stale):
    """Устойчиво ли решение к устаревшим индикаторам: перебираем их значения «условие выполнено / не выполнено» по каждому порогу.
    Возвращает множество возможных номеров правил (если больше одного — решение зависит от непришедших данных)."""
    if not stale:
        return {first_rule(row, rules)}
    probes = {k: {-1e18, 1e18} for k in stale}
    for R in rules:
        for c in R["conds"]:
            if c["ind"] in stale:
                probes[c["ind"]] |= {c["v"] - 1e-6, c["v"] + 1e-6}
    out = set()
    keys = list(stale)

    def rec(i, cur):
        if i == len(keys):
            out.add(first_rule(cur, rules))
            return
        for v in sorted(probes[keys[i]]):
            nxt = dict(cur)
            nxt[keys[i]] = v
            rec(i + 1, nxt)
    if len(keys) <= 4:
        rec(0, dict(row))
    return out


def short_state(I_btc, short):
    """Шорт BTC: открыт с дня входа (жадность > 75) до первого дня выхода (сигнал дна или разворота). Возвращает Series 0/1."""
    if not short:
        return pd.Series(0.0, index=I_btc.index)
    rows = I_btc.to_dict("records")
    st, out = 0, []
    for row in rows:
        ent = any(all(_ok(row.get(c["ind"]), c) for c in g) for g in short["entry"])
        ex = any(all(_ok(row.get(c["ind"]), c) for c in g) for g in short["exit"])
        if st and ex:
            st = 0
        elif not st and ent and not ex:
            st = 1
        out.append(st)
    return pd.Series(out, index=I_btc.index, dtype=float)


def utc_today():
    return pd.Timestamp(datetime.now(timezone.utc).date())
