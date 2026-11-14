"""Умное плечо для основной стратегии: обычный взнос без плеча, плечо только на сильных сигналах, плюс ограничители:
- бюджет долга: новый долг берётся, только пока счёт переживёт ещё падение всех монет на X% (активы·(1−X)/долг ≥ 1,1);
- срок плеча: каждый день гасится 1/H долга продажей монет (плечо «рассасывается» за ~H дней);
- пауза: после покупки с плечом по монете N дней без нового плеча по ней;
- сброс плеча: если уровень маржи по закрытию ниже DL, продаём позицию и гасим долг до уровня 2.
9 монет по $2, спотовая кросс-маржа (ликвидация при активы/долг ≤ 1,1 по минимуму дня), заём ~11% годовых, 105 дат старта с 2018.
Запуск: python3 app/lev_smart.py"""
import sys, os, itertools, json
import numpy as np
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lev_config import C, LO, P, G, starts, idx

RATE, ML, FEE, UNIT = 0.0003, 1.1, 0.001, 2.0


@njit(cache=True)
def sim(C, LO, P, G, s0, lev, X, H, cool, DL, stress):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K); last = np.full(K, -10 ** 9)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9; dl_n = 0; lev_days = 0
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
            if H > 0 and debt[k] > 0:                                         # плечо рассасывается: гасим 1/H долга продажей монет
                pay = debt[k] / H; q = min(u[k], pay / (p * (1 - FEE))); u[k] -= q; debt[k] -= q * p * (1 - FEE)
            a = 1.0; g = 0
            if t > s0 and not np.isnan(P[t - 1, k]):
                a = P[t - 1, k]; g = G[t - 1, k]
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - f; debt[k] *= 1 - f
            else:
                v = min(r[k], UNIT + (a - 1) * before)
                if v > 0:
                    L = lev[g]
                    if L > 1 and t - last[k] < cool:
                        L = 1.0
                    b = (L - 1) * v
                    if b > 0 and X > 0:                                       # бюджет: после покупки счёт должен пережить ещё −X%
                        room = (A * (1 - X) / ML - D) / (1 - (1 - X) / ML) if (1 - X) / ML < 1 else 1e18
                        b = max(0.0, min(b, room))
                    if b > 0:
                        last[k] = t
                    r[k] -= v; u[k] += (v + b) * (1 - FEE) / p; debt[k] += b; D += b; A += b
        assets = side; D = 0.0; ac = side
        for k in range(K):
            assets += r[k]; ac += r[k]
            if not np.isnan(C[t, k]):
                assets += u[k] * LO[t, k] * stress; ac += u[k] * C[t, k]
            D += debt[k]
        if D > 0:
            lev_days += 1
            lv = assets / D
            if lv < worst:
                worst = lv
            if lv <= ML:
                nl += 1; left = assets - D
                for k in range(K):
                    r[k] = 0.0; u[k] = 0.0; debt[k] = 0.0
                side = max(0.0, left)
            elif DL > 0 and ac / D < DL:                                      # сброс плеча по закрытию: гасим долг до уровня 2
                dl_n += 1
                need = D - ac / 2.0                                           # сколько долга погасить, чтобы ac'/D' = 2 (ac'=ac−x, D'=D−x)
                need = min(D, max(0.0, (2 * D - ac) / (2 - 1)))
                for k in range(K):
                    if debt[k] <= 0 or np.isnan(C[t, k]):
                        continue
                    x = need * debt[k] / D
                    q = min(u[k], x / (C[t, k] * (1 - FEE))); u[k] -= q; debt[k] -= q * C[t, k] * (1 - FEE)
    fin = side
    for k in range(K):
        fin += r[k] - debt[k] + (u[k] * C[n - 1, k] if not np.isnan(C[n - 1, k]) else 0.0)
    return nl, fin / inv - 1, worst, dl_n, lev_days


