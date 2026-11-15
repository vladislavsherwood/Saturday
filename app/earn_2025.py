"""Портфель пользователя с 1 января 2025: суммы и режимы из приложения.
Спот (без плеча) — по плану combo4 из сборки приложения (SNAP в dca-app.html: эффективный план с отложенной паникой), как бэктест страницы.
Перпы (USELESS, XMR, ZEC) — sim6 Bybit (bybit_msim: перпы, схема ×1,5, сделки 50/50, минимум открытия max($5, 0,01 монеты), продажи шагом 0,01).
Запуск: python3 app/earn_2025.py <dca-app.html>"""
import os, sys, re, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

START = "2025-01-01"
UNITS = {"ETH-USD": 3, "SOL-USD": 3, "BTC-USD": 2, "XMR-USD": 2, "DOGE-USD": 2, "PEPE24478-USD": 2, "ENA-USD": 2, "ZEC-USD": 2, "PENGU34466-USD": 2,
         "HYPE32196-USD": 1, "PUMP36507-USD": 1, "USELESS36828-USD": 1, "LIT39125-USD": 1}
PERP = {"USELESS36828-USD", "XMR-USD", "ZEC-USD"}
html = open(sys.argv[1], encoding="utf-8").read()
SNAP = json.loads(re.search(r"<script>const SNAP = (.*?);</script>", html, re.S).group(1))
d0 = int(np.datetime64(START, "D").astype(int))
rows = []
for sym, u in UNITS.items():
    h = SNAP["coins"][sym]["h"]; st = next(x for x in h["strategies"] if x["code"] == "combo4")
    t = np.array(h["t"]); c = np.array(h["c"]); a = int(np.searchsorted(t, d0)); n = len(c)
    cash = units = du = inv = 0.0
    for i in range(a, n):
        p = c[i]; x = st["plan"][i - 1] if i > a else 1.0; before = cash; cash += u; inv += u; du += u * 0.999 / p
        if x < 0: amt = -x * units * p; units -= amt / p; cash += amt * 0.999
        else: amt = min(cash, u + (x - 1) * before); units += amt * 0.999 / p; cash -= amt
    rows.append({"sym": sym, "u": u, "from": str(np.datetime64(int(t[a]), "D")), "inv": inv, "spot": cash + units * c[-1], "dca": du * c[-1], "cash": cash})

# перпы: доходность к вложенному из симулятора маржи, применённая к вложенному пользователя
import pxm_margin as PX  # noqa: E402
import combo3_margin as C3M  # noqa: E402
import imp6_common as I6  # noqa: E402
from bybit_msim import sim6  # noqa: E402
from perp_margin import fill, ST  # noqa: E402
from agent4d_margin import IDX  # noqa: E402
PX.POL.update(on=True, k=0.0, m=2.0, A=0)
S, L = C3M.scheme6(ST, sr=1.0, t1grp="off", lp=1.5)
for r in rows:
    if r["sym"] not in PERP: continue
    P = I6.LP([(r["sym"], "alt")]); fill(P); C = P.B.C[:, 0]; ok = np.where(np.isfinite(C))[0]; first, last = int(ok[0]), int(ok[-1]); sl = slice(0, last + 1)
    s = max(first, int(np.searchsorted(np.array(IDX), np.datetime64(START))))
    A, G = P.mats(S, all_lag=0); k = I6.cfg(P, WT=(0.5, 0.5), SPL=C3M.SPLIT, hlx=True, hl=2, perp_all=True, fund=0.10 / 365, mino=1.0, minb=1.0)
    MK = np.array([2.0 / r["u"]])
    f = lambda sv: sim6(P.B.C[sl], P.B.LO[sl], P.B.HI[sl], A[sl], G[sl], np.zeros(P.B.C[sl].shape), np.ones(P.B.C[sl].shape), s, P.B.levmat(L), sv,  # noqa: E731
                        0.15 / 365, 0.11 / 365, k["WT"], k["SPL"], k["FEES"], k["FEEP"], k["PERP"], k["FUND"], k["MINO"], k["MINB"], k["hl"], k["MM"], k["MMSH"], k["LD"], k["XC"], 0.0, MK)
    q = f(1.0); r["perp"] = r["inv"] * (1 + q[1]); r["liq"] = int(q[0]); r["liq30"] = int(f(0.7)[0] > 0); r["lvl"] = q[2]
print(json.dumps(rows))
