"""combo3: маржа на пяти портфелях (P9, B, M, P2+BTC, P3+BTC) — модель «спот — залог» (Bybit, спотовая маржа с залогом всего портфеля):
кросс-маржа, ликвидация при активы/долг ≤ 1,1 по минимуму дня (sim4 → imp6 sim5 → combo3_msim.sim6 с доходом на резерв).
Исполнение: решение по закрытию дня t−1 исполняется по закрытию дня t («в срок», т. е. в конце дня после дня решения, ~23:30–23:55 UTC);
проверка безопасности при сдвигах −1 (по закрытию дня решения) / 0 / +1 день; стресс −20/−30% (максимумы +20/+30% для шорта); ставки 11 и 15%.
Схема с параметрами (tune5 scheme5 + imp6 размазывание): дно sb резерва ×lb; паника доли ×sp (не больше резерва), плечо lp, без плеча, пока с максимума
BTC < D дней (A4); разворот sr резерва ×lr; отложенная sd без плеча; шорт BTC доля sh (жадность > 75 до дна или разворота); WT — доли сигнала по дням
(50/50 — половина в день исполнения, половина на следующий; группы дно, паника, продажи — как imp6). t1grp — группа правила «OI < −26 → 15%»:
0 — 15% без плеча (своё), 1 — как дно (25% ×2).
Запуск: python3 app/combo3_margin.py <стратегии.json> <задания.json> <выход.json>"""
import os, sys, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import combo2_margin as CM  # noqa: F401,E402  индикаторы и флаги монет (isbig/meme/isalt, corr180, vol180)
from combo_margin import SETS, c, LEV2  # noqa: E402
from agent2_margin import sized, grouped  # noqa: E402
from agent2_loop2 import su_sized  # noqa: E402
from agent4a_loop7 import split  # noqa: E402
from imp6_common import LP, cfg, sh as shf  # noqa: E402
from agent4d_margin import STARTS  # noqa: E402
from combo3_msim import sim6  # noqa: E402

SPLIT = [1 if g in (1, 2, 5, 7, 4) else 0 for g in range(8)]


def is_t1(r):
    return len(r["conds"]) == 1 and r["conds"][0]["ind"] == "oidd30" and r["conds"][0]["v"] == -26 and r["act"] > 1


def scheme6(S0, sb=0.25, lb=2.0, sp=2.0, lp=1.35, D=60, sr=1.0, lr=1.5, sd=0.5, lev=True, t1grp=0, **_):
    S0 = json.loads(json.dumps(S0))
    if t1grp == 0:
        for r in S0["rules"]:
            if is_t1(r):
                r["grp"] = 0
    if not lev:
        return grouped(S0), [1.0] * 8
    S = su_sized(sized(S0, sb, sp, sr, sd), "K1"); L = list(LEV2); L[1] = lb; L[3] = lr
    if D:
        S = split(S, c("btcdays", "<", D), 5, 1.0); L[5] = 1.0
    L[2] = lp; L[7] = lp
    return S, L


def run6(P, S, L, shw=0.0, lag=0, rate=0.11 / 365, WT=(1.0,), yld=0.0, stress=True, sh_rate=0.15 / 365):
    A, G = P.mats(S, all_lag=lag)
    SPL = SPLIT if len(WT) > 1 else [0] * 8
    k = cfg(P, WT=WT, SPL=SPL)
    W = P.W * shw if shw else np.zeros(P.B.C.shape)
    if shw and lag: W = shf(W, lag, 0.0)
    LM = np.ones(P.B.C.shape); Lm = P.B.levmat(L)
    f = lambda s, sv: sim6(P.B.C, P.B.LO, P.B.HI, A, G, W, LM, int(s), Lm, sv, sh_rate, rate, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"],  # noqa: E731
                           k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], yld / 365)
    R = [f(s, 1.0) for s in STARTS]
    x = np.array([q[1] for q in R]) * 100
    o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)),
         "worst": float(x.min()), "_x": x}
    if stress and o["liq"] == 0:
        for sv, key in ((0.8, "l20"), (0.7, "l30")):
            o[key] = int(sum(f(s, sv)[0] > 0 for s in STARTS))
    return o


def full6(P, S, L, shw, rate, WT, yld, lags=(-1, 0, 1)):
    ms, bad, lv, p10, worst, x0 = [], [], 99.0, None, None, None
    for lag in lags:
        o = run6(P, S, L, shw, lag, rate, WT, yld)
        ms.append(round(o["med"], 1)); lv = min(lv, o["lvl"])
        if lag == 0:
            p10 = round(o["p10"], 1); worst = round(o["worst"], 1); x0 = o["_x"]
        if o["liq"] or o.get("l20") or o.get("l30"):
            bad.append([lag, o["liq"], o.get("l20"), o.get("l30")])
    return {"m-1": ms[0], "m0": ms[1], "m+1": ms[2], "mean": round(float(np.mean(ms)), 1), "min": min(ms), "p10": p10, "worst_start": worst,
            "lvl": round(min(lv, 99), 3), "liq": bad, "safe": not bad}


if __name__ == "__main__":
    ST = json.load(open(sys.argv[1])); JOBS = json.load(open(sys.argv[2])); out = sys.argv[3]
    PS = {k: LP(v) for k, v in SETS.items()}
    RES = json.load(open(out)) if os.path.exists(out) else {}
    t = time.time()
    for job in JOBS:
        key = job["name"]
        if key in RES:
            continue
        S, L = scheme6(ST[job["strategy"]], **job.get("m", {}))
        WT = tuple(job.get("WT", (1.0,))); shw = job.get("sh", 0.0)
        row = {}
        for pn, P in PS.items():
            for rate in job.get("rates", [0.11]):
                for yld in job.get("ylds", [0.0]):
                    row[f"{pn} | {int(rate * 100)}% | доход {yld * 100:g}%"] = full6(P, S, L, shw, rate / 365, WT, yld)
        ok = all(o["safe"] for o in row.values())
        RES[key] = {"job": job, "ok": ok, "row": row}
        print(f"{'OK' if ok else '✘ '} {key} [{time.time() - t:.0f} с]", flush=True)
        for k, o in row.items():
            print(f"     {k:28s} −1/0/+1: {o['m-1']:+.0f}/{o['m0']:+.0f}/{o['m+1']:+.0f} (ср. {o['mean']:+.0f}, мин {o['min']:+.0f}) | худшие 10% {o['p10']:+.0f} | худший старт {o['worst_start']:+.0f} | запас {o['lvl']:.2f} | {'0 ликв.' if o['safe'] else 'ЛИКВ ' + str(o['liq'])}", flush=True)
        json.dump(RES, open(out, "w"), ensure_ascii=False, default=float)
