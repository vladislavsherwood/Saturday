"""imp10, круг 5: временное исключение с возвратом + финальная проверка на независимой вселенной B (BTC + 100 новых монет).
Выход: отставание от BTC за год > 50% и объём 90 дн. < 25% своего максимума за год (lag365_liq) → продать, остаток в резервы остальных.
Возврат: не раньше чем через 90 дней, когда монета снова сильнее BTC за год (rel365 > 0) — взнос и покупки снова идут.
Запуск: python3 app/imp10_r5.py sets|A|B"""
import sys, json, time, os
import numpy as np
from imp10_port import Uni, SETS, S_BEST, nolev, best_margin, IDX, STARTS, simw, safe, SP
from imp10_r2 import universe, features, pick
from imp10_r3 import extra, exmask


def tempex(F, ret=0.0, wait=90, rule="lag365_liq"):
    """Матрица EX: +1 — выход, −1 — возврат (состояние по каждой монете; только прошлое)."""
    M = exmask(F, rule); R = np.nan_to_num(F["REL"], nan=-1e9) > ret; age = np.isfinite(F["C"]).cumsum(axis=0)
    EX = np.zeros(M.shape)
    for k in range(1, M.shape[1]):
        out, since = False, 0
        for t in range(M.shape[0]):
            if not out and M[t, k] and age[t, k] >= 365:
                EX[t, k] = 1; out, since = True, 0
            elif out:
                since += 1
                if since >= wait and R[t, k]:
                    EX[t, k] = -1; out = False
    return EX


def permex(F, rule="lag365_liq"):
    E = exmask(F, rule).astype(float); age = np.isfinite(F["C"]).cumsum(axis=0); E[age < 365] = 0
    return E


def both(U, A, G, L, sh, **kw):
    o0 = U.portw(A, G, L, sh=sh, stress=True, **kw); o1 = U.portw(A, G, L, sh=sh, stress=True, lag=1, **kw)
    return {"m0": o0["med"], "m1": o1["med"], "p10": o0["p10"], "late": o0["late"], "lvl": min(o0["lvl"], o1["lvl"]), "safe": safe(o0) and safe(o1),
            "liq": [o0["liq"], o0.get("l20"), o0.get("l30"), o1["liq"], o1.get("l20"), o1.get("l30")], "ln": float(np.mean(np.log1p(o0["x"] / 100)))}


def run_sets():
    out = {}
    for nm, coins in SETS.items():
        U = Uni(coins); F = extra(features(U), U); F["C"] = U.C
        for tag, (S, L), sh in (("без плеча", nolev(S_BEST), 0.0), ("лучшая маржа", best_margin(S_BEST), 0.2)):
            A, G = U.plan2(S)
            for vn, kw in (("основа", {}), ("lag365_liq навсегда", {"EX": permex(F), "mode": 1}), ("lag365_liq с возвратом", {"EX": tempex(F), "mode": 1}),
                           ("lag365 с возвратом", {"EX": tempex(F, rule="lag365"), "mode": 1})):
                o = both(U, A, G, L, sh, **kw); out[f"{nm}|{tag}|{vn}"] = o
                print(f"{nm:7s} {tag:13s} {vn:24s} мед {o['m0']:+6.0f}% (+1 д {o['m1']:+6.0f}) p10 {o['p10']:+4.0f}% ln {o['ln']:.3f} 22–26 {o['late']:+4.0f}% "
                      f"запас {min(o['lvl'], 99):5.2f} {'0 ликв.' if o['safe'] else 'ЛИКВ ' + str(o['liq'])}", flush=True)
    return out


def run_uni(part, sels, draws=6):
    U = Uni(universe(part)); F = features(U); F["C"] = U.C; F = extra(F, U)
    print(f"вселенная {part}: {len(U.coins)} монет", flush=True)
    Sn, Ln = nolev(S_BEST); An, Gn = U.plan2(Sn); Lmn = U.levmat(Ln)
    Sd, Ld = nolev({"base": 1, "rules": [{"act": 1, "conds": [{"ind": "fng", "op": "<", "v": -1}]}]}); Ad, Gd = U.plan2(Sd); Lmd = U.levmat(Ld)
    Z0 = np.zeros(U.C.shape); FD = np.zeros(len(U.coins)); st = [s for s in STARTS if IDX[s].year >= 2019]
    EXP = permex(F); EXT = tempex(F); out = {}
    for sel in sels:
        for vn, EXa in (("без исключения", None), ("lag365_liq навсегда", EXP), ("lag365_liq с возвратом", EXT)):
            xs, xd = [], []
            for s in st:
                v, vd = [], []
                for d in range(draws if sel.startswith("RND") else 1):
                    rng = np.random.default_rng(100003 + s * 7 + d)
                    ch = pick(F, s, sel, rng); WT = np.zeros(U.C.shape); WT[:, 0] = 1; WT[:, ch] = 1
                    EX = Z0
                    if EXa is not None:
                        EX = np.zeros(U.C.shape); EX[s + 30:, ch] = EXa[s + 30:, ch]
                    v.append(simw(U.C, U.LO, U.HI, An, Gn, Z0, WT, EX, FD, int(s), Lmn, 1.0, 0.15 / 365, 0.0003, 1)[1])
                    if vn == "без исключения":
                        vd.append(simw(U.C, U.LO, U.HI, Ad, Gd, Z0, WT, Z0, FD, int(s), Lmd, 1.0, 0.15 / 365, 0.0003, 1)[1])
                xs.append(np.median(v)); xd.append(np.median(vd) if vd else np.nan)
            xs = np.array(xs) * 100; xd = np.array(xd) * 100; yrs = np.array([IDX[s].year for s in st])
            o = {"med": float(np.median(xs)), "p10": float(np.percentile(xs, 10)), "ln": float(np.mean(np.log1p(xs / 100))), "pos": int((xs > 0).sum()),
                 "late": float(np.median(xs[yrs >= 2022])), "n": len(xs)}
            if vn == "без исключения":
                o["dca_med"] = float(np.nanmedian(xd)); o["beat_dca"] = int((xs > xd).sum())
            out[f"{part}|{sel}|{vn}"] = o
            print(f"{part} {sel:10s} {vn:24s} мед {o['med']:+5.0f}% p10 {o['p10']:+4.0f}% ln {o['ln']:.3f} в плюсе {o['pos']}/{o['n']} 2022–26 {o['late']:+4.0f}%"
                  + (f" | DCA {o['dca_med']:+4.0f}%, лучше DCA {o['beat_dca']}" if "dca_med" in o else ""), flush=True)
    return out


if __name__ == "__main__":
    t0 = time.time(); what = sys.argv[1] if len(sys.argv) > 1 else "sets"
    R = run_sets() if what == "sets" else run_uni(what, ["RND", "RND_TOP30", "CAP", "MOM_ALL", "TOP30_MOM"])
    json.dump(R, open(os.path.join(SP, f"imp10_r5_{what}.json"), "w"), indent=1)
    print(f"[{time.time() - t0:.0f} с]")
