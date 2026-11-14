"""Агент 3, круг 15: устойчивость схемы M6 (паника ×1,5 при бете монеты ≤ 1,5) на ДРУГИХ портфелях — граница безопасности найдена
на 9 монетах (BTC, ETH, SOL, HYPE, PUMP, DOGE, PEPE, ENA, ZEC). Гипотеза: если правило «плечо по бете» — не подгонка под эти монеты,
то на портфеле крупных альтов (P2) и на портфеле «диких» мемов и альтов (P3) M6 тоже безопасна в стрессе и лучше схемы агента 2.
Модель та же (sim2: $2/день на монету, кросс-маржа, ликвидация при активы/долг ≤ 1,1, заём 11%, старты с 1-го числа каждого месяца с 2018).
Попутно: MYX (памп ×180, потом −99,7%) — итог W25 и C4 к DCA по монете. Запуск: python3 app/agent3_loop15.py"""
import sys, os, json, time
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data
import agent_margin as AM
from agent3_margin import W25, C4, grouped, sized, su_sized, lev_scheme, sim2, fmt2, idx

P = {"P2 крупные альты": [("XRP-USD", "XRP"), ("BNB-USD", "BNB"), ("ADA-USD", "ADA"), ("LINK-USD", "LINK"), ("AVAX-USD", "AVAX"), ("TRX-USD", "TRX"),
                          ("LTC-USD", "LTC"), ("DOT-USD", "DOT"), ("BCH-USD", "BCH")],
     "P3 мемы и дикие альты": [("SHIB-USD", "SHIB"), ("BONK-USD", "BONK"), ("WIF-USD", "WIF"), ("FLOKI-USD", "FLOKI"), ("NEAR-USD", "NEAR"),
                               ("FIL-USD", "FIL"), ("ATOM-USD", "ATOM"), ("FARTCOIN-USD", "FARTCOIN"), ("MYX36410-USD", "MYX")]}
STARTS = np.array([i for i, x in enumerate(idx) if x.day == 1 and i < len(idx) - 60])


def universe(coins):
    n, K = len(idx), len(coins); C = np.full((n, K), np.nan); LO = C.copy(); HI = C.copy(); closes = []
    for k, (sym, t) in enumerate(coins):
        df = data.history(sym)[0]; df = df[~df.index.duplicated()]
        o = data._ohlc[sym].reindex(idx)
        c = o["c"].values; l = o["l"].values; h = o["h"].values
        C[:, k] = c; LO[:, k] = np.where(np.isfinite(l) & (l > 0), np.minimum(l, c), c); HI[:, k] = np.where(np.isfinite(h) & (h > 0), np.maximum(h, c), c)
        closes.append(df)
    return C, LO, HI, closes


def plan(S, coins, closes, C):
    S = grouped(S); acts = np.array([r["act"] for r in S["rules"]] + [1.0]); grp = np.array([r["grp"] for r in S["rules"]] + [0])
    A = np.ones_like(C); G = np.zeros(C.shape, dtype=np.int64); B = np.full(C.shape, np.nan)
    for k, close in enumerate(closes):
        I = AM.indicators(close, "alt")
        conds = []
        for r in S["rules"]:
            m = pd.Series(True, index=close.index)
            for cd in r["conds"]:
                s = I[cd["ind"]]; m &= (s < cd["v"]) if cd["op"] == "<" else (s > cd["v"])
            conds.append(m.fillna(False).values)
        ri = pd.Series(np.select(conds, list(range(len(S["rules"]))), default=-1), index=close.index).reindex(idx).fillna(-1).astype(int).values
        A[:, k] = acts[ri]; G[:, k] = grp[ri]; B[:, k] = pd.Series(I["beta180"], index=close.index).reindex(idx).values
    return A, G, B


