"""dms: маржа в днях без сигнала поверх combo4 ×1,45 (как в приложении: scheme6 lp=lr=1,45, дно ×2, отложенная паника; BTC-шорт портфеля 20%).
  A — «DCA в долг»: день без сигнала, монета и BTC ниже 200д → взнос с плечом (группа 6, плечо la).
  B — «DCA-шорт»: день без сигнала, монета и BTC выше 200д → цель шорта монеты растёт на d доли капитала (не больше wmax); режим кончился → шорт закрыть.
      Шорт только у не-BTC монет (у BTC свой портфельный шорт). Стандарт: 0 ликвидаций при сдвигах −1/0/+1 и стрессе −20/−30%.
Запуск: python3 app/dms_m.py [A|B|AB]"""
import os, sys, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import pxm_margin as PX  # noqa: E402  отложенная паника и индикатор возраста
import combo3_margin as C3M  # noqa: E402
from combo3_margin import SETS, LP, cfg, shf, STARTS, sim6, SPLIT  # noqa: E402
from perp_margin import ST  # noqa: E402
import agent4d_margin as A4  # noqa: E402
import agent_margin as AM  # noqa: E402
_ind0 = A4.indicators
_b200 = AM._btc / AM._btc.rolling(200, min_periods=200).mean()


def _ind(close, kind):   # + btc200: BTC к своей 200-дн. средней (как в быстром стенде)
    I = _ind0(close, kind); I["btc200"] = _b200.reindex(close.index, method="ffill"); return I


A4.indicators = _ind

PX.POL.update(on=True, k=0.0, m=2.0, A=0)
c = lambda i, o, v: {"ind": i, "op": o, "v": v}  # noqa: E731
BEAR = [c("sma200", "<", 1.0), c("btc200", "<", 1.0)]
BULL = [c("sma200", ">", 1.0), c("btc200", ">", 1.0)]


def run(P, S, L, lag, Wx=None, shw=0.2, rate=0.11 / 365, WT=(0.5, 0.5)):
    A, G = P.mats(S, all_lag=lag)
    k = cfg(P, WT=WT, SPL=SPLIT)
    W = P.W * shw if shw else np.zeros(P.B.C.shape)
    if shw and lag: W = shf(W, lag, 0.0)
    if Wx is not None: W = W + Wx(P, A, G, lag)
    LM = np.ones(P.B.C.shape); Lm = P.B.levmat(L)
    f = lambda s, sv: sim6(P.B.C, P.B.LO, P.B.HI, A, G, W, LM, int(s), Lm, sv, 0.15 / 365, rate, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"],  # noqa: E731
                           k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0)
    R = [f(s, 1.0) for s in STARTS]; x = np.array([q[1] for q in R]) * 100
    o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "lvl": float(min(q[2] for q in R)), "x": x}
    if o["liq"] == 0:
        o["l20"] = int(sum(f(s, 0.8)[0] > 0 for s in STARTS)); o["l30"] = int(sum(f(s, 0.7)[0] > 0 for s in STARTS))
    return o


def short_dca(d, wmax):
    def Wx(P, A, G, lag):
        Sr = {"base": 0, "rules": [{"act": 5.0, "conds": BULL, "grp": 0}]}
        Ar, _ = P.mats(Sr, all_lag=lag)
        bull = Ar > 4; plain = (A == 1) & (G == 0)
        W = np.zeros(A.shape); btc = [i for i, (s, _) in enumerate(P.B.coins) if s == "BTC-USD"]
        for kk in range(A.shape[1]):
            if kk in btc: continue
            w = 0.0
            for t in range(A.shape[0]):
                if not bull[t, kk]: w = 0.0
                elif plain[t, kk]: w = min(wmax, w + d)
                W[t, kk] = w
        return W
    return Wx


