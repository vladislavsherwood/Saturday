"""Круг 11: общий резерв на все металлы (портфель 8 металлов отбора, старт 1972). Сигналы — R5.
H11a — общий котёл, в месяц серии каждый из S металлов берёт g/S резерва; H11b — каждый берёт g/8; H11c — котлы по группам (драг./пром.), как H11a.
Критерий и вето — в журнале (портфель, половины, сдвиг, «без одного металла», плато по g).
Запуск: python3 app/metals_agent2_loop11.py"""
import numpy as np
from numba import njit

import metals_agent2_lib as A

UNIT, FEE = 300.0, 0.001
GS = (0.33, 0.5, 0.67)


@njit(cache=True)
def sim_pool(C, P, act, grp, ng, lo, hi, lag, mode, g, rate):
    """C, P: (K, n) цены и планы; act: (K,) участвует ли металл; grp: (K,) номер котла; mode 0 — свой счёт (доля g от своего резерва),
    1 — доля g/S общего котла, 2 — доля g/(число металлов в котле). Возвращает итог портфеля к DCA, % и среднюю долю денег в капитале."""
    K, n = C.shape
    units = np.zeros(K)
    du = np.zeros(K)
    pool = np.zeros(ng)
    cash_sh = 0.0
    cnt = 0
    nmet = np.zeros(ng)
    for k in range(K):
        if act[k]:
            nmet[grp[k]] += 1
    for i in range(lo, hi):
        j = i - 1 - lag
        for q in range(ng):
            pool[q] *= 1 + rate[i]
        before = pool.copy()
        S = np.zeros(ng)
        for k in range(K):
            if act[k] and j >= lo and P[k, j] > 1.0:
                S[grp[k]] += 1
        # взносы и продажи
        for k in range(K):
            if not act[k]:
                continue
            p = C[k, i]
            q = grp[k]
            pool[q] += UNIT
            du[k] += UNIT * (1 - FEE) / p
            a = P[k, j] if j >= lo else 1.0
            if a < 0:
                v = -a * units[k] * p
                units[k] += a * units[k]
                pool[q] += v * (1 - FEE)
        # обычные покупки
        for k in range(K):
            if not act[k]:
                continue
            a = P[k, j] if j >= lo else 1.0
            if a > 0 and a <= 1.0:
                q = grp[k]
                v = min(pool[q], UNIT * a)
                units[k] += v * (1 - FEE) / C[k, i]
                pool[q] -= v
        # докупки серий
        for k in range(K):
            if not act[k]:
                continue
            a = P[k, j] if j >= lo else 1.0
            if a > 1.0:
                q = grp[k]
                if mode == 0:
                    share = (a - 1.0) * before[q]
                elif mode == 1:
                    share = g * before[q] / S[q]
                else:
                    share = g * before[q] / nmet[q]
                v = min(pool[q], UNIT + share)
                units[k] += v * (1 - FEE) / C[k, i]
                pool[q] -= v
        tot = 0.0
        for k in range(K):
            if act[k]:
                tot += units[k] * C[k, i]
        cs = pool.sum()
        cash_sh += cs / (tot + cs)
        cnt += 1
    V = pool.sum()
    Vd = 0.0
    for k in range(K):
        if act[k]:
            V += units[k] * C[k, hi - 1]
            Vd += du[k] * C[k, hi - 1]
    return (V / Vd - 1) * 100, cash_sh / max(cnt, 1)


def setup(D, planfn):
    idx = D["_X"].index
    K = len(A.SEL)
    C = np.full((K, len(idx)), np.nan)
    P = np.ones((K, len(idx)))
    for r, k in enumerate(A.SEL):
        d = D[k]
        pos = idx.get_indexer(d["t"])
        C[r, pos] = d["c"]
        P[r, pos] = planfn(d)
    cut = lambda s: int(idx.searchsorted(np.datetime64(s)))   # noqa: E731
    per = {"before": (cut("1972-01-01"), cut("1999-01-01")), "h1": (cut("1972-01-01"), cut("1982-01-01")), "h2": (cut("1982-01-01"), cut("1999-01-01")),
           "after": (cut("1999-01-01"), len(idx)), "full": (cut("1972-01-01"), len(idx))}
    tb = D["_X"]["tb3"].ffill().fillna(5.0).values / 1200
    return C, P, per, tb


def run(C, P, per, mode, g, groups, act=None, lag=0, rate=None):
    K = C.shape[0]
    act = np.ones(K, np.bool_) if act is None else act
    grp = np.asarray(groups, np.int64)
    ng = int(grp.max()) + 1
    rate = np.zeros(C.shape[1]) if rate is None else rate
    return {nm: sim_pool(C, P, act, grp, ng, a, b, lag, mode, g, rate) for nm, (a, b) in per.items()}


