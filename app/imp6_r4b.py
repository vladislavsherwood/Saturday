"""imp6, круг 4б: какое правило теряет от опоздания OI на 1 день и можно ли заменить «волну ликвидаций» ценой BTC за 1 день (btcr1, %).
oidd30L / dly*L / lsrL — ряды со сдвигом d; правила выбранного семейства переписываются на них."""
import sys, time, json
import numpy as np
import data
import agent4d_margin as AD
from imp6_common import LP, SETS, BEST, run5, scheme, c
import imp6_r4 as R4

_btc = data.history("BTC-USD")[0]; _btc = _btc[~_btc.index.duplicated()]
D = int(sys.argv[1]) if len(sys.argv) > 1 else 1


class LB(AD.Book):
    def ind(self, k):
        if k not in self._ind:
            I = dict(super().ind(k)); ix = I["fng"].index
            for n in list(I):
                if n in ("oidd30", "lsr") or n.startswith("dly"):
                    I[n + "L"] = I[n].shift(D)
            I["btcr1"] = (_btc / _btc.shift(1) - 1).reindex(ix) * 100
            self._ind[k] = I
        return self._ind[k]


def mk(coins):
    import combo_margin as CM
    old = CM.Book; CM.Book = LB; P = LP(coins); CM.Book = old
    return P


def lagfam(S, fam):
    """fam: 'bot' — правило «oidd30 < −28» (одно условие); 'pan' — подтверждение паники; 'dly' — отложенная."""
    R = []
    for r in S["rules"]:
        cs = r["conds"]; inds = [q["ind"] for q in cs]
        hit = (fam == "bot" and inds == ["oidd30"]) or (fam == "pan" and "usdt" in inds and "oidd30" in inds) or (fam == "dly" and any(i.startswith("dly") for i in inds))
        R.append({**r, "conds": [{**q, "ind": q["ind"] + "L"} if hit and (q["ind"] == "oidd30" or q["ind"].startswith("dly")) else q for q in cs]})
    return {**S, "rules": R}


def proxy(S, x, keep=True):
    """дно: «oidd30L < −28» → копия «btcr1 < −x» перед ним (keep=False — вместо него)."""
    R = []
    for r in S["rules"]:
        if [q["ind"] for q in r["conds"]] == ["oidd30L"]:
            R.append({**r, "conds": [c("btcr1", "<", -x)]})
            if keep: R.append(r)
        else:
            R.append(r)
    return {**S, "rules": R}


if __name__ == "__main__":
    t = time.time()
    PS = {k: mk(v) for k, v in SETS.items()}
    S0 = {"base": BEST["base"], "rules": BEST["rules"]}
    S, L = scheme(S0, D=60, lp=1.35, lr=1.5)
    ALL = lagfam(lagfam(lagfam(S, "bot"), "pan"), "dly")
    V = [("OI вовремя", S), (f"OI −{D}: только дно", lagfam(S, "bot")), (f"OI −{D}: только паника", lagfam(S, "pan")),
         (f"OI −{D}: только отложенная", lagfam(S, "dly")), (f"OI −{D}: все три", ALL)]
    for x in (6, 8, 10, 12):
        V.append((f"OI −{D} + дно также при BTC < −{x}% за день", proxy(ALL, x)))
    V.append((f"OI −{D} + дно только по BTC < −8% (без OI)", proxy(ALL, 8, keep=False)))
    for tag, SS in V:
        out = []; tot = 0
        for nm, P in PS.items():
            ms, bad = [], []
            for lag in (-1, 0, 1):
                A, G = P.mats(SS, all_lag=lag)
                o = run5(P, A, G, L, 0.2, sh_lag=lag)
                ms.append(o["med"])
                if o["liq"] or o.get("l20") or o.get("l30"): bad.append((lag, o["liq"], o.get("l20"), o.get("l30")))
            tot += np.log1p(np.mean(ms) / 100)
            out.append(f"{nm} {ms[0]:+.0f}/{ms[1]:+.0f}/{ms[2]:+.0f}{' ✘' + str(bad) if bad else ''}")
        print(f"{tag:42s} | Σlog {tot:.3f} | " + " | ".join(out), f"[{time.time() - t:.0f} с]", flush=True)