def ev(lev, X, H, cool, DL):
    lev = np.array(lev, float)
    R = [sim(C, LO, P, G, int(s), lev, X, H, cool, DL, 1.0) for s in starts]
    f = np.array([x[1] for x in R]) * 100
    out = {"liq": sum(x[0] > 0 for x in R), "med": float(np.median(f)), "p10": float(np.percentile(f, 10)), "worst": float(f.min()), "lvl": float(min(x[2] for x in R)),
           "dl": float(np.mean([x[3] for x in R])), "levdays": float(np.mean([x[4] for x in R]))}
    if out["liq"] == 0:
        for st, key in ((0.8, "liq20"), (0.7, "liq30")):
            out[key] = sum(sim(C, LO, P, G, int(s), lev, X, H, cool, DL, st)[0] > 0 for s in starts)
    return out


if __name__ == "__main__":
    base = ev([1, 1, 1, 1], 0, 0, 0, 0)
    ref = ev([1, 2, 1, 2], 0, 0, 0, 0)
    print(f"без плеча: {base['med']:+.0f}% (худшие 10% {base['p10']:+.0f}%) | прошлый лучший простой (дно+разворот ×2): {ref['med']:+.0f}%, ликв. {ref['liq']}, при −20%: {ref.get('liq20')}")
    res = []
    for lb, lr, lp in ((2, 2, 1), (3, 2, 1), (3, 3, 1), (2, 3, 1), (3, 3, 1.5), (2, 2, 1.5), (4, 4, 1), (3, 1, 1), (1, 3, 1)):
        for X in (0.0, 0.4, 0.5, 0.6, 0.7):
            for H in (0, 60, 180):
                for cool in (0, 14):
                    for DL in (0.0, 1.3, 1.5):
                        e = ev([1, lb, lp, lr], X, H, cool, DL)
                        e.update(lev=[1, lb, lp, lr], X=X, H=H, cool=cool, DL=DL); res.append(e)
    json.dump(res, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/lev_smart.json", "w"))
    safe = [e for e in res if e["liq"] == 0 and e.get("liq20") == 0]
    safe30 = [e for e in safe if e.get("liq30") == 0]
    name = lambda e: (f"дно ×{e['lev'][1]:g}, разворот ×{e['lev'][3]:g}" + (f", паника ×{e['lev'][2]:g}" if e['lev'][2] > 1 else "") + (f"; бюджет: пережить ещё −{e['X'] * 100:.0f}%" if e['X'] else "")   # noqa: E731
                      + (f"; плечо гасится за ~{e['H']} дн" if e['H'] else "") + (f"; пауза {e['cool']} дн" if e['cool'] else "") + (f"; сброс плеча при марже < {e['DL']}" if e['DL'] else ""))
    line = lambda e: f"  {e['med']:+5.0f}% (худшие 10% {e['p10']:+.0f}%, худший {e['worst']:+.0f}%) | мин. маржа {e['lvl']:.2f} | сбросов {e['dl']:.1f} | дней с долгом {e['levdays']:.0f} | {name(e)}"  # noqa: E731
    print(f"\nсхем {len(res)}; без ликвидаций и при минимумах −20%: {len(safe)}; и даже при −30%: {len(safe30)}")
    print("\n--- лучшие безопасные (−20%) ---"); [print(line(e)) for e in sorted(safe, key=lambda e: -e["med"])[:12]]
    print("\n--- лучшие сверхбезопасные (−30%) ---"); [print(line(e)) for e in sorted(safe30, key=lambda e: -e["med"])[:12]]
    print("\n--- что даёт каждый ограничитель (лучший безопасный итог при −20%) ---")
    for key, vals in (("X", (0.0, 0.4, 0.5, 0.6, 0.7)), ("H", (0, 60, 180)), ("cool", (0, 14)), ("DL", (0.0, 1.3, 1.5))):
        print(f"  {key}: " + ", ".join(f"{v} → {max([e['med'] for e in safe if e[key] == v], default=float('nan')):+.0f}% (безопасных {sum(e[key] == v for e in safe)})" for v in vals))
