"""Где плечо имеет смысл для основной стратегии. 9 монет по $2, спотовая кросс-маржа (ликвидация при активы/долг ≤ 1,1, заём ~11% годовых).
Плечо отдельно по видам покупок: обычный взнос / докупка на дне (капитуляция, волна ликвидаций) / на панике в стейблах / на развороте биткоина.
Погашение: продажа гасит долг пропорционально или сначала весь долг. Потолок: новое плечо не берётся, если долг ≥ доли от активов счёта.
Условие: ни одной ликвидации ни с одной даты старта (по месяцам с 2018), в том числе при минимумах ещё на 20% ниже.
Запуск: python3 app/lev_config.py"""
import sys, os, itertools
import numpy as np, pandas as pd
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine
from cross_lev import C, LO, P, starts, idx, COINS

RATE, ML, FEE, UNIT = 0.0003, 1.1, 0.001, 2.0
# номер сработавшего правила по дням → группа покупки: 0 взнос, 1 дно, 2 паника, 3 разворот
GROUP = {-1: 0, 4: 0, 0: 1, 1: 1, 2: 2, 3: 2, 6: 2, 5: 3, 9: 3}
G = np.zeros_like(C, dtype=np.int64)
for k, (sym, kind, t) in enumerate(COINS):
    close = engine.data.history(sym)[0]
    plan, rule, _, _ = engine._reserve_plans(close, kind)["main"]
    g = pd.Series([GROUP.get(int(x), 0) for x in rule], index=close.index)
    g = g[~g.index.duplicated()]
    G[:, k] = g.reindex(idx).fillna(0).astype(int).values


@njit(cache=True)
def sim(C, LO, P, G, s0, lev, repay_first, cap, stress):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9
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
            a = 1.0; g = 0
            if t > s0 and not np.isnan(P[t - 1, k]):
                a = P[t - 1, k]; g = G[t - 1, k]
            if a < 0:
                f = -a
                proceeds = f * u[k] * p * (1 - FEE)
                u[k] *= 1 - f
                if repay_first:
                    pay = min(debt[k], proceeds); debt[k] -= pay; r[k] += proceeds - pay
                else:
                    r[k] += proceeds - f * debt[k]; debt[k] *= 1 - f
            else:
                v = min(r[k], UNIT + (a - 1) * before)
                if v > 0:
                    L = lev[g]
                    if cap > 0 and D >= cap * A:
                        L = 1.0
                    r[k] -= v; u[k] += L * v * (1 - FEE) / p; debt[k] += (L - 1) * v; D += (L - 1) * v
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
    return nl, fin / inv - 1, worst


def evaluate(lev, rf, cap):
    lev = np.array(lev, float)
    R = [sim(C, LO, P, G, int(s), lev, rf, cap, 1.0) for s in starts]
    liq = sum(x[0] > 0 for x in R)
    R2 = [sim(C, LO, P, G, int(s), lev, rf, cap, 0.8) for s in starts] if liq == 0 else None
    f = np.array([x[1] for x in R]) * 100
    return {"liq": liq, "liq20": sum(x[0] > 0 for x in R2) if R2 else None, "med": np.median(f), "p10": np.percentile(f, 10), "worst": f.min(), "lvl": min(x[2] for x in R)}


if __name__ == "__main__":
    for gname, gi in (("взнос", 0), ("дно", 1), ("паника", 2), ("разворот", 3)):
        print(f"доля дней с покупкой «{gname}»: {np.mean((G == gi) & (P > 0) & ~np.isnan(P)) / np.mean(~np.isnan(P)) * 100:.0f}%")
    base = evaluate([1, 1, 1, 1], False, 0.0)
    print(f"\nбез плеча: итог медиана {base['med']:+.0f}%, худшие 10% стартов {base['p10']:+.0f}%")
    LV = [1.0, 1.5, 2.0, 3.0]
    res = []
    for lev in itertools.product(LV, repeat=4):
        if lev == (1.0, 1.0, 1.0, 1.0):
            continue
        for rf in (False, True):
            for cap in (0.0, 0.15, 0.3, 0.5):
                e = evaluate(lev, rf, cap); e.update(lev=lev, rf=rf, cap=cap); res.append(e)
    ok = [e for e in res if e["liq"] == 0 and e["liq20"] == 0]
    print(f"\nвсего схем {len(res)}, без ликвидаций даже с запасом −20%: {len(ok)}")
    name = lambda e: f"взнос ×{e['lev'][0]:g}, дно ×{e['lev'][1]:g}, паника ×{e['lev'][2]:g}, разворот ×{e['lev'][3]:g}; {'продажи сначала гасят долг' if e['rf'] else 'долг гасится пропорционально'}; {'потолок долга ' + str(int(e['cap'] * 100)) + '% активов' if e['cap'] else 'без потолка'}"   # noqa: E731
    for e in sorted(ok, key=lambda e: -e["med"])[:15]:
        print(f"  итог {e['med']:+5.0f}% (худшие 10% {e['p10']:+.0f}%, худший {e['worst']:+.0f}%, мин. маржа {e['lvl']:.2f}) | {name(e)}")
    print("\nвлияние каждой части (лучший итог без ликвидаций с запасом):")
    for i, g in enumerate(("взнос", "дно", "паника", "разворот")):
        print(f"  {g}: " + ", ".join(f"×{L:g} → {max([e['med'] for e in ok if e['lev'][i] == L], default=float('nan')):+.0f}%" for L in LV))
    print("  погашение: " + ", ".join(f"{'сначала долг' if rf else 'пропорционально'} → {max([e['med'] for e in ok if e['rf'] == rf], default=float('nan')):+.0f}%" for rf in (False, True)))
    print("  потолок: " + ", ".join(f"{int(c * 100) if c else 'нет'} → {max([e['med'] for e in ok if e['cap'] == c], default=float('nan')):+.0f}%" for c in (0.0, 0.15, 0.3, 0.5)))
    import json
    json.dump([{**e, "lev": list(e["lev"])} for e in res], open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/lev_config.json", "w"), default=float)