def main():
    D = A.load()
    C, P, per, tb = setup(D, A.ver("R5"))
    K = len(A.SEL)
    own = np.arange(K)
    one = np.zeros(K, np.int64)
    two = np.array([0 if A.GROUP[k] == "prec" else 1 for k in A.SEL])
    # проверка: отдельные счета = сумма металлов из обычного симулятора
    R5 = A.evaluate(D, A.ver("R5"), keys=A.SEL, lag=False)
    base = run(C, P, per, 0, 0.5, own)
    print("портфель 8 металлов, отдельные счета R5 (итог к DCA портфеля, %): " + ", ".join(f"{k} {v[0]:+.1f}" for k, v in base.items() if k in ("before", "h1", "h2"))
          + f"; доля денег в капитале до 1999 {base['before'][1] * 100:.0f}%")
    base_lag = run(C, P, per, 0, 0.5, own, lag=1)
    loo_base = {}
    for r in range(K):
        act = np.ones(K, np.bool_); act[r] = False
        loo_base[r] = run(C, P, per, 0, 0.5, own, act=act)
    rows, by = [], {}
    for fam, mode, groups, nm in (("a", 1, one, "H11a общий котёл, g/S"), ("b", 2, one, "H11b общий котёл, g/8"), ("c", 1, two, "H11c котлы по группам, g/S")):
        for g in GS:
            res = run(C, P, per, mode, g, groups)
            lag = run(C, P, per, mode, g, groups, lag=1)
            loo = {}
            for r in range(K):
                act = np.ones(K, np.bool_); act[r] = False
                loo[r] = run(C, P, per, mode, g, groups, act=act)
            rel = {p: A.rel(res[p][0], base[p][0]) for p in per}
            lb = np.array([A.rel(loo[r]["before"][0], loo_base[r]["before"][0]) for r in range(K)])
            ok = rel["before"] >= 2 and rel["h1"] >= 0 and rel["h2"] >= 0 and A.rel(lag["before"][0], base_lag["before"][0]) >= 0 and (lb >= -0.5).sum() >= 7
            row = {"name": f"{nm}, g = {g:.0%}", "fam": fam, "g": g, "rel": rel, "lag": A.rel(lag["before"][0], base_lag["before"][0]), "lb": lb, "ok": ok,
                   "loo": loo, "res": res, "cash": res["before"][1]}
            rows.append(row); by[(fam, g)] = row
            print(f"  {'✓' if ok else '·'} {row['name']}: до 1999 {rel['before']:+.1f}% (1972–81 {rel['h1']:+.1f}, 1982–98 {rel['h2']:+.1f}), сдвиг {row['lag']:+.1f}; "
                  f"без одного металла не хуже {(lb >= -0.5).sum()}/8 (худший {lb.min():+.1f}); доля денег до 1999 {row['cash'] * 100:.0f}% (отд. счета {base['before'][1] * 100:.0f}%)")
    good = [r for r in rows if r["ok"] and A.plateau({(x['fam'], x['g']): x for x in rows}, (r["fam"], r["g"]), (None, GS))]
    good.sort(key=lambda r: -r["rel"]["before"])
    print(f"\nпрошли критерий с плато: {len(good)}")
    if not good:
        print("отдельные счета остаются")
        return
    best = good[0]
    la = np.array([A.rel(best["loo"][r]["after"][0], loo_base[r]["after"][0]) for r in range(K)])
    ok = best["rel"]["after"] >= -1 and (la >= -0.5).sum() >= 6
    print(f"ВЫБРАН: {best['name']}\n  ВЕТО: после 1999 {best['rel']['after']:+.1f}%, вся {best['rel']['full']:+.1f}%; без одного металла после 1999 не хуже {(la >= -0.5).sum()}/8 "
          f"(худший {la.min():+.1f}) → {'проходит' if ok else 'ОТКЛОНЁН'}")
    print(f"  портфель к DCA: отдельные счета до/после/вся {base['before'][0]:+.1f}/{base['after'][0]:+.1f}/{base['full'][0]:+.1f}; "
          f"общий резерв {best['res']['before'][0]:+.1f}/{best['res']['after'][0]:+.1f}/{best['res']['full'][0]:+.1f}; доля денег после 1999 {base['after'][1] * 100:.0f}% → {best['res']['after'][1] * 100:.0f}%")
    tbr = run(C, P, per, 0, 0.5, own, rate=tb)
    tbp = run(C, P, per, 1 if best["fam"] != "b" else 2, best["g"], one if best["fam"] != "c" else two, rate=tb)
    print(f"  с доходом резерва: отдельные {tbr['before'][0]:+.1f}/{tbr['after'][0]:+.1f}/{tbr['full'][0]:+.1f}; общий {tbp['before'][0]:+.1f}/{tbp['after'][0]:+.1f}/{tbp['full'][0]:+.1f}")


if __name__ == "__main__":
    main()
