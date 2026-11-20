"""h2: маржа кандидата «удержание после капитуляции» (H2) против combo4 по схеме ×1,45 (как lev145.py / r4_margin.py): пять портфелей маржи на споте
(сдвиги −1/0/+1, стресс −20/−30%) и четыре перпа (USELESS, XMR, ZEC, FARTCOIN) на одном счёте.
H2 — правило «взнос» (act 1) перед продажами на страхе (индекс 10): страх < 15 был не позже 60 дней назад, MVRV BTC < 1, возраст ряда монеты > 180 дн, btcr30 < 20.
Индикаторы mvrv (из кеша cache/mvrv_hist.json, без сети) и h2fd15 (дней с последнего дня страха < 15) добавляются обёрткой Book.ind.
Варианты (аргумент): all — основа и H2 (спот-маржа и перпы); v — только спот-маржа, H2 и варианты без мемов / только крупные (подробно: ликвидации по сдвигам).
Запуск: python3 app/h2_margin.py [all|v]"""
import os, sys, json
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
import agent4d_margin as A4D  # noqa: E402
from combo_margin import SETS  # noqa: E402
from bybit_msim import sim6 as simb  # noqa: E402
from agent4d_margin import STARTS  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
MODE = sys.argv[1] if len(sys.argv) > 1 else "all"
if MODE == "all":
    from perp_margin import fill, ST  # noqa: E402  (печатает свою таблицу при импорте)
else:
    ST = {"base": 1, "rules": json.load(open(os.path.join(HERE, "found", "combo4-best.json")))["rules"]}
_mvj = json.load(open(os.path.join(HERE, "cache", "mvrv_hist.json")))
_MV = pd.Series(_mvj["v"], index=pd.to_datetime(_mvj["t"])).sort_index()
_prev = A4D.Book.ind


def _ind_h2(self, k):
    I = _prev(self, k)
    if "h2fd15" not in I:
        f = I["fng"]; on = (f < 15).fillna(False).values; idx = np.arange(len(f), dtype=float)
        last = pd.Series(np.where(on, idx, np.nan)).ffill().values
        I["h2fd15"] = pd.Series(np.where(np.isnan(last), 1e9, idx - last), index=f.index)
        I["mvrv"] = _MV.reindex(f.index, method="ffill")
    return I


A4D.Book.ind = _ind_h2
PX.POL.update(on=True, k=0.0, m=2.0, A=0)
c = lambda i, o, v: {"ind": i, "op": o, "v": v}  # noqa: E731
H2 = {"act": 1.0, "conds": [c("h2fd15", "<", 60), c("mvrv", "<", 1.0), c("age", ">", 180), c("btcr30", "<", 20)]}
ST2 = dict(ST, rules=ST["rules"][:10] + [H2] + ST["rules"][10:])
VARS = (("combo4", ST), ("combo4 + H2", ST2))
if MODE == "v":
    H2nm = dict(H2, conds=H2["conds"][:3] + [c("meme", "<", 0.5)] + H2["conds"][3:]); H2big = dict(H2, conds=H2["conds"][:3] + [c("isbig", ">", 0.5)] + H2["conds"][3:])
    VARS = (("combo4 + H2", ST2), ("combo4 + H2 без мемов", dict(ST, rules=ST["rules"][:10] + [H2nm] + ST["rules"][10:])),
            ("combo4 + H2 только крупные", dict(ST, rules=ST["rules"][:10] + [H2big] + ST["rules"][10:])))
PS = {k: I6.LP(v) for k, v in SETS.items()}
for lev in (1.45,):
    for nm, st0 in VARS:
        S, L = C3M.scheme6(st0, sr=1.0, t1grp="off", lp=lev, lr=lev)
        bad, ms, lv = [], [], 99
        for pn, P in PS.items():
            o = C3M.full6(P, S, L, 0.2, 0.11 / 365, (0.5, 0.5), 0.0)
            ms.append(f"{pn} {o['m-1']:+.0f}/{o['m0']:+.0f}/{o['m+1']:+.0f}"); lv = min(lv, o["lvl"]); bad += [pn] if not o["safe"] else []
            if not o["safe"]: bad[-1] += f" {o['liq']}"
        print(f"{nm} | маржа на споте ×{lev}: {'0 ликв.' if not bad else 'ЛИКВ ' + ','.join(bad)} | запас {lv:.2f} | " + " | ".join(ms), flush=True)
        if MODE != "all":
            continue
        coins = [("USELESS36828-USD", "alt"), ("XMR-USD", "alt"), ("ZEC-USD", "alt"), ("FARTCOIN-USD", "alt")]
        P = I6.LP(coins); fill(P); ok = np.where(np.isfinite(P.B.C).any(axis=1))[0]; last = int(ok[-1]); sl = slice(0, last + 1)
        A, G = P.mats(S, all_lag=0); k = I6.cfg(P, WT=(0.5, 0.5), SPL=C3M.SPLIT, hlx=True, hl=2, perp_all=True, fund=0.10 / 365, mino=1.0, minb=1.0)
        MK = np.array([2.0, 1.0, 1.0, 2.0])
        st = [int(s) for s in STARTS if s < last - 90]
        f = lambda s, sv: simb(P.B.C[sl], P.B.LO[sl], P.B.HI[sl], A[sl], G[sl], np.zeros(P.B.C[sl].shape), np.ones(P.B.C[sl].shape), s, P.B.levmat(L), sv,  # noqa: E731
                               0.15 / 365, 0.11 / 365, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0, MK)
        o = [f(s, 1.0) for s in st]; x = np.array([q[1] for q in o]) * 100
        print(f"{nm} | перпы (4 монеты, один счёт) ×{lev}: медиана {np.median(x):+.0f}% | ликв {sum(int(q[0] > 0) for q in o)} | −20%: {sum(int(f(s, 0.8)[0] > 0) for s in st)} | −30%: {sum(int(f(s, 0.7)[0] > 0) for s in st)}", flush=True)
