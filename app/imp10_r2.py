"""imp10, круг 2: правила ВЫБОРА монет на широкой вселенной (Yahoo-монеты основы + ~180 монет CoinMarketCap из кэша).
На каждый старт (1-е число месяца 2019–2026) состав выбирается ТОЛЬКО по данным до дня старта: BTC + N альтов по правилу,
дальше стратегия (combo-best без плеча) и обычный DCA с равными долями, состав не меняется. Сравнение правил между собой и с
случайным выбором (среднее по жребиям). Запуск: python3 app/imp10_r2.py [N]"""
import sys, json, time
import numpy as np, pandas as pd
from imp10_port import Uni, YCID, S_BEST, nolev, DCA, IDX, STARTS, simw, mcap, STABLE, SP
import glob, os

N = int(sys.argv[1]) if len(sys.argv) > 1 else 8
WRAP = {"WBTC", "STETH", "WETH", "WBETH", "CBBTC", "WEETH", "RETH", "BTCB", "LBTC", "SOLVBTC", "PAXG", "XAUT", "JITOSOL", "MSOL", "BETH", "FRAX", "LUSD", "GUSD", "USDP",
        "USDD", "USD0", "USDX", "SUSDE", "USDY", "BUIDL", "USDTB", "RLUSD", "USD1", "USDF", "XSGD", "EURS", "TBTC", "RENBTC", "HBTC", "WBNB", "CUSDC", "CDAI"}


def universe():
    coins = [("BTC-USD", "btc")] + [(s, "alt") for s in YCID if s != "BTC-USD"]
    have = set(YCID.values())
    for f in sorted(glob.glob(os.path.join(os.path.dirname(os.path.abspath(__file__)), "cache", "cmcv_*.json"))):
        cid = int(os.path.basename(f)[5:-5])
        if cid in have:
            continue
        m = mcap(cid)
        sym = json.load(open(os.path.join(SP, "imp10_mcap", f"{cid}.json")))["sym"] if m is not None else None
        if sym is None or sym.upper() in STABLE or sym.upper() in WRAP:
            continue
        coins.append((f"cmc:{cid}", "alt"))
    return coins


def features(U):
    """Признаки по дням × монетам (только прошлое): объём 90 дн., капитализация 30 дн., возраст, сила к BTC 365 дн., волатильность 90 дн."""
    K = len(U.coins); n = len(IDX)
    VOL = np.full((n, K), np.nan); CAP = VOL.copy()
    for k in range(K):
        d = mcap(U.cid(k))
        if d is None:
            continue
        VOL[:, k] = d["v"].where(d["v"] > 0).rolling(90, min_periods=30).mean().reindex(IDX).values
        CAP[:, k] = d["m"].where(d["m"] > 0).rolling(30, min_periods=5).mean().reindex(IDX).values
    C = pd.DataFrame(U.C, index=IDX)
    AGE = np.isfinite(U.C).cumsum(axis=0).astype(float)
    r = C / C.shift(365); REL = (r.div(r[0], axis=0) - 1).values * 100
    SIG = np.log(C).diff().rolling(90, min_periods=60).std().values * np.sqrt(365) * 100
    # «мёртвая» цена или дыры: монета должна торговаться в день старта
    return {"VOL": VOL, "CAP": CAP, "AGE": AGE, "REL": REL, "SIG": SIG}


def pick(F, t, rule, rng, n=N, K=None):
    """Номера альтов (без BTC), выбранные на день t по данным до t − 1."""
    s = t - 1
    alive = np.isfinite(F["C"][s]) & np.isfinite(F["C"][max(0, s - 7)])
    alive[0] = False
    base = alive & np.isfinite(F["VOL"][s]) & (F["VOL"][s] > 0)
    cand = np.where(base)[0]
    if rule == "RND":
        return rng.choice(cand, size=min(n, len(cand)), replace=False)
    cap = np.nan_to_num(F["CAP"][s], nan=0); vol = np.nan_to_num(F["VOL"][s], nan=0); age = F["AGE"][s]
    rel = F["REL"][s]; sig = F["SIG"][s]

    def top(idx, key, k=n, rev=True):
        idx = np.array([i for i in idx if np.isfinite(key[i])])
        if len(idx) == 0:
            return idx
        o = np.argsort(key[idx]); o = o[::-1] if rev else o
        return idx[o[:k]]
    if rule == "CAP":
        return top(cand, cap)
    if rule == "LIQ":
        return top(cand, vol)
    if rule == "CAP_AGE1":
        return top(cand[age[cand] >= 365], cap)
    if rule == "CAP_AGE2":
        return top(cand[age[cand] >= 730], cap)
    if rule == "LIQ_AGE1":
        return top(cand[age[cand] >= 365], vol)
    if rule == "RND_AGE1":
        c2 = cand[age[cand] >= 365]; return rng.choice(c2, size=min(n, len(c2)), replace=False)
    if rule == "RND_TOP30":
        c2 = top(cand, cap, 30); return rng.choice(c2, size=min(n, len(c2)), replace=False)
    if rule == "TOP30_MOM":
        return top(top(cand[age[cand] >= 365], cap, 30), rel)
    if rule == "TOP30_WEAK":
        return top(top(cand[age[cand] >= 365], cap, 30), rel, rev=False)
    if rule == "TOP30_VOLHI":
        return top(top(cand[age[cand] >= 365], cap, 30), sig)
    if rule == "TOP30_VOLLO":
        return top(top(cand[age[cand] >= 365], cap, 30), sig, rev=False)
    if rule == "TOP30_RELPOS":       # из 30 крупных — только сильнее BTC за год, по капитализации
        c2 = top(cand[age[cand] >= 365], cap, 30); c2 = c2[np.nan_to_num(rel[c2], nan=-1e9) > 0]; return top(c2, cap)
    if rule == "MOM_ALL":
        return top(cand[age[cand] >= 365], rel)
    if rule == "TOP15_YOUNG":       # молодые (< 1 года) среди 15… крупные по капитализации
        return top(cand[age[cand] < 365], cap)
    raise ValueError(rule)


