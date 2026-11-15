"""tune5, круг 5: итог. Правила по монетам — combo2 без изменений (порог разворота 20, весь резерв, исключения как есть).
Маржа: схемы combo2 и предложенные tune5 в модели combo2_margin (спот — залог, Bybit-подобная) с медианами по годам старта и в модели
Hyperliquid (imp9_margin, залог — только USDC) со стрессом до ±50%. Сохраняет found/tune5-best.json и found/tune5-best-margin.json.
Запуск: python3 app/tune5_final.py"""
import os, sys, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import combo2_margin as CM  # noqa: F401,E402
from combo_margin import Port, SETS, full  # noqa: E402
from imp9_margin import HPort, hl_full  # noqa: E402
from tune5_margin import scheme5, DEF, S_C2, HERE  # noqa: E402
from agent2_margin import grouped  # noqa: E402

SCR = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/tune5"
OUT = os.path.join(SCR, "final.json")
SPOT = {"combo2 лучшая (×1,4, разворот 50%)": {},
        "tune5 ЛУЧШАЯ НА ПЛАТО (×1,35, разворот 100%)": {"lp": 1.35, "sr": 1.0},
        "tune5 максимум (×1,375, разворот 100%) — край в 1 шаге": {"lp": 1.375, "sr": 1.0},
        "combo2 средняя (×1,3, шорт 15%)": {"lp": 1.3, "sh": 0.15},
        "tune5 средняя (×1,3, шорт 15%, разворот 100%)": {"lp": 1.3, "sh": 0.15, "sr": 1.0},
        "combo2 осторожная (×1,25, шорт 10%)": {"lp": 1.25, "sh": 0.1},
        "tune5 ОСТОРОЖНАЯ (×1,25, шорт 10%, разворот 100%)": {"lp": 1.25, "sh": 0.1, "sr": 1.0}}
HL = {"Hyperliquid: combo2 без плеча, без шорта": dict(sh=0.0, cap=0.0, raw=True),
      "Hyperliquid: РЕКОМЕНДУЕМАЯ — combo2 без плеча + шорт BTC 15% (≤ 0,5× свободного USDC)": dict(sh=0.15, cap=0.5, raw=True),
      "Hyperliquid: R16 + A4 ×1,4, перпы ≤ 1× счёта + шорт 15%": dict(sh=0.15, cap=0.5, acap=1.0, m={})}
RES = json.load(open(OUT)) if os.path.exists(OUT) else {"spot": {}, "hl": {}}
t = time.time()
PS = {k: Port(v) for k, v in SETS.items()}
for vn, p in SPOT.items():
    if vn in RES["spot"]: continue
    m = {**DEF, **p}; S, L = scheme5(S_C2, **m); row = {}
    for pn, P in PS.items():
        a = full(P, S, L, m["sh"]); b = full(P, S, L, m["sh"], rate=0.15 / 365)
        row[pn] = {"m0": a["m0"], "m1": a["m1"], "p10": a["p10"], "worst_start": a["worst_start"], "lvl": min(a["lvl"], b["lvl"]), "safe": a["safe"] and b["safe"],
                   "m0_15": b["m0"], "by_year": a["by_year"]}
    RES["spot"][vn] = {"params": m, "row": row, "safe": all(r["safe"] for r in row.values())}
    print(vn, "OK" if RES["spot"][vn]["safe"] else "ЛИКВ", " | ".join(f"{pn} {r['m0']:+.0f}/{r['m1']:+.0f} з{r['lvl']:.2f}" for pn, r in row.items()), f"[{time.time() - t:.0f} с]", flush=True)
    json.dump(RES, open(OUT, "w"), ensure_ascii=False, default=float)
HS = {k: HPort(v) for k, v in SETS.items()}
for vn, p in HL.items():
    if vn in RES["hl"]: continue
    if p.get("raw"):
        S, L = grouped(S_C2), [1.0] * 8
    else:
        S, L = scheme5(S_C2, **DEF)
    row = {}
    for pn, P in HS.items():
        o = hl_full(P, S, L, sh=p["sh"], cap=p["cap"], acap=p.get("acap", 0.0), fund=True, years=True, stresses=(1.0, 0.8, 0.7, 0.5))
        row[pn] = {k: o[k] for k in ("m0", "m1", "p10", "worst", "hlm", "hlm30", "safe", "liq", "by_year")}
    RES["hl"][vn] = {"params": p, "row": row, "safe_to_50": all(r["safe"] for r in row.values())}
    print(vn, "0 ликв. до ±50%" if RES["hl"][vn]["safe_to_50"] else "ЛИКВ", " | ".join(f"{pn} {r['m0']:+.0f}/{r['m1']:+.0f} з{min(r['hlm30'], 99):.2f} {r['liq']}" for pn, r in row.items()), f"[{time.time() - t:.0f} с]", flush=True)
    json.dump(RES, open(OUT, "w"), ensure_ascii=False, default=float)
