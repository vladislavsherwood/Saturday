"""Агент «МЕМЫ», круг 9: маржа на пяти портфелях (P9, B, M, P2+BTC, P3+BTC) для основы (combo-best.json) и выбора P35 + CM2
(мемы: паника только взносом, пока монета ближе 35% к своему 90-дн. максимуму; слабый мем (rel180 < −15) — продажи ×2 вместо ×1,25).
Стенд — combo_margin.py (agent4d_margin.Book/sim4); добавлены индикаторы монеты: meme (1 у DOGE, PEPE, PUMP, SHIB, WIF, BONK, FLOKI, FARTCOIN —
список agent4d_margin.MEMES совпадает с мемами агента среди монет портфелей) и ddm90 = просадка закрытия от максимума за 90 дней, %.
Схемы: без плеча, осторожная (R16 + A4 ×1,25 + шорт 10%), средняя (A4 ×1,3 + шорт 15%), лучшая (A4 ×1,4 + шорт 20%), край (A4 ×1,45 + шорт 20%).
Запуск: python3 app/seg_meme_margin.py <rules.json> <out.json>"""
import sys, os, json, time
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_margin import Port, SETS, scheme, full, fmt, HERE
import agent4d_margin
from agent4d_margin import Book, MEMES

_ind0 = Book.ind


def _ind(self, k):
    if k not in self._ind:
        I = _ind0(self, k); close = self.I[k][0]
        I["meme"] = pd.Series(1.0 if self.coins[k][0] in MEMES else 0.0, index=close.index)
        I["ddm90"] = (1 - close / close.rolling(90, min_periods=1).max()) * 100
    return self._ind[k]


Book.ind = _ind
BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S_base = {"base": BEST["base"], "rules": BEST["rules"]}
S_new = json.load(open(sys.argv[1]))
R = dict(lr=1.5)
CFG = [("без плеча", dict(lev=False), 0.0), ("ОСТОРОЖНАЯ: R16 + A4 ×1,25 + шорт 10%", dict(D=60, lp=1.25, **R), 0.1),
       ("СРЕДНЯЯ: R16 + A4 ×1,3 + шорт 15%", dict(D=60, lp=1.3, **R), 0.15), ("ЛУЧШАЯ: R16 + A4 ×1,4 + шорт 20%", dict(D=60, lp=1.4, **R), 0.2),
       ("край: R16 + A4 ×1,45 + шорт 20%", dict(D=60, lp=1.45, **R), 0.2)]
PS = {k: Port(v) for k, v in SETS.items()}
print("мемы в портфелях:", {k: [s for s, _ in v if s in MEMES] for k, v in SETS.items()}, flush=True)
RES = {}; t = time.time()
for vn, S0 in (("основа F + C1.25 + C6", S_base), ("P35 + CM2", S_new)):
    for tag, kw, sh in CFG:
        S, L = scheme(S0, **kw); row = {}
        for nm, P in PS.items():
            row[nm] = full(P, S, L, sh)
            if "ЛУЧШАЯ" in tag:
                row[nm + " ставка 15%"] = full(P, S, L, sh, rate=0.15 / 365)
        RES[f"{vn} | {tag}"] = row
        ok = all(o["safe"] for o in row.values())
        print(f"{'OK ' if ok else '✘  '}{vn} | {tag} [{time.time() - t:.0f} с]\n" + "\n".join(f"     {nm:22s} {fmt(o)}" for nm, o in row.items()), flush=True)
        json.dump(RES, open(sys.argv[2], "w"), ensure_ascii=False, default=float)
