"""Размер покупок на сигналах вместе с плечом: сколько резерва вкладывать на дне / панике / развороте и с каким плечом.
Без лимитов займа. Цель — наибольшая прибыль портфеля из 9 монет ($2 в день на монету) при почти нулевом шансе ликвидации.
Спотовая кросс-маржа: ликвидация при активы/долг ≤ 1,1 по минимуму дня, заём ~11% годовых, 105 дат старта с 2018.
Запуск: python3 app/lev_size.py"""
import sys, os, itertools, json
import numpy as np, pandas as pd
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine
from cross_lev import C, LO, P, starts, idx, COINS
from lev_bounce import SIG

RATE, ML, FEE, UNIT = 0.0003, 1.1, 0.001, 2.0
ACT0 = np.array([a for a, _ in engine.MAIN_RULES])                   # доли правил основной стратегии
# правило → группа: 0 взнос, 1 дно, 2 паника, 3 разворот, 4 продажа
GRP = np.array([1, 1, 2, 2, 0, 3, 2, 4, 4, 3, 4, 4])
RULE = np.full(C.shape, -1, dtype=np.int64)
for k, (sym, kind, t) in enumerate(COINS):
    close = engine.data.history(sym)[0]
    _, rule, _, _ = engine._reserve_plans(close, kind)["main"]
    s = pd.Series(rule, index=close.index); s = s[~s.index.duplicated()]
    RULE[:, k] = s.reindex(idx).fillna(-1).astype(int).values
RULE[np.isnan(C)] = -2
BOUNCE = SIG["страх и жадность вырос на 25+ за 14 дней"]


@njit(cache=True)
def sim(C, LO, RULE, BOUNCE, s0, act, grp, lev, rep, stress):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9
    for t in range(s0, n):
        for k in range(K):
            p = C[t, k]
            if np.isnan(p):
                continue
            inv += UNIT; before = r[k]; r[k] += UNIT; debt[k] *= 1 + RATE
            if rep > 0 and debt[k] > 0 and t > s0 and BOUNCE[t - 1, k]:
                q = min(u[k], rep * debt[k] / (p * (1 - FEE))); u[k] -= q; debt[k] -= q * p * (1 - FEE)
            ri = RULE[t - 1, k] if t > s0 else -1
            a = act[ri] if ri >= 0 else 1.0
            g = grp[ri] if ri >= 0 else 0
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - f; debt[k] *= 1 - f
            else:
                v = min(r[k], UNIT + (a - 1) * before)
                if v > 0:
                    b = (lev[g] - 1) * v
                    r[k] -= v; u[k] += (v + b) * (1 - FEE) / p; debt[k] += b
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


def make_act(sb, sp, sr):
    """sb — доля резерва на дне (обоим правилам), sp — множитель к долям паники, sr — доля резерва на развороте."""
    a = ACT0.copy()
    a[0] = a[1] = 1 + sb
    for i in (2, 3, 6):
        a[i] = 1 + min(1.0, (ACT0[i] - 1) * sp)
    a[5] = a[9] = 1 + sr
    return a


def ev(sb, sp, sr, lb, lp, lr, rep=0.0, full=True):
    act = make_act(sb, sp, sr); lev = np.array([1.0, lb, lp, lr, 1.0])
    R = [sim(C, LO, RULE, BOUNCE, int(s), act, GRP, lev, rep, 1.0) for s in starts]
    x = np.array([q[1] for q in R]) * 100
    o = {"cfg": [sb, sp, sr, lb, lp, lr, rep], "liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)),
         "early": float(np.median(x[:48])), "late": float(np.median(x[48:]))}
    if full and o["liq"] == 0:
        o["l20"] = int(sum(sim(C, LO, RULE, BOUNCE, int(s), act, GRP, lev, rep, 0.8)[0] > 0 for s in starts))
        o["l30"] = int(sum(sim(C, LO, RULE, BOUNCE, int(s), act, GRP, lev, rep, 0.7)[0] > 0 for s in starts)) if o["l20"] <= 5 else None
    return o


def name(c):
    sb, sp, sr, lb, lp, lr, rep = c
    return (f"дно: {sb * 100:.0f}% резерва ×{lb:g}; паника: доли ×{sp:g} (25/50% → {min(100, 25 * sp):.0f}/{min(100, 50 * sp):.0f}%) ×{lp:g}; разворот: {sr * 100:.0f}% резерва ×{lr:g}"
            + (f"; на отскоке гасим {rep * 100:.0f}% долга" if rep else ""))


if __name__ == "__main__":
    b = ev(0.375, 1, 1, 1, 1, 1)                                      # близко к текущей (дно 25/50% → 37,5% в среднем)
    cur = ev(0.375, 1, 1, 1, 1, 1)
    out = []
    grid = list(itertools.product((0.25, 0.5, 0.75, 1.0), (0.5, 1.0, 1.5), (0.5, 0.75, 1.0), (1, 1.5, 2, 2.5, 3), (1, 1.25, 1.5, 2), (1, 1.5, 2, 2.5, 3)))
    for i, g in enumerate(grid):
        out.append(ev(*g))
        if i % 300 == 0:
            print(f"посчитано {i}/{len(grid)}", file=sys.stderr, flush=True)
    json.dump(out, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/lev_size.json", "w"))
    noleve = [o for o in out if o["cfg"][3:6] == [1, 1, 1]]
    print("без плеча, лучшие размеры покупок:")
    for o in sorted(noleve, key=lambda o: -o["med"])[:3]:
        print(f"  {o['med']:+.0f}% (худшие 10% {o['p10']:+.0f}%; старты 2018–21 {o['early']:+.0f}%, 2022–26 {o['late']:+.0f}%) | {name(o['cfg'])}")
    print(f"  (как сейчас — дно 25/50%, паника ×1, разворот весь резерв, без плеча: {[o for o in noleve if o['cfg'][:3] == [0.25, 1.0, 1.0]][0]['med']:+.0f}% при дне 25%)")
    line = lambda o: f"  {o['med']:+5.0f}% | худшие 10% {o['p10']:+4.0f}% | 2018–21 {o['early']:+6.0f}%, 2022–26 {o['late']:+5.0f}% | ликв. при −20%: {o.get('l20')}, при −30%: {o.get('l30')} | мин. маржа {o['lvl']:.2f} | {name(o['cfg'])}"   # noqa: E731
    for title, cond in (("без ликвидаций и при −20% (0 из 105)", lambda o: o["liq"] == 0 and o.get("l20") == 0),
                        ("без ликвидаций; при −20% не больше 5 из 105", lambda o: o["liq"] == 0 and o.get("l20") is not None and o["l20"] <= 5),
                        ("без ликвидаций даже при −30%", lambda o: o["liq"] == 0 and o.get("l20") == 0 and o.get("l30") == 0)):
        ok = sorted([o for o in out if cond(o)], key=lambda o: -o["med"])
        print(f"\n=== {title}: {len(ok)} схем; лучшие ===")
        for o in ok[:8]:
            print(line(o))
    # погашение на отскоке для лучших
    top = sorted([o for o in out if o["liq"] == 0 and o.get("l20") is not None and o["l20"] <= 5], key=lambda o: -o["med"])[:25]
    print("\n=== те же лучшие + гашение 50% долга на отскоке (страх и жадность +25 за 14 дней) ===")
    rows = [ev(*o["cfg"][:6], rep=0.5) for o in top]
    for o in sorted([o for o in rows if o["liq"] == 0 and o.get("l20") == 0], key=lambda o: -o["med"])[:8]:
        print(line(o))
