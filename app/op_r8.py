"""op, круг 8 — металлы: GVZ (подразумеваемая вол золота, CBOE, с 2008-06) как фильтр покупок/продаж золота и серебра.
Основа — mb1 (found/mb-best.json: Q2д + пауза докупок серии 90 дней после стресса BTC), протокол research/mb_journal.md
(2005–2026, половины A 2005–15 / B 2016–26, дневная модель, 4 металла отбора; dcheck2/dok2 из mb_lib без изменений).
H8a «подожди»: докупки серии откладываются, пока за последние W дней был всплеск GVZ (GVZ / SMA50 > X или GVZ > X) — вол ещё растёт, дно не пройдено.
H8b «ускорение»: в дни серии при всплеске GVZ доля резерва × 1,5 (капитуляция в металлах).
H8c продажи Q2: при всплеске GVZ не продавать (взнос); при низком GVZ (самоуспокоение, GVZ < X) продажа × 1,5.
Диагностика: форвардный рост золота/серебра 30/90 дн после режимов GVZ (избыток к среднему), по половинам A/B.
Запуск: python3 app/op_r8.py (лог scratchpad/op/r8.txt)"""
import json
import os
import sys

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import mb_lib as B  # noqa: E402
import metals_agent_lib as L  # noqa: E402
from mb_r8 import btc_wait  # noqa: E402

LOG = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/op/r8.txt"


class Tee:
    def __init__(self, f):
        self.f = open(f, "w")

    def write(self, s):
        sys.__stdout__.write(s)
        self.f.write(s)
        self.f.flush()

    def flush(self):
        pass


sys.stdout = Tee(LOG)
MK = json.load(open(os.path.join(HERE, "cache", "op_mkt.json")))


def ser(sym):
    s = MK[sym]
    return pd.Series(s["c"], index=pd.to_datetime(s["d"]))


GVZ = ser("^GVZ")
GVZR = GVZ / GVZ.rolling(50).mean()
D, DD, MM = B.load()
ref0 = lambda X: B.q2d(D, X)  # noqa: E731
_fw = btc_wait(DD, ref0, 0.25, 90)
mb1 = lambda X: _fw(X)[0]  # noqa: E731


def on(s, X):
    return B.M.on_days(s, X.t)


def wait_gvz(kind, x, W):
    def f(X):
        p = mb1(X).copy()
        v = on(GVZR if kind == "r" else GVZ, X)
        ev = np.nan_to_num(v) > x
        wait = L.since(ev) <= W
        s = p > 1.0
        g = np.where(s, p - 1.0, 0.0)
        out = np.zeros(len(p))
        cr = 1.0
        for i in range(len(p)):           # как btc_wait: отложенная доля копится и выдаётся в первый день без ожидания
            if not s[i]:
                cr = 1.0
                continue
            if wait[i]:
                cr *= (1 - g[i])
            else:
                out[i] = 1 - cr * (1 - g[i])
                cr = 1.0
        return B.reshape(p, out)
    return f


def accel(x, m):
    def f(X):
        p = mb1(X).copy()
        v = np.nan_to_num(on(GVZR, X)) > x
        s = (p > 1.0) & v
        q = p.copy()
        q[s] = 1.0 + np.clip((p[s] - 1.0) * m, 0, 0.999)
        return q
    return f


def sells(kind, x, mode):
    def f(X):
        p = mb1(X).copy()
        if kind == "hi":
            v = np.nan_to_num(on(GVZR, X)) > x
        else:
            v = on(GVZ, X)
            v = np.isfinite(v) & (np.nan_to_num(v, nan=99) < x)
        s = (p < 0) & v
        q = p.copy()
        q[s] = 1.0 if mode == 0 else np.maximum(-1.0, p[s] * mode)
        return q
    return f


def show(nm, fn):
    o = B.dcheck2(MM, fn, mb1)
    ok, why = B.dok2(o)
    nd = sum(int((np.asarray(fn(MM[k])) != np.asarray(mb1(MM[k]))).sum()) for k in B.DSEL)
    print(f"  {nm:<42} дней изм. {nd:5d} | {B.dfmt2(o)} → {'✓' if ok else '✗ ' + why}")
    return ok


print("Диагностика: избыток форвардного лог-роста металла (%, к среднему за дни с GVZ), A = 2008-06…2015, B = 2016…2026")
for k in ("gold", "silver"):
    X = MM[k]
    c = np.asarray(X.c, float)
    g = on(GVZ, X)
    gr = on(GVZR, X)
    t = pd.DatetimeIndex(X.t)
    for nm, m in (("GVZ/SMA50 > 1,3", gr > 1.3), ("GVZ/SMA50 > 1,5", gr > 1.5), ("GVZ > 25", g > 25), ("GVZ > 30", g > 30), ("GVZ < 14", g < 14), ("GVZ < 12", g < 12)):
        row = []
        for h in (30, 90):
            f = np.full(len(c), np.nan)
            f[:-h] = np.log(c[h:] / c[:-h])
            for part in (t < "2016-01-01", t >= "2016-01-01"):
                d = part & np.isfinite(g) & np.isfinite(f)
                e = d & np.nan_to_num(m).astype(bool)
                row.append((np.nanmean(f[e]) - np.nanmean(f[d])) * 100 if e.sum() >= 10 else np.nan)
        print(f"  {B.NAME[k]:<8} {nm:<16} 30д A/B {row[0]:+6.1f}/{row[1]:+6.1f}  90д A/B {row[2]:+6.1f}/{row[3]:+6.1f}")

print("\nH8a «подожди» после всплеска GVZ (поверх mb1)")
for kind, x in (("r", 1.3), ("r", 1.5), ("a", 25), ("a", 30)):
    for W in (30, 60, 90):
        show(f"{'GVZ/SMA50 >' if kind == 'r' else 'GVZ >'} {x}, окно {W}", wait_gvz(kind, x, W))
print("\nH8b ускорение докупок серии при всплеске GVZ ×1,5")
for x in (1.2, 1.3, 1.5):
    show(f"GVZ/SMA50 > {x} → ×1,5", accel(x, 1.5))
print("\nH8c продажи Q2: всплеск GVZ → не продавать; низкий GVZ → ×1,5")
for x in (1.2, 1.3, 1.5):
    show(f"GVZ/SMA50 > {x} → не продавать", sells("hi", x, 0))
for x in (12, 13, 14, 15):
    show(f"GVZ < {x} → продажа ×1,5", sells("lo", x, 1.5))
