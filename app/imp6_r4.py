"""imp6, круг 4: OI и лонги/шорты Binance приходят с опозданием 1–2 дня. Правила с oidd30 / dly* (дно «волна ликвидаций», подтверждение паники,
отложенная покупка, выход шорта по дну) видят данные позавчерашнего дня: ряды oidd30, lsr, dly* сдвинуты на d дней. Портфели × сдвиги исполнения,
по-монетно — в imp6_r4.js."""
import sys, time
import numpy as np
import agent4d_margin as AD
from imp6_common import LP, SETS, BEST, run5, scheme

OI_COLS = ("oidd30", "lsr")


class LagBook(AD.Book):
    d = 0
    def ind(self, k):
        if k not in self._ind:
            I = dict(super().ind(k))
            if self.d:
                for n in list(I):
                    if n in OI_COLS or n.startswith("dly"):
                        I[n] = I[n].shift(self.d)
            self._ind[k] = I
        return self._ind[k]


def port(coins, d):
    LagBook.d = d
    old = AD.Book; AD.Book = LagBook
    import combo_margin as CM
    CM.Book = LagBook
    P = LP(coins)
    CM.Book = old; AD.Book = old
    return P


if __name__ == "__main__":
    t = time.time()
    S0 = {"base": BEST["base"], "rules": BEST["rules"]}
    SPLIT = [1 if g in (1, 2, 5, 7, 4) else 0 for g in range(8)]
    SCH = [("основа ×1,4", dict(D=60, lp=1.4, lr=1.5), (1.0,)), ("основа ×1,35", dict(D=60, lp=1.35, lr=1.5), (1.0,)),
           ("50/50 ×1,3", dict(D=60, lp=1.3, lr=1.5), (0.5, 0.5)), ("без плеча", dict(lev=False), (1.0,))]
    for d in (0, 1, 2):
        PS = {k: port(v, d) for k, v in SETS.items()}
        for tag, sk, WT in SCH:
            S, L = scheme(S0, **sk); SPL = SPLIT if len(WT) > 1 else [0] * 8
            shw = 0.2 if sk.get("lev", True) else 0.0
            out = []
            for nm, P in PS.items():
                ms, bad, lv = [], [], 99
                for lag in (-1, 0, 1):
                    A, G = P.mats(S, all_lag=lag)
                    o = run5(P, A, G, L, shw, sh_lag=lag, WT=WT, SPL=SPL)
                    ms.append(o["med"]); lv = min(lv, o["lvl"])
                    if o["liq"] or o.get("l20") or o.get("l30"): bad.append((lag, o["liq"], o.get("l20"), o.get("l30")))
                out.append(f"{nm} {ms[0]:+.0f}/{ms[1]:+.0f}/{ms[2]:+.0f} {'✘' + str(bad) if bad else 'ok'} {min(lv, 99):.2f}")
            print(f"OI −{d} дн | {tag:13s} | " + " | ".join(out), f"[{time.time() - t:.0f} с]", flush=True)
