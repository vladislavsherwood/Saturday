"""Маржа (Bybit, combo3_margin) с «отложенной паникой» (panicx-best: A 540, t 0,98, k 0,25, выдача upk10 < 0,965 или конец эпизода;
сильная паника usdt > 1,2 не откладывается). Перенос делается в матрице действий: по каждой монете — модель резерва в долях
(взнос 1/день, доли плана схемы), день отложенной паники тратит долю × k, остаток копится в «долге»; долг выдаётся в первый день
покупки/взноса с upk10 < 0,965 или в конце эпизода (через GAP = 10 дней без паники); выдача идёт с группой плеча последней отложенной покупки.
Запуск: python3 app/pxm_margin.py <выход.json> [быстро]"""
import os, sys, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from combo_margin import SETS  # noqa: E402

POL = {"on": False, "A": 540, "t": 0.98, "k": 0.25, "rv": 0.965, "su": 1.2}
GAP = 10


def isP(r):
    return r["act"] > 1 and any(q["ind"] == "usdt" for q in r["conds"])


def defer(B, S, A, G, RI):
    usdt = B.series("usdt"); othd = B.series("othd"); C = B.C
    n, K = C.shape; A = A.copy(); G = G.copy()
    pidx = np.array([isP(r) for r in S["rules"]] + [False])
    stat = {"deferred_days": 0, "release_days": 0}
    for k in range(K):
        u = usdt[:, k]; ok = np.isfinite(C[:, k])
        if not ok.any():
            continue
        first = int(np.argmax(ok))
        upk = np.full(n, np.nan)
        for i in range(n):
            w = u[max(0, i - 9):i + 1]; w = w[np.isfinite(w)]
            if len(w) and np.isfinite(u[i]): upk[i] = u[i] / w.max()
        on = (u > 1.07) & (othd[:, k] < 25)
        last = -10 ** 9; pend = np.zeros(n, bool)
        for i in range(n):
            if on[i]: last = i
            elif i - last == GAP: pend[i] = True
        r = 0.0; units = 0.0; owed = 0.0; gL = 2
        for t in range(first, n - 1):
            p = C[t + 1, k]
            if not np.isfinite(p) or p <= 0:
                continue
            before = r; r += 1.0; a = A[t, k]; ri = RI[t, k]
            if a < 0:
                amt = -a * units * p; units -= amt / p; r += amt * 0.999
            else:
                extra = (a - 1) * before
                if ri >= 0 and pidx[ri] and (t - first) > POL["A"] and upk[t] >= POL["t"] and not (u[t] > POL["su"]):
                    owed = min(before, owed + extra * (1 - POL["k"])); extra *= POL["k"]; gL = G[t, k]; stat["deferred_days"] += 1
                rel = 0.0
                if owed > 0 and (upk[t] < POL["rv"] or pend[t]):
                    rel = owed; owed = 0.0; stat["release_days"] += 1
                    if not (ri >= 0 and a > 1 and G[t, k] != 0): G[t, k] = gL
                amt = min(r, 1.0 + extra + rel); units += amt * 0.999 / p; r -= amt
                if before > 1e-9 and a > 0: A[t, k] = 1.0 + (amt - 1.0) / before
            if pend[t]: owed = 0.0
    return A, G, stat


_orig = I6.LP.plan3


def plan3(self, S):
    key = ("pxm" if POL["on"] else "") + json.dumps(POL) + json.dumps(S, sort_keys=True)
    if key not in self._p:
        A, G, RI = _orig(self, S)
        if POL["on"]:
            A, G, st = defer(self.B, S, A, G, RI); self.stat = st
        self._p[key] = (A, G, RI)
    return self._p[key]


I6.LP.plan3 = plan3

if __name__ == "__main__":
    out = sys.argv[1]; quick = len(sys.argv) > 2
    ST = json.load(open(os.path.join(C3M.HERE if hasattr(C3M, "HERE") else os.path.dirname(__file__), "found", "combo3-best.json")))
    PS = {k: I6.LP(v) for k, v in SETS.items()}
    JOBS = [("ОСНОВНАЯ 50/50 ×1,3 + разворот ×1,5 + шорт 20%", {"lp": 1.3, "sr": 1.0, "t1grp": "off"}, 0.2, (0.5, 0.5)),
            ("ОСТОРОЖНАЯ 50/50 ×1,25 + шорт 10%", {"lp": 1.25, "sr": 1.0, "t1grp": "off"}, 0.1, (0.5, 0.5)),
            ("без размазывания ×1,35 + шорт 20%", {"lp": 1.35, "sr": 1.0, "t1grp": "off"}, 0.2, (1.0,)),
            ("без плеча", {"lev": False, "t1grp": "off"}, 0.0, (1.0,))]
    if quick: JOBS = JOBS[:1]
    RES = json.load(open(out)) if os.path.exists(out) else {}
    t0 = time.time()
    for nm, m, shw, WT in JOBS:
        for pol in (False, True):
            key = f"{nm} | {'отложенная паника' if pol else 'основа'}"
            if key in RES: continue
            POL["on"] = pol
            S, L = C3M.scheme6(ST, **m); row = {}
            for pn, P in PS.items():
                row[pn] = C3M.full6(P, S, L, shw, 0.11 / 365, WT, 0.0)
                if pol: row[pn]["stat"] = getattr(P, "stat", None)
            RES[key] = row; json.dump(RES, open(out, "w"), ensure_ascii=False, default=float)
            print(f"{key} [{time.time() - t0:.0f} с]", flush=True)
            for pn, o in row.items():
                print(f"   {pn:7s} −1/0/+1: {o['m-1']:+.0f}/{o['m0']:+.0f}/{o['m+1']:+.0f} | худший старт {o['worst_start']:+.0f} | запас {o['lvl']:.2f} | "
                      f"{'0 ликв.' if o['safe'] else 'ЛИКВ ' + str(o['liq'])}", flush=True)