def full(nm, S, L, Wx=None, base=None):
    t0 = time.time(); row = []
    for pn, coins in SETS.items():
        P = PS[pn]; ms, bad, lv = [], [], 99
        for lag in (-1, 0, 1):
            o = run(P, S, L, lag, Wx); ms.append(o["med"]); lv = min(lv, o["lvl"])
            if o["liq"] or o.get("l20") or o.get("l30"): bad.append((lag, o["liq"], o.get("l20"), o.get("l30")))
        row.append((pn, ms, lv, bad))
    txt = " | ".join(f"{pn} {ms[1]:+.0f} ({min(ms):+.0f})" + ("" if not bad else " ЛИКВ") for pn, ms, lv, bad in row)
    lvl = min(r[2] for r in row); ok = all(not r[3] for r in row)
    d = "" if base is None else " | к основе: " + " ".join(f"{np.log((1 + r[1][1] / 100) / (1 + b[1][1] / 100)):+.3f}" for r, b in zip(row, base))
    print(f"{nm:44s} {'0 ликв.' if ok else 'ЛИКВИДАЦИИ ' + str([r[3] for r in row if r[3]])[:120]} запас {lvl:.2f} | {txt}{d} [{time.time() - t0:.0f} с]", flush=True)
    return row


if __name__ == "__main__":
    V = sys.argv[1] if len(sys.argv) > 1 else "AB"
    PS = {k: LP(v) for k, v in SETS.items()}
    S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", lp=1.45, lr=1.45)
    B = full("combo4 ×1,45 (основа)", S, L)
    if "A" in V:
        for la in (1.45, 2.0, 3.0):
            S2 = json.loads(json.dumps(S)); S2["rules"].append({"act": 1.0, "conds": BEAR, "grp": 6}); L2 = list(L); L2[6] = la
            full(f"A: взнос в долг ×{la}, монета и BTC < 200д", S2, L2, base=B)
        for la in (2.0,):
            S2 = json.loads(json.dumps(S)); S2["rules"].append({"act": 1.0, "conds": [c("sma200", "<", 0.8), c("btc200", "<", 1.0)], "grp": 6}); L2 = list(L); L2[6] = la
            full(f"A: взнос в долг ×{la}, монета < 0,8 и BTC < 200д", S2, L2, base=B)
    if "B" in V:
        for d, wm in ((0.002, 0.02), (0.005, 0.05), (0.01, 0.1)):
            full(f"B: DCA-шорт +{d * 100:.1f}%/день до {wm * 100:.0f}% капитала", S, L, short_dca(d, wm), base=B)


def plateau():
    PSl = PS
    S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", lp=1.45, lr=1.45)
    B = full("combo4 ×1,45 (основа)", S, L)
    V = [("монета < 0,9 и BTC < 200д", [c("sma200", "<", 0.9), c("btc200", "<", 1.0)]), ("монета и BTC < 1,1 200д", [c("sma200", "<", 1.1), c("btc200", "<", 1.1)]),
         ("только монета < 200д", [c("sma200", "<", 1.0)]), ("только BTC < 200д", [c("btc200", "<", 1.0)]), ("монета и BTC < 200д", BEAR)]
    for nm, cd in V:
        for la in ((1.3, 1.45, 1.6) if nm == "монета и BTC < 200д" else (1.45,)):
            S2 = json.loads(json.dumps(S)); S2["rules"].append({"act": 1.0, "conds": cd, "grp": 6}); L2 = list(L); L2[6] = la
            full(f"A: взнос в долг ×{la}, {nm}", S2, L2, base=B)
    S2 = json.loads(json.dumps(S)); S2["rules"].append({"act": 1.0, "conds": BEAR, "grp": 6}); L2 = list(L); L2[6] = 1.45
    for rate in (0.15, 0.25):
        o = [run(PS["P9"], S2, L2, 0, rate=rate / 365)["med"], run(PS["P9"], S, L, 0, rate=rate / 365)["med"]]
        print(f"   ставка займа {rate * 100:.0f}% годовых, P9: основа {o[1]:+.0f}% → с взносом в долг {o[0]:+.0f}% ({np.log((1 + o[0] / 100) / (1 + o[1] / 100)):+.3f})", flush=True)


if __name__ == "__main__" and V == "P":
    plateau()


def control():
    S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", lp=1.45, lr=1.45)
    B = full("combo4 ×1,45 (основа)", S, L)
    for nm, cd in (("ВСЕ дни без сигнала", [c("age", ">", -1)]), ("контроль: монета и BTC > 200д", BULL), ("медвежий: монета и BTC < 200д", BEAR)):
        S2 = json.loads(json.dumps(S)); S2["rules"].append({"act": 1.0, "conds": cd, "grp": 6}); L2 = list(L); L2[6] = 1.45
        full(f"взнос в долг ×1.45, {nm}", S2, L2, base=B)


if __name__ == "__main__" and V == "C":
    control()
