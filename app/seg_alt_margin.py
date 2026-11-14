"""Агент «АЛЬТЫ», круг 10: портфель с маржой на пяти портфелях (P9, B, M, P2+BTC, P3+BTC) для основы (combo-best) и кандидатов агента
(правила только для альтов: флаг isalt по тикеру — не крупная монета, не мем, не стейбл). Схемы как в combo-best-margin.json: R16 + A4 ×1,4
(60 дн) + шорт BTC 20% (лучшая), R16 + A4 ×1,3 + шорт 15% (средняя), R16 + A4 ×1,25 + шорт 10% (осторожная), без плеча.
Требование: 0 ликвидаций в срок и на день позже, стресс −20/−30% и +20/+30% для шорта, на всех пяти портфелях.
Запуск: python3 app/seg_alt_margin.py <кандидаты.json> <out.json> [названия кандидатов через «|»]"""
import sys, os, json, re, time
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from combo_margin import Port, SETS, scheme, full, fmt

LARGE = ["BTC", "ETH", "BNB", "XRP", "SOL", "TRX", "ADA"]
MEME = ["DOGE", "SHIB", "PEPE", "WIF", "BONK", "FLOKI", "PUMP", "FARTCOIN", "ELON", "NPC", "PENGU", "TIBBIR", "MOG", "APEPE", "BANANAS31", "JELLYJELLY", "KIMCHI"]
NOT = set(LARGE + MEME + ["ZCHF"])
name = lambda sym: re.sub(r"\d*-USD$", "", sym)                      # noqa: E731


def with_alt(P):
    """Добавляет индикатор isalt (1 у альтов) в кэш индикаторов портфеля."""
    for k, (sym, _) in enumerate(P.B.coins):
        I = P.B.ind(k); I["isalt"] = pd.Series(0.0 if name(sym) in NOT else 1.0, index=I["fng"].index)
    return P


R = dict(lr=1.5)
CFG = [("без плеча", dict(lev=False), 0.0), ("ОСТОРОЖНАЯ: R16 + A4 ×1,25 + шорт 10%", dict(D=60, lp=1.25, **R), 0.1),
       ("СРЕДНЯЯ: R16 + A4 ×1,3 + шорт 15%", dict(D=60, lp=1.3, **R), 0.15), ("ЛУЧШАЯ: R16 + A4 ×1,4 + шорт 20%", dict(D=60, lp=1.4, **R), 0.2)]
if __name__ == "__main__":
    C = json.load(open(sys.argv[1])); out = sys.argv[2]
    names = sys.argv[3].split("|") if len(sys.argv) > 3 else list(C)
    PS = {k: with_alt(Port(v)) for k, v in SETS.items()}
    print({k: [(name(s), name(s) not in NOT) for s, _ in v.B.coins] for k, v in PS.items()}, flush=True)
    RES = {}; t = time.time()
    for nm in names:
        S0 = C[nm]
        for tag, kw, sh in CFG:
            S, L = scheme(S0, **kw); row = {}
            for pn, P in PS.items():
                row[pn] = full(P, S, L, sh)
            RES[f"{nm} | {tag}"] = row
            ok = all(o["safe"] for o in row.values())
            print(f"{'OK ' if ok else '✘  '}{nm} | {tag} [{time.time() - t:.0f} с]\n" + "\n".join(f"     {pn:8s} {fmt(o)}" for pn, o in row.items()), flush=True)
            json.dump(RES, open(out, "w"), ensure_ascii=False)
