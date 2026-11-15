"""imp4 (копия combo2_margin.py, только лучшая схема): портфель с маржой (combo_margin.Port, стенд агента 4D) на пяти портфелях (P9, B, M, P2+BTC, P3+BTC) для основы и вариантов
объединения сегментных правил. Индикаторы монеты: corr180 (agent3_margin), vol180 (как у агента «крупные»), флаги единых списков combo2_sim.js
(isbig — 9 крупных, meme — 18 мемов, isalt — остальные кроме стейблов), b_bbwp/b_w20 — как в ta_margin2.py (для варианта с TA).
Схемы: без плеча; осторожная R16 + A4 ×1,25 + шорт BTC 10%; средняя A4 ×1,3 + шорт 15%; лучшая A4 ×1,4 + шорт 20%; край A4 ×1,45 + шорт 20%.
Каждая — ставка 11% и 15% годовых; в срок и на день позже; стресс −20/−30% (и +20/+30% для шорта).
Запуск: python3 app/combo2_margin.py <кандидаты.json> <выход.json> [названия через «;»]"""
import os, sys, re, json, time
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_margin import Port, SETS, scheme, full, fmt  # noqa: E402
import agent_margin as AM  # noqa: E402
import agent4d_margin as A4D  # noqa: E402

BIG = {"BTC", "ETH", "BNB", "XRP", "SOL", "TRX", "ADA", "LTC", "BCH"}
MEME = {"DOGE", "PUMP", "SHIB", "PEPE", "BONK", "WIF", "FLOKI", "FARTCOIN", "ELON", "NPC", "PENGU", "TIBBIR", "B", "APEPE", "MOG", "BANANAS31", "JELLYJELLY", "NOT"}
STABLE = {"ZCHF"}
name = lambda sym: re.sub(r"\d*-USD$", "", sym)  # noqa: E731
seg = lambda nm: "big" if nm in BIG else "meme" if nm in MEME else "stable" if nm in STABLE else "alt"  # noqa: E731
AM.EXTRA["vol180"] = lambda close, kind, I: np.log(close / close.shift(1)).rolling(180, min_periods=144).std(ddof=0) * np.sqrt(365) * 100
# TA (агент «теханализ», ta_margin2.py): перцентиль ширины полос Боллинджера BTC за 180 дней и BTC к 20-недельной средней
_b = AM._btc.dropna(); _s20 = _b.rolling(20).mean(); _bbw = 4 * _b.rolling(20).std(ddof=0) / _s20
_bbwp = _bbw.rolling(180, min_periods=145).apply(lambda a: np.sum(a[~np.isnan(a)] < a[-1]) / np.sum(~np.isnan(a)), raw=True)
_w20 = _b / _b[_b.index.dayofweek == 6].rolling(20, min_periods=20).mean().reindex(_b.index, method="ffill")
AM.EXTRA["b_bbwp"] = lambda close, kind, I: _bbwp.reindex(close.index, method="ffill")
AM.EXTRA["b_w20"] = lambda close, kind, I: _w20.reindex(close.index, method="ffill")
_ind0 = A4D.Book.ind


def _ind(self, k):
    I = _ind0(self, k)
    if "isalt" not in I:
        idx = I["fng"].index; s = seg(name(self.coins[k][0]))
        for key, v in (("isbig", s == "big"), ("meme", s == "meme"), ("isalt", s == "alt")):
            I[key] = pd.Series(1.0 if v else 0.0, index=idx)
    return I


A4D.Book.ind = _ind
R = dict(lr=1.5)
CFG = [("ЛУЧШАЯ: R16 + A4 ×1,4 + шорт 20%", dict(D=60, lp=1.4, **R), 0.2)]
if __name__ == "__main__":
    C = json.load(open(sys.argv[1])); out = sys.argv[2]
    names = sys.argv[3].split(";") if len(sys.argv) > 3 else list(C)
    PS = {k: Port(v) for k, v in SETS.items()}
    print({k: [(name(s), seg(name(s))) for s, _ in v] for k, v in SETS.items()}, flush=True)
    RES = {}; t = time.time()
    for vn in names:
        S0 = C[vn]
        for tag, kw, sh in CFG:
            S, L = scheme(S0, **kw); row = {}
            for pn, P in PS.items():
                row[pn] = full(P, S, L, sh)
                if kw.get("lev", True) is not False:
                    pass
            RES[f"{vn} | {tag}"] = row
            ok = all(o["safe"] for o in row.values())
            print(f"{'OK ' if ok else '✘  '}{vn} | {tag} [{time.time() - t:.0f} с]\n" + "\n".join(f"     {pn:20s} {fmt(o)}" for pn, o in row.items()), flush=True)
            json.dump(RES, open(out, "w"), ensure_ascii=False, default=float)
