"""imp6, круг 5 (портфель): цены SHIB, PEPE, BONK, FLOKI полной точности (Binance; до листинга — Yahoo) против Yahoo с округлением до 1e-6.
Портфели P9 (PEPE), B (SHIB), M (SHIB, PEPE, BONK, FLOKI), P3+BTC (SHIB, BONK, FLOKI); сдвиги −1/0/+1, стресс."""
import os, json, time
import numpy as np, pandas as pd
import agent4d_margin as AD
from imp6_common import LP, SETS, BEST, run5, scheme, HERE

PR = json.load(open(os.path.join(HERE, "found", "imp6_prices.json")))
MAP = {"SHIB-USD": "SHIB", "PEPE24478-USD": "PEPE", "BONK-USD": "BONK", "FLOKI-USD": "FLOKI"}


class FixBook(AD.Book):
    def __init__(self, coins):
        super().__init__(coins)
        for k, (sym, kind) in enumerate(coins):
            if sym not in MAP: continue
            d = PR[MAP[sym]]; s = pd.DataFrame(d.values(), index=pd.to_datetime(list(d.keys())), columns=["c", "l", "h"])
            close, kd = self.I[k]
            nc = s["c"].reindex(close.index); close2 = nc.where(nc.notna(), close)
            self.I[k] = (close2, kd)
            cc = close2.reindex(AD.IDX).values; ok = np.isfinite(cc) & np.isfinite(self.C[:, k])
            lo = s["l"].reindex(AD.IDX).values; hi = s["h"].reindex(AD.IDX).values; hb = np.isfinite(lo)
            self.C[ok, k] = cc[ok]
            self.LO[:, k] = np.where(hb & ok, np.minimum(lo, self.C[:, k]), np.where(ok, np.minimum(self.LO[:, k], self.C[:, k]), self.LO[:, k]))
            self.HI[:, k] = np.where(hb & ok, np.maximum(hi, self.C[:, k]), np.where(ok, np.maximum(self.HI[:, k], self.C[:, k]), self.HI[:, k]))


def mk(coins, fix):
    import combo_margin as CM
    old = CM.Book
    if fix: CM.Book = FixBook
    P = LP(coins); CM.Book = old
    return P


if __name__ == "__main__":
    t = time.time()
    S0 = {"base": BEST["base"], "rules": BEST["rules"]}
    SPLIT = [1 if g in (1, 2, 5, 7, 4) else 0 for g in range(8)]
    SCH = [("основа ×1,4", dict(D=60, lp=1.4, lr=1.5), (1.0,), 0.2), ("основа ×1,35", dict(D=60, lp=1.35, lr=1.5), (1.0,), 0.2),
           ("50/50 ×1,3", dict(D=60, lp=1.3, lr=1.5), (0.5, 0.5), 0.2), ("без плеча", dict(lev=False), (1.0,), 0.0)]
    for nm in ("P9", "B", "M", "P3+BTC"):
        for fix in (False, True):
            P = mk(SETS[nm], fix); out = []
            for tag, sk, WT, shw in SCH:
                S, L = scheme(S0, **sk); SPL = SPLIT if len(WT) > 1 else [0] * 8
                ms, bad, lv = [], [], 99
                for lag in (-1, 0, 1):
                    A, G = P.mats(S, all_lag=lag)
                    o = run5(P, A, G, L, shw, sh_lag=lag, WT=WT, SPL=SPL)
                    ms.append(o["med"]); lv = min(lv, o["lvl"])
                    if o["liq"] or o.get("l20") or o.get("l30"): bad.append((lag, o["liq"], o.get("l20"), o.get("l30")))
                out.append(f"{tag} {ms[0]:+.0f}/{ms[1]:+.0f}/{ms[2]:+.0f}{' ✘' + str(bad) if bad else ''} {min(lv, 99):.2f}")
            print(f"{nm:7s} {'Binance' if fix else 'Yahoo  '} | " + " | ".join(out), f"[{time.time() - t:.0f} с]", flush=True)
