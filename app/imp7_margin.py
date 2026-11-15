"""imp7: портфель с маржой для кандидата «в медвежьем режиме BTC разворот возвращает половину обычной доли» поверх combo-best.
Стенд combo_margin (agent4d_margin.sim4): пять портфелей P9, B, M, P2+BTC, P3+BTC; в срок и на день позже; стресс −20/−30% (+20/+30% для шорта); ставка 11% и 15%.
Признаки режима rb200 (BTC / средняя 200) и rsl (наклон средней 200 за 30 дней, %) — по полному ряду BTC (agent_margin._btc).
Правка применяется ПОСЛЕ схемы плеча (схема задаёт размер разворота 50% ×1,5): перед каждым правилом разворота (группа 3) — копия с долей ×k и условиями
rb200 < 1, rsl < 0 в той же группе (плечо то же). Запуск: python3 app/imp7_margin.py [k]"""
import sys, os, json, time
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import agent_margin as AM
from combo_margin import Port, SETS, scheme, full, fmt, c, HERE

_b = AM._btc
_s200 = _b.rolling(200).mean()
_rb = _b / _s200
_rsl = (_s200 / _s200.shift(30) - 1) * 100
AM.EXTRA["rb200"] = lambda close, kind, I: _rb.reindex(close.index, method="ffill")
AM.EXTRA["rsl"] = lambda close, kind, I: _rsl.reindex(close.index, method="ffill")

K = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S0 = {"base": BEST["base"], "rules": BEST["rules"]}


def bear(S, k=K, grps=(3,)):
    R = []
    for r in S["rules"]:
        if r.get("grp") in grps and r["act"] > 1:
            R.append({**r, "act": round(1 + (r["act"] - 1) * k, 6), "conds": r["conds"] + [c("rb200", "<", 1), c("rsl", "<", 0)]})
        R.append(r)
    return {**S, "rules": R}


R16 = dict(lr=1.5)
CFG = [("без плеча", dict(lev=False), 0.0),
       ("ОСТОРОЖНАЯ: R16 + A4 ×1,25 + шорт 10%", dict(D=60, lp=1.25, **R16), 0.1),
       ("ЛУЧШАЯ: R16 + A4 ×1,4 + шорт 20%", dict(D=60, lp=1.4, **R16), 0.2)]
PS = {k: Port(v) for k, v in SETS.items()}
RES = {}
t = time.time()
for tag, kw, sh in CFG:
    Sb, L = scheme(S0, **kw)
    for vn, S in (("основа", Sb), (f"imp7 ×{K}", bear(Sb))):
        row = {nm: full(P, S, L, sh) for nm, P in PS.items()}
        if "ЛУЧШАЯ" in tag:
            for nm, P in PS.items():
                row[nm + " 15%"] = full(P, S, L, sh, rate=0.15 / 365)
        RES[f"{vn} | {tag}"] = row
        ok = all(o["safe"] for o in row.values())
        print(f"{'OK ' if ok else '✘  '}{vn} | {tag}\n" + "\n".join(f"     {nm:18s} {fmt(o)}" for nm, o in row.items()), flush=True)
print(f"{time.time() - t:.0f} c")
json.dump(RES, open(os.path.join("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp7", f"margin_{K}.json"), "w"), default=float)
