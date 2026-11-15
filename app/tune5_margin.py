"""tune5: шлифовка параметров маржи combo2 (found/combo2-best-margin.json, лучшая схема R16 + A4 ×1,4 + шорт BTC 20%).
Схема с параметрами: дно sb резерва ×lb; паника доли ×sp (не больше резерва), плечо lp, без плеча пока с максимума BTC < D дней (A4);
разворот sr резерва ×lr; отложенная sd без плеча; шорт BTC доля sh (вход жадность > 75 — не трогаю, это часть imp9).
Пять портфелей (P9, B, M, P2+BTC, P3+BTC), в срок и на день позже, стресс −20/−30% (+20/+30% для шорта), ставки 11% и 15%.
Запуск: python3 app/tune5_margin.py <варианты.json> <выход.json>; варианты — {имя: {"S": стратегия или null (combo2), "m": {параметры}}}"""
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import combo2_margin as CM  # noqa: F401,E402  индикаторы и флаги монет
from combo_margin import Port, SETS, full, HERE, c  # noqa: E402
from agent2_margin import sized  # noqa: E402
from agent2_loop2 import su_sized  # noqa: E402
from agent4a_loop7 import split  # noqa: E402
from combo_margin import LEV2  # noqa: E402

BEST = json.load(open(os.path.join(HERE, "found", "combo2-best.json")))
S_C2 = {"base": BEST["base"], "rules": BEST["rules"]}
DEF = dict(sb=0.25, lb=2.0, sp=2.0, lp=1.4, D=60, sr=0.5, lr=1.5, sd=0.5, sh=0.2)


def scheme5(S0, sb, lb, sp, lp, D, sr, lr, sd, **_):
    S = su_sized(sized(S0, sb, sp, sr, sd), "K1"); L = list(LEV2); L[1] = lb; L[3] = lr
    if D:
        S = split(S, c("btcdays", "<", D), 5, 1.0); L[5] = 1.0
    L[2] = lp; L[7] = lp
    return S, L


if __name__ == "__main__":
    V = json.load(open(sys.argv[1])); out = sys.argv[2]
    PS = {k: Port(v) for k, v in SETS.items()}
    RES = json.load(open(out)) if os.path.exists(out) else {}
    t = time.time()
    for vn, o in V.items():
        if vn in RES: continue
        m = {**DEF, **o.get("m", {})}; S0 = o.get("S") or S_C2
        S, L = scheme5(S0, **m); row = {}
        for pn, P in PS.items():
            for rate, sfx in ((0.11 / 365, ""), (0.15 / 365, " 15%")):
                r = full(P, S, L, m["sh"], rate=rate)
                row[pn + sfx] = {k: r[k] for k in ("m0", "m1", "p10", "lvl", "safe", "liq", "worst_start")}
        ok = all(x["safe"] for x in row.values()); nl = sum(sum(v or 0 for v in x["liq"]) for x in row.values())
        RES[vn] = {"m": m, "ok": ok, "nliq": nl, "row": row}
        print(f"{'OK' if ok else '✘ '} {vn:34s} " + " | ".join(f"{pn} {row[pn]['m0']:+.0f}/{row[pn]['m1']:+.0f} з{min(row[pn]['lvl'], 99):.2f}" + ("" if row[pn]['safe'] and row[pn + ' 15%']['safe'] else " ЛИКВ") for pn in PS) + f" [{time.time() - t:.0f} с]", flush=True)
        json.dump(RES, open(out, "w"), ensure_ascii=False, default=float)
