"""combo3: Hyperliquid (залог перпов — только USDC + PnL перпов, спот не залог) на пяти портфелях, сдвиги исполнения −1 / 0 / +1 день.
Два движка, чтобы разобрать расхождение imp9 («шорт безопасен») и imp6 («шорт на счёте со спотом ликвидируется»):
  1) imp9_margin.simhl — без плеча; шорт BTC «жадность > 75 → до дна или разворота BTC», размер — доля капитала, потолок номинала шорта
     ≤ cap × свободный залог перпов (USDC + PnL перпов) В МОМЕНТ ОТКРЫТИЯ; фандинг перпа BTC (Binance, с 2020); стресс минимумы/максимумы ±20/±30/±50%;
     режимы strict (ни одна монета не залог) и real (монеты без спота на HL держатся перпом 1× с полным залогом — DOGE, PEPE в P9).
  2) imp6_sim.sim5 с hl=2 (та же логика залога) — шорт как доля всего капитала БЕЗ потолка (так считал imp6), плюс экономика HL без шорта:
     комиссии 0,07/0,045%, DOGE/PEPE — перп 1× с фандингом 10% годовых, минимальный ордер $10.
Сдвиг −1 — исполнение по закрытию дня решения; сдвиги строятся imp6_common.sh (поддерживает отрицательный).
Запуск: python3 app/combo3_hl.py <стратегии.json> <выход.json>"""
import os, sys, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import combo2_margin  # noqa: F401,E402
from imp9_margin import HPort, simhl, FUND, BOT, c, SETS  # noqa: E402
from imp6_common import sh as shf, LP, run5  # noqa: E402
from agent4d_margin import STARTS  # noqa: E402
from agent2_margin import grouped  # noqa: E402

X0 = BOT + [[c("btcr30", ">", 20)]]; E75 = [[c("fng", ">", 75)]]


def hl_run(P, S, sh, cap, lag, sv, mode="strict", fund=True, W=None):
    A, G = P.plan(S); B = P.B
    if W is None:
        if not hasattr(P, "_w75"):
            P._w75 = P.shw(E75, X0)
        W = P._w75
    Lm = B.levmat([1.0] * 8); SH = W * sh
    if lag:
        A, G, SH = shf(A, lag, 1.0), shf(G, lag, 0), shf(SH, lag, 0.0)
    FR = FUND[:len(B.C)] if fund else np.zeros(len(B.C))
    cnt = P.cnt_real if mode == "real" else np.zeros(len(B.coins))
    R = [simhl(B.C, B.LO, B.HI, A, G, SH, int(s), Lm, sv, 0.15 / 365, 0.0003, P.mm, cnt, cap, 0.0, FR, bool(fund)) for s in STARTS]
    x = np.array([q[1] for q in R]) * 100
    return {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "hlm": float(min(q[2] for q in R)),
            "shpnl": float(np.median([q[3] for q in R]) * 100)}


def hl_full3(P, S, sh, cap, mode="strict", stresses=(1.0, 0.8, 0.7, 0.5)):
    o = {"m": {}, "liq": [], "hlm": {}}
    for lag in (-1, 0, 1):
        for sv in stresses:
            r = hl_run(P, S, sh, cap, lag, sv, mode)
            if sv == 1.0:
                o["m"][lag] = round(r["med"], 1)
                if lag == 0:
                    o["p10"] = round(r["p10"], 1); o["shpnl"] = round(r["shpnl"], 2)
            o["hlm"][f"{lag}/{sv}"] = round(min(r["hlm"], 99), 3)
            if r["liq"]:
                o["liq"].append([lag, sv, r["liq"]])
    o["safe_30"] = not any(q[1] >= 0.7 for q in o["liq"]); o["safe_50"] = not o["liq"]
    o["hlm_min_30"] = min(v for k, v in o["hlm"].items() if float(k.split("/")[1]) >= 0.7); o["hlm_min_50"] = min(o["hlm"].values())
    return o


if __name__ == "__main__":
    ST = json.load(open(sys.argv[1])); out = sys.argv[2]
    HP = {k: HPort(v) for k, v in SETS.items()}
    LPS = {k: LP(v) for k, v in SETS.items()}
    RES = {}; t = time.time()
    for st in ("combo2", "combo3"):
        S = grouped(ST[st]); RES[st] = {}
        CFG = [("без шорта", 0.0, 0.0), ("шорт 15%, ≤ 0,5× свободного USDC (imp9)", 0.15, 0.5), ("шорт 20%, ≤ 0,5× USDC", 0.2, 0.5),
               ("шорт 15% без потолка", 0.15, 0.0), ("шорт 10% без потолка", 0.10, 0.0), ("шорт 15%, ≤ 1× USDC", 0.15, 1.0)]
        for tag, sh, cap in CFG:
            row = {nm: hl_full3(P, S, sh, cap) for nm, P in HP.items()}
            if tag.startswith("шорт 15%, ≤ 0,5"):
                row["P9 real"] = hl_full3(HP["P9"], S, sh, cap, mode="real")
            RES[st]["imp9: " + tag] = row
            print(f"{st} | imp9-движок | {tag} [{time.time() - t:.0f} с]", flush=True)
            for nm, o in row.items():
                print(f"     {nm:8s} −1/0/+1: {o['m'][-1]:+.0f}/{o['m'][0]:+.0f}/{o['m'][1]:+.0f} | шорт {o.get('shpnl', 0):+.1f} | запас HL мин. ±30% {o['hlm_min_30']:.2f}, ±50% {o['hlm_min_50']:.2f} | "
                      + ("0 ликв." if not o["liq"] else "ЛИКВ " + str(o["liq"])), flush=True)
        # imp6-движок: шорт без потолка (доля всего капитала) и экономика HL без шорта
        HL = dict(hlx=True, hl=2, shr=0.0, mino=10.0, minb=11.0, fund=0.10 / 365)
        for tag, shw, kw in (("imp6: шорт 10% без потолка, ликвидация HL (как imp6, круг 3)", 0.10, dict(hl=2, shr=0.0)),
                             ("imp6: без шорта, условия HL (комиссии, DOGE/PEPE перп 1× фандинг 10%, мин. ордер $10)", 0.0, HL)):
            row = {}
            for nm, P in LPS.items():
                ms, bad = {}, []
                for lag in (-1, 0, 1):
                    A, G = P.mats(S, all_lag=lag)
                    o = run5(P, A, G, [1.0] * 8, shw, sh_lag=lag, **kw)
                    ms[lag] = round(o["med"], 1)
                    if o["liq"] or o.get("l20") or o.get("l30"):
                        bad.append([lag, o["liq"], o.get("l20"), o.get("l30")])
                row[nm] = {"m": ms, "liq": bad, "safe": not bad}
            RES[st][tag] = row
            print(f"{st} | {tag} [{time.time() - t:.0f} с]", flush=True)
            for nm, o in row.items():
                print(f"     {nm:8s} −1/0/+1: {o['m'][-1]:+.0f}/{o['m'][0]:+.0f}/{o['m'][1]:+.0f} | " + ("0 ликв." if o["safe"] else "ЛИКВ " + str(o["liq"])), flush=True)
        json.dump(RES, open(out, "w"), ensure_ascii=False, default=float)
