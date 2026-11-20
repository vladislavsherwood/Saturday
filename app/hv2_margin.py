"""hv2: маржа ×1,45 для combo5, hv и hv2 по образцу h2_margin.py (как lev145.py / r4_margin.py): пять портфелей спот-маржи
(сдвиги −1/0/+1, стресс −20/−30%) и четыре перпа (USELESS, XMR, ZEC, FARTCOIN) на одном счёте.
Правила — combo5-best.json (58), hv-best.json (67), hv2-best.json (76). Индикаторы: mvrv и h2fd15 (правило 11 combo5) — обёрткой Book.ind, как в h2_margin.py;
hvv — vol180 (уже есть в combo2_margin: окно 180, min_periods 144), пока его нет — vol90 (окно 90, min_periods 72) — через AM.EXTRA.
Ловушка для фитилей в этой схеме не моделируется (как в h2_margin.py) — сравнение трёх вариантов в одинаковых условиях.
Запуск: python3 app/hv2_margin.py"""
import os, sys, json
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402  (импортирует combo2_margin: vol180, isbig/meme/isalt)
import imp6_common as I6  # noqa: E402
import agent4d_margin as A4D  # noqa: E402
import agent_margin as AM  # noqa: E402
from combo_margin import SETS  # noqa: E402
from bybit_msim import sim6 as simb  # noqa: E402
from agent4d_margin import STARTS  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
_lr = lambda close: np.log(close / close.shift(1))  # noqa: E731
AM.EXTRA["vol90"] = lambda close, kind, I: _lr(close).rolling(90, min_periods=72).std(ddof=0) * np.sqrt(365) * 100
AM.EXTRA["hvv"] = lambda close, kind, I: I["vol180"].where(np.isfinite(I["vol180"]), I["vol90"])
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


def fill(P):  # копия perp_margin.fill (perp_margin при импорте считает свою таблицу)
    for k in range(P.B.C.shape[1]):
        C = P.B.C[:, k]; ok = np.where(np.isfinite(C))[0]
        if not len(ok): continue
        for M in (P.B.C, P.B.LO, P.B.HI):
            for i in range(ok[0] + 1, ok[-1] + 1):
                if not np.isfinite(M[i, k]): M[i, k] = P.B.C[i - 1, k]


ld = lambda f: {"base": 1, "rules": [{"act": r["act"], "conds": r["conds"]} for r in json.load(open(os.path.join(HERE, "found", f)))["rules"]]}  # noqa: E731
VARS = (("combo5", ld("combo5-best.json")), ("hv", ld("hv-best.json")), ("hv2", ld("hv2-best.json")))
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
        coins = [("USELESS36828-USD", "alt"), ("XMR-USD", "alt"), ("ZEC-USD", "alt"), ("FARTCOIN-USD", "alt")]
        P = I6.LP(coins); fill(P); ok = np.where(np.isfinite(P.B.C).any(axis=1))[0]; last = int(ok[-1]); sl = slice(0, last + 1)
        A, G = P.mats(S, all_lag=0); k = I6.cfg(P, WT=(0.5, 0.5), SPL=C3M.SPLIT, hlx=True, hl=2, perp_all=True, fund=0.10 / 365, mino=1.0, minb=1.0)
        MK = np.array([2.0, 1.0, 1.0, 2.0])
        st = [int(s) for s in STARTS if s < last - 90]
        f = lambda s, sv: simb(P.B.C[sl], P.B.LO[sl], P.B.HI[sl], A[sl], G[sl], np.zeros(P.B.C[sl].shape), np.ones(P.B.C[sl].shape), s, P.B.levmat(L), sv,  # noqa: E731
                               0.15 / 365, 0.11 / 365, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0, MK)
        o = [f(s, 1.0) for s in st]; x = np.array([q[1] for q in o]) * 100
        print(f"{nm} | перпы (4 монеты, один счёт) ×{lev}: медиана {np.median(x):+.0f}% | ликв {sum(int(q[0] > 0) for q in o)} | −20%: {sum(int(f(s, 0.8)[0] > 0) for s in st)} | −30%: {sum(int(f(s, 0.7)[0] > 0) for s in st)}", flush=True)
