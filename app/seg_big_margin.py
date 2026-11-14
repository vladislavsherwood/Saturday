"""Агент «крупные монеты»: портфель с маржой (combo_margin.Port, пять портфелей) для основы combo-best и вариантов B65 / «список|B65».
Добавляет индикаторы vol180 (годовая волатильность дневных лог-доходностей за 180 дней, %; не меньше 80% окна) и isbig (1 для BTC, ETH, BNB,
XRP, SOL, TRX, ADA, LTC, BCH по тикеру). corr180 — из agent3_margin. Правила вариантов берутся из файла кандидатов (JSON {название: стратегия}).
Запуск: python3 app/seg_big_margin.py <кандидаты.json> [<выход.json>]"""
import os, sys, json, time
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_margin import Port, SETS, scheme, full, fmt  # noqa: E402
import agent_margin as AM  # noqa: E402
import agent4d_margin as A4D  # noqa: E402

BIG = {"BTC", "ETH", "BNB", "XRP", "SOL", "TRX", "ADA", "LTC", "BCH"}
AM.EXTRA["vol180"] = lambda close, kind, I: np.log(close / close.shift(1)).rolling(180, min_periods=144).std(ddof=0) * np.sqrt(365) * 100
_ind0 = A4D.Book.ind


def _ind(self, k):
    I = _ind0(self, k)
    if "isbig" not in I:
        close = self.I[k][0]; I["isbig"] = pd.Series(1.0 if self.coins[k][0].split("-")[0] in BIG else 0.0, index=close.index)
    return I


A4D.Book.ind = _ind
C = json.load(open(sys.argv[1]))
OUT = sys.argv[2] if len(sys.argv) > 2 else None
R = dict(lr=1.5)
CFG = [("без плеча", dict(lev=False), 0.0),
       ("ОСТОРОЖНАЯ: R16 + A4 ×1,25 + шорт 10%", dict(D=60, lp=1.25, **R), 0.1),
       ("ЛУЧШАЯ: R16 + A4 ×1,4 + шорт 20%", dict(D=60, lp=1.4, **R), 0.2)]
PS = {k: Port(v) for k, v in SETS.items()}
RES = {}; t = time.time()
for vn, S0 in C.items():
    for tag, kw, sh in CFG:
        S, L = scheme(S0, **kw); row = {}
        for nm, P in PS.items():
            row[nm] = full(P, S, L, sh)
        RES[f"{vn} | {tag}"] = row
        ok = all(o["safe"] for o in row.values())
        print(f"{'OK ' if ok else '✘  '}{vn} | {tag} [{time.time() - t:.0f} с]\n" + "\n".join(f"     {nm:8s} {fmt(o)}" for nm, o in row.items()), flush=True)
if OUT:
    json.dump(RES, open(OUT, "w"), ensure_ascii=False, indent=1)
