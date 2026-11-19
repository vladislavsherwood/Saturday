"""wk, круг 4: маржа с «ловушкой для фитилей». Стандарт как lev145.py: плечо ×1,45 (паника и разворот BTC, дно ×2), отложенная паника (k 0, m 2):
(1) маржа на споте (Bybit, залог — весь портфель, ликвидация при активы/долг ≤ 1,1) на пяти портфелях (P9, B, M, P2+BTC, P3+BTC), шорт BTC 20%, займ 11%;
(2) четыре перпа на одном счёте Bybit (USELESS, XMR, ZEC, FARTCOIN): залог — USDT + PnL перпов, ликвидация по поддерживающей марже,
    минимум заявки max($5, 0,01 монеты) при взносах $1 / $2 / $2 / $1, фандинг 10%.
Сдвиги исполнения −1/0/+1, стресс −20/−30% (минимумы дня ниже). Заявки исполняются по настоящему минимуму, а проверка маржи — «в худший момент»
(WST 2): все заявки окна, до которых достал бы минимум со стрессом, считаются исполненными прямо перед проверкой (резерв-залог потрачен,
монеты оценены по минимуму со стрессом). WK_WST=1 — старый вариант (исполнение по минимуму со стрессом даёт ловушке ложную прибыль).
Ловушка тратит свой резерв монеты (USDT, который у перпов — залог). Симулятор — wk_msim.sim6w (копия bybit_msim.sim6 + заявки).
Запуск: python3 app/wk_r4.py [варианты через ;] > scratchpad/wk/r4.log"""
import os, sys, json, time
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo_margin import SETS  # noqa: E402
from agent4d_margin import STARTS, IDX  # noqa: E402
from wk_msim import sim6w  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
PX.POL.update(on=True, k=0.0, m=2.0, A=0)
ST = {"base": 1, "rules": json.load(open(os.path.join(HERE, "found", "combo4-best.json")))["rules"]}
DAYN = np.array([(d - pd.Timestamp("1970-01-01")).days for d in IDX], dtype=np.int64)
LEV = float(os.environ.get("WK_LEV", "1.45"))


def fill(P):  # копия perp_margin.fill (дыры в свечах — ценой вчерашнего закрытия), без запуска perp_margin
    for k in range(P.B.C.shape[1]):
        C = P.B.C[:, k]; ok = np.where(np.isfinite(C))[0]
        if not len(ok): continue
        for M in (P.B.C, P.B.LO, P.B.HI):
            for i in range(ok[0] + 1, ok[-1] + 1):
                if not np.isfinite(M[i, k]): M[i, k] = P.B.C[i - 1, k]


def wage(P, age=60):
    """День (индекс IDX), после которого у монеты ставятся заявки: начало истории монеты + 60 дней."""
    return np.array([(P.B.I[k][0].index[0] - IDX[0]).days + age for k in range(len(P.B.coins))], dtype=np.int64)


LV0 = [(0.25, 0.10), (0.40, 0.20), (0.60, 0.30)]


def wick(lv=LV0, m=1.0, ev=3, exit_=0, gd=0, fee=0.001, mn=1):
    return dict(WK=np.array([k for k, _ in lv], float), WF=np.array([f * m for _, f in lv], float), WEV=int(ev), WEXIT=int(exit_), WGD=int(gd), WFEE=float(fee), WMIN=int(mn))


NONE = dict(WK=np.zeros(0), WF=np.zeros(0), WEV=1, WEXIT=0, WGD=0, WFEE=0.001, WMIN=0)
VARS = {
    "без ловушки": NONE,
    "T0: −25/40/60 → 10/20/30, каждый день": wick(ev=1),
    "F1: −25/40/60 → 10/20/30, раз в 3 дня": wick(),
    "F1 ×1,25: 12,5/25/37,5, раз в 3 дня": wick(m=1.25),
    "F1 + выход к опорной": wick(exit_=1),
    "F1 ×1,5 + выход к опорной": wick(m=1.5, exit_=1),
    "F1, без заявок при займе по монете": wick(gd=1),
    "F1 ×0,5": wick(m=0.5),
    "F1 ×2": wick(m=2.0),
    "F1 −20/35/50": wick(lv=[(0.20, 0.10), (0.35, 0.20), (0.50, 0.30)]),
    "ФИНАЛИСТ −25/40/60 → 15/25/35, раз в 3 дня": wick(lv=[(0.25, 0.15), (0.40, 0.25), (0.60, 0.35)]),
    "финалист, доли ×1,2 (18/30/42)": wick(lv=[(0.25, 0.18), (0.40, 0.30), (0.60, 0.42)]),
    "финалист, уровни −23/37/56": wick(lv=[(0.23, 0.15), (0.37, 0.25), (0.56, 0.35)]),
    "финалист, раз в 2 дня": wick(lv=[(0.25, 0.15), (0.40, 0.25), (0.60, 0.35)], ev=2),
    # круг 6: фитильная продажа +25/40/60 (доли позиции) отдельно и вместе с покупочной ловушкой
    "продажа +25/40/60 → 10/20/30 (без покупок)": dict(NONE, WEV=3, SK=np.array([0.25, 0.40, 0.60]), SF=np.array([0.10, 0.20, 0.30])),
    "финалист + продажа 10/20/30": dict(wick(lv=[(0.25, 0.15), (0.40, 0.25), (0.60, 0.35)]), SK=np.array([0.25, 0.40, 0.60]), SF=np.array([0.10, 0.20, 0.30])),
    "финалист + продажа 5/10/15": dict(wick(lv=[(0.25, 0.15), (0.40, 0.25), (0.60, 0.35)]), SK=np.array([0.25, 0.40, 0.60]), SF=np.array([0.05, 0.10, 0.15])),
}


