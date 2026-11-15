"""imp7: портфель с маржой для кандидата «в медвежьем режиме BTC разворот возвращает половину обычной доли» поверх combo-best.
Стенд combo_margin (agent4d_margin.sim4): пять портфелей P9, B, M, P2+BTC, P3+BTC; в срок и на день позже; стресс −20/−30% (+20/+30% для шорта); ставка 11% и 15%.
Признаки режима rb200 (BTC / средняя 200) и rsl (наклон средней 200 за 30 дней, %) — по полному ряду BTC (agent_margin._btc).
Правка применяется ПОСЛЕ схемы плеча (схема задаёт размер разворота 50% ×1,5): перед каждым правилом разворота (группа 3) — копия с долей ×k и условиями
rb200 < 1, rsl < 0 в той же группе (плечо то же). Основа — combo-best и combo2-best (индикаторы сегментов — импорт combo2_margin).
Сохраняет found/imp7-best-margin.json. Запуск: python3 app/imp7_margin.py [k]"""
import sys, os, json, time
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import agent_margin as AM
from combo_margin import Port, SETS, scheme, full, fmt, c, HERE
import combo2_margin  # noqa: F401  isbig/meme/isalt, vol180, b_bbwp, b_w20 для combo2-best

_b = AM._btc
_s200 = _b.rolling(200).mean()
_rb = _b / _s200
_rsl = (_s200 / _s200.shift(30) - 1) * 100
AM.EXTRA["rb200"] = lambda close, kind, I: _rb.reindex(close.index, method="ffill")
AM.EXTRA["rsl"] = lambda close, kind, I: _rsl.reindex(close.index, method="ffill")

K = float(sys.argv[1]) if len(sys.argv) > 1 else 0.5
BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S0 = {"base": BEST["base"], "rules": BEST["rules"]}
C2 = json.load(open(os.path.join(HERE, "found", "combo2-best.json")))
S2 = {"base": C2["base"], "rules": C2["rules"]}


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
SAVE = {}
for bn, SB in (("combo-best", S0), ("combo2-best", S2)):
    for tag, kw, sh in CFG:
        Sb, L = scheme(SB, **kw)
        for vn, S in ((bn, Sb), (f"{bn} + imp7 ×{K}", bear(Sb))):
            row = {nm: full(P, S, L, sh) for nm, P in PS.items()}
            if kw.get("lev", True) is not False:
                for nm, P in PS.items():
                    row[nm + " 15%"] = full(P, S, L, sh, rate=0.15 / 365)
            RES[f"{vn} | {tag}"] = row
            if vn != bn and kw.get("lev", True) is not False:
                SAVE[f"{vn} | {tag}"] = {"rules_with_sizes": S, "group_leverage": {str(g): v for g, v in enumerate(L)}, "short_size": sh}
            ok = all(o["safe"] for o in row.values())
            print(f"{'OK ' if ok else '✘  '}{vn} | {tag} [{time.time() - t:.0f} с]\n" + "\n".join(f"     {nm:18s} {fmt(o)}" for nm, o in row.items()), flush=True)
out = {"candidate": f"в медвежьем режиме BTC (rb200 < 1 и наклон средней 200 за 30 дн < 0) разворот возвращает долю ×{K} (в схеме R16: 25% резерва вместо 50%, плечо то же ×1,5)",
       "model": "combo_margin.full: пять портфелей, 105 стартов, в срок и на день позже, стресс −20/−30% (+20/+30% шорт), ставка 11% и 15%",
       "results": RES, "schemes": SAVE}
json.dump(out, open(os.path.join(HERE, "found", "imp7-best-margin.json"), "w"), ensure_ascii=False, default=float, indent=1)
