"""imp10, круг 3: когда исключать монету и как. Правила (только прошлое): долгое отставание от BTC (rel365 < −v, rel730 < −v),
потеря ликвидности (объём 90 дн. < доли своего максимума за год), выпадение из 100 крупнейших. Способы: заморозка (держать, не покупать),
продать → резервы остальных, продать → BTC; с заменой (новая монета по тому же правилу выбора) и без.
Проверка: (1) составы, выбранные правилами круга 2 на вселенной A; (2) фиксированные наборы P9, B, M, P2+BTC, P3+BTC.
Запуск: python3 app/imp10_r3.py"""
import sys, json, time, os
import numpy as np, pandas as pd
from imp10_port import Uni, SETS, S_BEST, nolev, IDX, STARTS, simw, mcap, SP
from imp10_r2 import universe, features, pick

V = dict(lag365=("REL", -50), lag365_70=("REL", -70), lag730=("REL2", -70), liq15=("LIQ", 0.15), liq25=("LIQ", 0.25), rank100=("RANK", 100),
         lag365_liq=("BOTH", None))


def extra(F, U):
    C = pd.DataFrame(U.C, index=IDX)
    r = C / C.shift(730); F["REL2"] = (r.div(r[0], axis=0) - 1).values * 100
    V90 = pd.DataFrame(F["VOL"], index=IDX)
    F["LIQ"] = (V90 / V90.rolling(365, min_periods=180).max()).values
    capd = np.nan_to_num(F["CAP"], nan=-1.0); capd[:, 0] = -1        # BTC вне рейтинга
    F["RANK"] = (-capd).argsort(axis=1).argsort(axis=1).astype(float) + 1
    F["RANK"][~(np.nan_to_num(F["CAP"], nan=0) > 0)] = np.nan
    return F


def exmask(F, rule):
    key, v = V[rule]
    if key == "REL" or key == "REL2":
        M = np.nan_to_num(F[key], nan=0) < v
    elif key == "LIQ":
        M = np.nan_to_num(F["LIQ"], nan=1) < v
    elif key == "RANK":
        M = np.nan_to_num(F["RANK"], nan=0) > v
    else:
        M = (np.nan_to_num(F["REL"], nan=0) < -50) & (np.nan_to_num(F["LIQ"], nan=1) < 0.25)
    M[:, 0] = False
    return M


def run_sel(U, F, An, Lmn, sel, rules, modes, draws=6, repl=False):
    Z0 = np.zeros(U.C.shape); FD = np.zeros(len(U.coins)); st = [s for s in STARTS if IDX[s].year >= 2019]
    out = {}
    for rule in rules:
        M = exmask(F, rule) if rule != "none" else None
        for mode in (modes if rule != "none" else [0]):
            xs = []
            for s in st:
                v = []
                for d in range(draws if sel.startswith("RND") else 1):
                    rng = np.random.default_rng(100003 + s * 7 + d)
                    ch = list(pick(F, s, sel, rng)); WT = np.zeros(U.C.shape); WT[:, 0] = 1; WT[:, ch] = 1; EX = Z0
                    if M is not None:
                        EX = np.zeros(U.C.shape)
                        # первое срабатывание после старта (и не раньше 30 дней — не выкидываем сразу купленное)
                        pend = list(ch); used = set(ch)
                        while pend:
                            k = pend.pop()
                            hit = np.where(M[s + 30:, k])[0]
                            if len(hit) == 0:
                                continue
                            t = s + 30 + hit[0]; EX[t, k] = 1; WT[t + 1:, k] = 0
                            if repl and t + 1 < len(IDX):
                                nc = [j for j in pick(F, t + 1, sel, rng, n=20) if j not in used and not M[t, j]]
                                if nc:
                                    j = nc[0]; used.add(j); WT[t + 1:, j] = 1; pend.append(j)
                                    # замена получает то, что осталось от исключённой (режим 1 делит по весам дня t)
                    v.append(simw(U.C, U.LO, U.HI, An, U.plan2(nolev(S_BEST)[0])[1], np.zeros(U.C.shape), WT, EX, FD, int(s), Lmn, 1.0, 0.15 / 365, 0.0003, mode)[1])
                xs.append(np.median(v))
            xs = np.array(xs) * 100; yrs = np.array([IDX[s].year for s in st])
            o = {"med": float(np.median(xs)), "p10": float(np.percentile(xs, 10)), "ln": float(np.mean(np.log1p(xs / 100))), "pos": int((xs > 0).sum()),
                 "l": float(np.median(xs[yrs >= 2022]))}
            out[f"{sel}|{rule}|{mode}|{int(repl)}"] = o
            print(f"{sel:10s} {rule:11s} способ {mode} замена {int(repl)}: мед {o['med']:+5.0f}% p10 {o['p10']:+4.0f}% ln {o['ln']:.3f} в плюсе {o['pos']} 2022–26 {o['l']:+4.0f}%", flush=True)
    return out


def run_sets(rules, modes):
    out = {}
    for nm, coins in SETS.items():
        U = Uni(coins); F = features(U); F = extra(F, U)
        Sn, Ln = nolev(S_BEST); An, Gn = U.plan2(Sn); Lmn = U.levmat(Ln)
        for rule in ["none"] + rules:
            for mode in (modes if rule != "none" else [0]):
                EX = np.zeros(U.C.shape) if rule == "none" else exmask(F, rule).astype(float)
                # исключение — только первое срабатывание после 1 года жизни монеты (новые монеты не трогаем)
                age = np.isfinite(U.C).cumsum(axis=0); EX[age < 365] = 0
                o = U.portw(An, Gn, Ln, EX=EX, mode=mode)
                out[f"{nm}|{rule}|{mode}"] = {q: o[q] for q in ("med", "p10", "early", "late")}
                ex_coins = [U.coins[k][0].split("-")[0] for k in range(len(U.coins)) if EX[:, k].any()]
                print(f"{nm:7s} {rule:11s} способ {mode}: мед {o['med']:+5.0f}% p10 {o['p10']:+4.0f}% 2018–21 {o['early']:+6.0f} 2022–26 {o['late']:+4.0f} | под правило попадали: {','.join(ex_coins)}", flush=True)
    return out


if __name__ == "__main__":
    t0 = time.time(); what = sys.argv[1] if len(sys.argv) > 1 else "sel"
    rules = ["lag365", "lag365_70", "lag730", "liq15", "liq25", "rank100", "lag365_liq"]
    if what == "sel":
        U = Uni(universe("A")); F = features(U); F["C"] = U.C; F = extra(F, U)
        Sn, Ln = nolev(S_BEST); An, Gn = U.plan2(Sn); Lmn = U.levmat(Ln)
        R = {}
        for sel in ("RND_TOP30", "MOM_ALL"):
            R.update(run_sel(U, F, An, Lmn, sel, ["none"] + rules, [0, 1, 2]))
            R.update(run_sel(U, F, An, Lmn, sel, ["lag365", "rank100", "liq25"], [1], repl=True))
    else:
        R = run_sets(rules, [0, 1, 2])
    json.dump(R, open(os.path.join(SP, f"imp10_r3_{what}.json"), "w"), indent=1)
    print(f"[{time.time() - t0:.0f} с]")