def port(C, LO, HI, A, G, lev16):
    lev = np.array(tuple(lev16) + (1.0,) * (16 - len(lev16)), float); SH = np.zeros(C.shape)
    R = [sim2(C, LO, HI, A, G, SH, int(s), lev, 1.0, 0.0, 0.15 / 365, 0, True, True) for s in STARTS]
    x = np.array([q[1] for q in R]) * 100
    o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)),
         "early": float(np.median(x[:48])), "late": float(np.median(x[48:])), "shpnl": 0.0}
    for st, key in ((0.8, "l20"), (0.7, "l30")):
        o[key] = int(sum(sim2(C, LO, HI, A, G, SH, int(s), lev, st, 0.0, 0.15 / 365, 0, True, True)[0] > 0 for s in STARTS))
    return o


def coin_edge(S, close):
    """Итог к DCA по одной монете (как agent_sim.edge: взнос 10, комиссия 0,1%, решение по вчерашнему дню, худший из сдвигов 0/1)."""
    S = grouped(S); I = AM.indicators(close, "alt"); conds = []
    for r in S["rules"]:
        m = pd.Series(True, index=close.index)
        for cd in r["conds"]:
            s = I[cd["ind"]]; m &= (s < cd["v"]) if cd["op"] == "<" else (s > cd["v"])
        conds.append(m.fillna(False).values)
    ri = np.select(conds, list(range(len(S["rules"]))), default=-1); acts = [r["act"] for r in S["rules"]]; p = close.values; res = []
    for lag in (0, 1):
        cash = units = du = 0.0
        for i in range(len(p)):
            j = i - 1 - lag; a = 1.0 if j < 0 or ri[j] < 0 else acts[ri[j]]; before = cash; du += 10 * 0.999 / p[i]; cash += 10
            if a < 0:
                amt = -a * units * p[i]; units -= amt / p[i]; cash += amt * 0.999
            else:
                amt = min(cash, 10 + (a - 1) * before); units += amt * 0.999 / p[i]; cash -= amt
        res.append(((units * p[-1] + cash) / (du * p[-1]) - 1) * 100)
    return min(res)


if __name__ == "__main__":
    t0 = time.time(); out = {}
    for pn, coins in P.items():
        C, LO, HI, closes = universe(coins)
        print(f"\n== {pn}: " + ", ".join(t for _, t in coins), flush=True)
        for nm, S0 in (("W25", W25), ("C4", C4)):
            A, G, B = plan(lev_scheme(S0), coins, closes, C)
            o = port(C, LO, HI, A, G, [1, 2, 1.25, 2, 1, 1, 1, 1.25]); print(f"  {nm}, схема агента 2: {fmt2(o)}", flush=True); out[f"{pn} {nm} агент 2"] = o
        Bm = np.nan_to_num(B, nan=9.0)
        print(f"  медианная бета монет: " + ", ".join(f"{t} {np.nanmedian(B[:, k]):.2f}" for k, (_, t) in enumerate(coins)))
        for b in (1.2, 1.5, 1.8, 99):
            Gs = G.copy(); m = (Bm > b) & np.isin(G, (1, 2, 3, 6, 7)); Gs[m] += 8
            o = port(C, LO, HI, A, Gs, [1, 2, 1.5, 2, 1, 1, 1, 1.5] + [1, 2, 1.25, 2, 1, 1, 1, 1.25])
            print(f"  C4, паника ×1,5 при бете ≤ {b if b < 99 else 'все'}: {fmt2(o)}", flush=True); out[f"{pn} C4 M6 b{b}"] = o
        no = port(C, LO, HI, *plan(grouped(C4), coins, closes, C)[:2], [1] * 8); print(f"  C4 без плеча: {fmt2(no)}"); out[f"{pn} C4 без плеча"] = no
    myx = data.history("MYX36410-USD")[0]; myx = myx[~myx.index.duplicated()]
    print(f"\nMYX ({myx.index[0].date()} … {myx.index[-1].date()}, макс/мин {myx.max() / myx[:myx.idxmax()].min():.0f}×, сейчас {myx.iloc[-1] / myx.max() * 100:.1f}% от максимума): "
          f"итог к DCA W25 {coin_edge(W25, myx):+.0f}%, C4 {coin_edge(C4, myx):+.0f}%")
    json.dump(out, open(sys.argv[1] if len(sys.argv) > 1 else "/dev/null", "w"))
    print(f"{time.time() - t0:.0f} с")