WSTM = int(os.environ.get("WK_WST", "2"))
E0 = np.zeros(0)


def sim(P, A, G, W, Lm, s, sv, k, rate, MK, WA, w, sl=slice(None)):
    return sim6w(P.B.C[sl], P.B.LO[sl], P.B.HI[sl], A[sl], G[sl], W[sl], np.ones(P.B.C[sl].shape), int(s), Lm, sv, 0.15 / 365, rate,
                 k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0, MK,
                 w["WK"], w["WF"], w["WEV"], DAYN[sl], WA, WSTM, w["WFEE"], w["WEXIT"], w["WMIN"], w["WGD"], w.get("SK", E0), w.get("SF", E0))


def runs(P, S, L, w, perps=False, lags=(-1, 0, 1)):
    """По каждому сдвигу: медиана, худший старт, ликвидации (без стресса / −20% / −30%), мин. запас, траты ловушки (медиана, % вложенного)."""
    WA = wage(P); Lm = P.B.levmat(L); out = {}
    if perps:
        ok = np.where(np.isfinite(P.B.C).any(axis=1))[0]; last = int(ok[-1]); sl = slice(0, last + 1)
        st = [int(s) for s in STARTS if s < last - 90]
        k = I6.cfg(P, WT=(0.5, 0.5), SPL=C3M.SPLIT, hlx=True, hl=2, perp_all=True, fund=0.10 / 365, mino=1.0, minb=1.0)
        MK = np.array([2.0, 1.0, 1.0, 2.0]); rate = 0.11 / 365
    else:
        sl = slice(None); st = [int(s) for s in STARTS]
        k = I6.cfg(P, WT=(0.5, 0.5), SPL=C3M.SPLIT); MK = np.ones(len(P.B.coins)); rate = 0.11 / 365
    for lag in lags:
        A, G = P.mats(S, all_lag=lag)
        W = np.zeros(P.B.C.shape)
        if not perps:
            W = P.W * 0.2
            if lag: W = I6.sh(W, lag, 0.0)
        R = [sim(P, A, G, W, Lm, s, 1.0, k, rate, MK, WA, w, sl) for s in st]
        x = np.array([q[1] for q in R]) * 100
        o = {"med": float(np.median(x)), "worst": float(x.min()), "liq": int(sum(q[0] > 0 for q in R)), "lvl": float(min(q[2] for q in R)),
             "wsp": float(np.median([q[6] for q in R]) * 100), "wcnt": float(np.median([q[7] for q in R]))}
        o["l20"] = int(sum(sim(P, A, G, W, Lm, s, 0.8, k, rate, MK, WA, w, sl)[0] > 0 for s in st))
        o["l30"] = int(sum(sim(P, A, G, W, Lm, s, 0.7, k, rate, MK, WA, w, sl)[0] > 0 for s in st))
        o["lvl30"] = float(min(sim(P, A, G, W, Lm, s, 0.7, k, rate, MK, WA, w, sl)[2] for s in st[::3]))
        out[lag] = o
    return out


if __name__ == "__main__":
    want = sys.argv[1].split(";") if len(sys.argv) > 1 else list(VARS)
    S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", lp=LEV, lr=LEV)
    PS = {pn: I6.LP(SETS[pn]) for pn in SETS}
    PP = I6.LP([("USELESS36828-USD", "alt"), ("XMR-USD", "alt"), ("ZEC-USD", "alt"), ("FARTCOIN-USD", "alt")]); fill(PP)
    t0 = time.time(); RES = {}
    for nm in want:
        w = VARS[nm]; row = {}
        bad, lv, lv30, ms = [], 99.0, 99.0, []
        for pn, P in PS.items():
            o = runs(P, S, L, w); row[pn] = o
            for lag, q in o.items():
                lv = min(lv, q["lvl"]); lv30 = min(lv30, q["lvl30"])
                if q["liq"] or q["l20"] or q["l30"]: bad.append(f"{pn} сдвиг {lag}: {q['liq']}/{q['l20']}/{q['l30']}")
            ms.append(f"{pn} {o[-1]['med']:+.0f}/{o[0]['med']:+.0f}/{o[1]['med']:+.0f} (лов. {o[0]['wsp']:.1f}%)")
        print(f"[{nm}] спот-маржа ×{LEV}: {'0 ликв.' if not bad else 'ЛИКВ ' + '; '.join(bad)} | запас {lv:.2f} (при −30%: {lv30:.2f}) | " + " | ".join(ms), flush=True)
        o = runs(PP, S, L, w, perps=True); row["perps"] = o
        print(f"[{nm}] перпы 4 монеты ×{LEV}: " + " | ".join(f"сдвиг {lag:+d}: медиана {q['med']:+.0f}% худший {q['worst']:+.0f}% ликв {q['liq']}/−20% {q['l20']}/−30% {q['l30']} запас {q['lvl']:.2f} (−30%: {q['lvl30']:.2f}) лов. {q['wsp']:.1f}% ({q['wcnt']:.0f} исп.)" for lag, q in o.items()) + f" [{time.time() - t0:.0f} с]", flush=True)
        RES[nm] = row
    json.dump(RES, open(os.environ.get("WK_OUT", "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/wk/r4.json"), "w"), ensure_ascii=False, default=float)
