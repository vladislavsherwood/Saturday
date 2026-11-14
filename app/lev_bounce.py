"""Плечо на сильных сигналах, долг гасится не по времени, а на сигналах отскока: продаём часть монеты и гасим долг по ней.
Отскок — по биткоину, по самой монете или по настроению рынка. Гашение — в первый день сигнала или каждый день, пока он горит.
Ограничитель — бюджет долга (новый долг только пока счёт переживёт ещё −X%). Схема как в lev_smart.py.
Запуск: python3 app/lev_bounce.py"""
import sys, os, json
import numpy as np, pandas as pd
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data
from lev_config import C, LO, P, G, starts, idx

RATE, ML, FEE, UNIT = 0.0003, 1.1, 0.001, 2.0
K = C.shape[1]
btc = data.history("BTC-USD")[0].reindex(idx, method="ffill")
fng = data.fear_greed().reindex(idx, method="ffill")
col = lambda s: np.repeat(np.asarray(s, float)[:, None], K, axis=1)            # noqa: E731
cf = pd.DataFrame(C, index=idx)
rsi = cf.apply(lambda s: (lambda d: 100 - 100 / (1 + d.clip(lower=0).ewm(alpha=1 / 14).mean() / (-d.clip(upper=0)).ewm(alpha=1 / 14).mean()))(s.diff()))
SIG = {
    "биткоин +15% за 30 дней": col(btc / btc.shift(30) > 1.15),
    "биткоин +25% от минимума за 90 дней": col(btc / btc.rolling(90, min_periods=30).min() > 1.25),
    "биткоин +40% от минимума за 90 дней": col(btc / btc.rolling(90, min_periods=30).min() > 1.40),
    "монета +30% от минимума за 30 дней": (cf / cf.rolling(30, min_periods=10).min() > 1.30).values,
    "монета +50% от минимума за 90 дней": (cf / cf.rolling(90, min_periods=30).min() > 1.50).values,
    "монета +30% за 30 дней": (cf / cf.shift(30) > 1.30).values,
    "монета выше средней 50 на 15%+": (cf / cf.rolling(50, min_periods=50).mean() > 1.15).values,
    "RSI монеты > 70": (rsi > 70).values,
    "страх и жадность > 60": col(fng > 60),
    "страх и жадность вырос на 25+ за 14 дней": col(fng - fng.shift(14) > 25),
}
SIG = {k: np.nan_to_num(v.astype(float), nan=0).astype(np.bool_) for k, v in SIG.items()}


@njit(cache=True)
def sim(C, LO, P, G, S, s0, lev, X, f, edge, H, stress):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9; reps = 0
    for t in range(s0, n):
        A = side; D = 0.0
        for k in range(K):
            A += r[k]
            if not np.isnan(C[t, k]):
                A += u[k] * C[t, k]
            D += debt[k]
        for k in range(K):
            p = C[t, k]
            if np.isnan(p):
                continue
            inv += UNIT; before = r[k]; r[k] += UNIT; debt[k] *= 1 + RATE
            if H > 0 and debt[k] > 0:
                pay = debt[k] / H; q = min(u[k], pay / (p * (1 - FEE))); u[k] -= q; debt[k] -= q * p * (1 - FEE)
            if f > 0 and debt[k] > 0 and t > s0 and S[t - 1, k] and (not edge or not S[t - 2, k]):   # отскок: гасим долю долга продажей монеты
                pay = f * debt[k]; q = min(u[k], pay / (p * (1 - FEE))); u[k] -= q; debt[k] -= q * p * (1 - FEE); reps += 1
            a = 1.0; g = 0
            if t > s0 and not np.isnan(P[t - 1, k]):
                a = P[t - 1, k]; g = G[t - 1, k]
            if a < 0:
                ff = -a
                r[k] += ff * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - ff; debt[k] *= 1 - ff
            else:
                v = min(r[k], UNIT + (a - 1) * before)
                if v > 0:
                    b = (lev[g] - 1) * v
                    if b > 0 and X > 0:
                        room = (A * (1 - X) / ML - D) / (1 - (1 - X) / ML)
                        b = max(0.0, min(b, room))
                    r[k] -= v; u[k] += (v + b) * (1 - FEE) / p; debt[k] += b; D += b; A += b
        assets = side; D = 0.0
        for k in range(K):
            assets += r[k]
            if not np.isnan(C[t, k]):
                assets += u[k] * LO[t, k] * stress
            D += debt[k]
        if D > 0:
            lv = assets / D
            if lv < worst:
                worst = lv
            if lv <= ML:
                nl += 1; left = assets - D
                for k in range(K):
                    r[k] = 0.0; u[k] = 0.0; debt[k] = 0.0
                side = max(0.0, left)
    fin = side
    for k in range(K):
        fin += r[k] - debt[k] + (u[k] * C[n - 1, k] if not np.isnan(C[n - 1, k]) else 0.0)
    return nl, fin / inv - 1, worst, reps


NOS = np.zeros_like(C, dtype=np.bool_)


def ev(lev, X, S=NOS, f=0.0, edge=False, H=0):
    lev = np.array(lev, float)
    R = [sim(C, LO, P, G, S, int(s), lev, X, f, edge, H, 1.0) for s in starts]
    x = np.array([q[1] for q in R]) * 100
    o = {"liq": sum(q[0] > 0 for q in R), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)), "reps": float(np.mean([q[3] for q in R]))}
    for st, key in ((0.8, "l20"), (0.7, "l30")):
        o[key] = sum(sim(C, LO, P, G, S, int(s), lev, X, f, edge, H, st)[0] > 0 for s in starts)
    return o


if __name__ == "__main__":
    line = lambda o, t: f"  {o['med']:+5.0f}% | худшие 10% {o['p10']:+4.0f}% | ликв. {o['liq']}/105, при −20% {o['l20']}, при −30% {o['l30']} | мин. маржа {o['lvl']:.2f} | погашений {o['reps']:.0f} | {t}"   # noqa: E731
    print("без плеча:", line(ev([1, 1, 1, 1], 0), ""))
    LEVS = (([1, 2, 1.5, 2], "дно ×2, разворот ×2, паника ×1,5"), ([1, 2.5, 1.5, 2.5], "дно ×2,5, разворот ×2,5, паника ×1,5"), ([1, 3, 1.5, 3], "дно ×3, разворот ×3, паника ×1,5"))
    if len(sys.argv) > 1:
        LEVS = [LEVS[int(i)] for i in sys.argv[1].split(",")]
    for lev, lt in LEVS:
        print(f"\n===== {lt} =====")
        for X in (0.0, 0.4, 0.6):
            xt = f"бюджет −{X * 100:.0f}%" if X else "без бюджета"
            print(f"--- {xt} ---")
            print(line(ev(lev, X), "без погашения"))
            print(line(ev(lev, X, H=180), "постепенно за 180 дней (для сравнения)"))
            rows = []
            for name, S in SIG.items():
                for f in (0.1, 0.25, 0.5):
                    for edge in (True, False):
                        o = ev(lev, X, S, f, edge); rows.append((o, f"{name}: гасим {f * 100:.0f}% долга {'в первый день' if edge else 'каждый день, пока горит'}"))
            ok = [r for r in rows if r[0]["liq"] == 0 and r[0]["l20"] == 0]
            for o, t in sorted(ok, key=lambda r: (-(r[0]["l30"] == 0), -r[0]["med"]))[:6]:
                print(line(o, t))