def run(U, F, rules, draws=10, starts=None, seed=1):
    Sn, Ln = nolev(S_BEST); Sd, Ld = nolev(DCA)
    An, Gn = U.plan2(Sn); Ad, Gd = U.plan2(Sd); Lmn = U.levmat(Ln); Lmd = U.levmat(Ld)
    Z0 = np.zeros(U.C.shape); FD = np.zeros(len(U.coins)); SH = Z0
    st = [s for s in (STARTS if starts is None else starts) if IDX[s].year >= 2019]
    out = {}
    for rule in rules:
        nd = draws if rule.startswith("RND") else 1
        xs, xd, sets = [], [], []
        for s in st:
            vs, vd = [], []
            for d in range(nd):
                rng = np.random.default_rng(seed * 100003 + s * 7 + d)
                ch = pick(F, s, rule, rng)
                WT = np.zeros(U.C.shape); WT[:, 0] = 1; WT[:, ch] = 1
                vs.append(simw(U.C, U.LO, U.HI, An, Gn, SH, WT, Z0, FD, int(s), Lmn, 1.0, 0.15 / 365, 0.0003, 0)[1])
                vd.append(simw(U.C, U.LO, U.HI, Ad, Gd, SH, WT, Z0, FD, int(s), Lmd, 1.0, 0.15 / 365, 0.0003, 0)[1])
                if d == 0:
                    sets.append([U.coins[i][0] for i in ch])
            xs.append(np.median(vs)); xd.append(np.median(vd))
        xs = np.array(xs) * 100; xd = np.array(xd) * 100
        yrs = np.array([IDX[s].year for s in st])
        out[rule] = {"med": float(np.median(xs)), "p10": float(np.percentile(xs, 10)), "ln": float(np.mean(np.log1p(xs / 100))),
                     "dca_med": float(np.median(xd)), "dca_ln": float(np.mean(np.log1p(xd / 100))),
                     "pos": int((xs > 0).sum()), "n": len(xs), "beat_dca": int((xs > xd).sum()),
                     "e": float(np.median(xs[yrs <= 2021])), "l": float(np.median(xs[yrs >= 2022])), "x": xs.tolist(), "sets": sets}
        o = out[rule]
        print(f"{rule:12s} стратегия мед {o['med']:+6.0f}% p10 {o['p10']:+5.0f}% ln {o['ln']:.3f} (2019–21 {o['e']:+6.0f}, 2022–26 {o['l']:+5.0f}) "
              f"в плюсе {o['pos']}/{o['n']} | DCA мед {o['dca_med']:+5.0f}% ln {o['dca_ln']:.3f} | лучше DCA {o['beat_dca']}", flush=True)
    return out


if __name__ == "__main__":
    t0 = time.time()
    U = Uni(universe()); F = features(U); F["C"] = U.C
    print(f"вселенная: {len(U.coins)} монет [{time.time() - t0:.0f} с]", flush=True)
    rules = ["RND", "RND_AGE1", "RND_TOP30", "CAP", "CAP_AGE1", "CAP_AGE2", "LIQ", "LIQ_AGE1", "TOP30_MOM", "TOP30_WEAK", "TOP30_VOLHI", "TOP30_VOLLO",
             "TOP30_RELPOS", "MOM_ALL", "TOP15_YOUNG"]
    R = run(U, F, rules)
    json.dump(R, open(os.path.join(SP, f"imp10_r2_{N}.json"), "w"))
    print(f"[{time.time() - t0:.0f} с]")
