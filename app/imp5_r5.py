"""imp5, круг 5 (финальная проверка): S1 и S2 на случайных портфелях из 100 новых монет (страницы n0…n9: BTC + 8 случайных монет,
30 портфелей, seed 5) без плеча и с лучшей схемой; плюс поверх combo2-best на пяти портфелях и K, осторожная схема и ставка 15%.
Запуск: python3 app/imp5_r5.py [new|combo2|rate]"""
import sys, os, json, glob
import numpy as np, pandas as pd
from imp5_port import *
from agent4d_margin import Book, IDX, MEMES
DIR = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad"
S2 = ({**S1[0], "RB": 91, "rho": 0.1}, S1[1])
VARS = [("основа", ({}, None)), ("S1", S1), ("S2", S2)]


def page_coins():
    out = []
    for i in range(10):
        s = open(os.path.join(DIR, f"n{i}.html")).read(); a = s.find("SETS = "); b = s.find("\n", a)
        d = json.loads(s[a + 7:b].rstrip().rstrip(";"))
        for k in d["order"]:
            x = d["sets"][k]; ix = pd.to_datetime(np.array(x["t"]), unit="D")
            df = pd.DataFrame({"c": x["c"], "h": x["h"], "l": x["l"]}, index=ix, dtype=float)
            df = df[~df.index.duplicated(keep="last")]; df = df[df["c"] > 0]
            out.append((x.get("ticker") or k, df))
    return out


class PagePort(Port):
    def __init__(self, coins, btc_port):
        B = Book.__new__(Book); bb = btc_port.B
        n = len(IDX); K = len(coins) + 1
        B.coins = [("BTC-USD", "btc")] + [(t, "alt") for t, _ in coins]
        B.C = np.full((n, K), np.nan); B.LO = B.C.copy(); B.HI = B.C.copy()
        B.C[:, 0] = bb.C[:, 0]; B.LO[:, 0] = bb.LO[:, 0]; B.HI[:, 0] = bb.HI[:, 0]; B.I = [bb.I[0]]
        for k, (t, df) in enumerate(coins, start=1):
            cc = df["c"].reindex(IDX).values; lo = df["l"].reindex(IDX).values; hi = df["h"].reindex(IDX).values
            B.C[:, k] = cc
            B.LO[:, k] = np.where(np.isfinite(lo) & (lo > 0), np.minimum(lo, cc), cc)
            B.HI[:, k] = np.where(np.isfinite(hi) & (hi > 0), np.maximum(hi, cc), cc)
            B.I.append((df["c"], "alt"))
        B.meme = np.array([False] * K); B._ind = {}
        self.B = B; self._p = {}
        W = B.hold(B.mask([[c("fng", ">", 75)]]), B.mask(BOT + [[c("btcr30", ">", 20)]])); W[:, 1:] = 0; self.W = W


def new_coins(n=30, seed=5):
    pc = page_coins(); rng = np.random.default_rng(seed); btc = Port([("BTC-USD", "btc")])
    res = {nm: {cn: [] for cn in ("без плеча", "лучшая")} for nm, _ in VARS}
    for j in range(n):
        pick = rng.choice(len(pc), 8, replace=False); Pt = PagePort([pc[i] for i in pick], btc)
        line = []
        for cn in ("без плеча", "лучшая"):
            kw, sh = CFGS[cn]; S, L = scheme(S_BEST, **kw)
            for nm, (opt, f) in VARS:
                o = fullP(Pt, S, L, sh, opt, f(Pt) if f else None); res[nm][cn].append(o)
                line.append(f"{nm}:{o['m0']:+.0f}{'' if o['safe'] else '!LIQ'}")
        print(j, " ".join(pc[i][0] for i in pick), "|", " ".join(line), flush=True)
    summ = {}
    for nm, _ in VARS:
        for cn in ("без плеча", "лучшая"):
            R = res[nm][cn]; B0 = res["основа"][cn]
            m = np.array([o["m0"] for o in R]); m1 = np.array([o["m1"] for o in R]); b = np.array([o["m0"] for o in B0])
            summ[f"{nm} | {cn}"] = {"med_of_med": float(np.median(m)), "med_of_med_1": float(np.median(m1)), "pos": int((m > 0).sum()),
                                   "better_than_base": int((m > b + 1e-9).sum()), "worse_than_base": int((m < b - 1e-9).sum()),
                                   "sumlog_vs_base": float(np.sum(np.log((1 + m / 100) / (1 + b / 100)))),
                                   "p10_med": float(np.median([o["p10"] for o in R])), "worst_p10": float(min(o["p10"] for o in R)),
                                   "worst_start": float(min(o["worst"] for o in R)), "liq_portfolios": int(sum(not o["safe"] for o in R)),
                                   "min_lvl": float(min(o["lvl"] for o in R))}
            print(nm, cn, json.dumps(summ[f"{nm} | {cn}"], ensure_ascii=False), flush=True)
    json.dump(summ, open(os.path.join(DIR, "imp5_r5_new.json"), "w"), ensure_ascii=False, indent=1)


def combo2():
    import combo2_margin  # noqa: F401  флаги монет и индикаторы combo2
    C2 = json.load(open(os.path.join(HERE, "found", "combo2-best.json"))); S0 = {"base": C2["base"], "rules": C2["rules"]}
    out = {}; base = None
    for nm, (opt, f) in VARS:
        res = evalall(opt, f, cfgs=("без плеча", "лучшая", "осторожная"), S0=S0)
        if base is None: base = res
        sc = score(res, base)
        print(f"== combo2 + {nm}: Σlog {sc[0]:+.3f} | Δp10 {sc[1]:+.1f} | Δworst {sc[2]:+.1f} | {'ok' if sc[3] else 'LIQ'}", flush=True)
        for k, o in res.items(): print(f"   {k[0]:10s} {k[1]:7s} {fm(o)}")
        out[nm] = {"|".join(k): o for k, o in res.items()}
    json.dump(out, open(os.path.join(DIR, "imp5_r5_combo2.json"), "w"), ensure_ascii=False)


def rate():
    out = {}; base = None
    for nm, (opt, f) in VARS:
        res = {}
        for cn in ("лучшая", "осторожная"):
            kw, sh = CFGS[cn]; S, L = scheme(S_BEST, **kw)
            for pn, Pt in ports().items():
                res[(cn + " 15%", pn)] = fullP(Pt, S, L, sh, opt, f(Pt) if f else None, rate=0.15 / 365)
                res[(cn, pn)] = fullP(Pt, S, L, sh, opt, f(Pt) if f else None)
        if base is None: base = res
        sc = score(res, base)
        print(f"== {nm}: Σlog {sc[0]:+.3f} | Δp10 {sc[1]:+.1f} | Δworst {sc[2]:+.1f} | {'ok' if sc[3] else 'LIQ'}", flush=True)
        for k, o in res.items(): print(f"   {k[0]:16s} {k[1]:7s} {fm(o)}")
        out[nm] = {"|".join(k): o for k, o in res.items()}
    json.dump(out, open(os.path.join(DIR, "imp5_r5_rate.json"), "w"), ensure_ascii=False)


if __name__ == "__main__":
    {"new": new_coins, "combo2": combo2, "rate": rate}[sys.argv[1] if len(sys.argv) > 1 else "new"]()
