"""Агент 4A, круг 9 (портфель): устойчивость находки «паника без плеча в молодом медвежьем рынке, иначе ×1,5» к составу портфеля.
Портфели: без каждой из 9 монет по очереди; только крупные (BTC, ETH, SOL, DOGE); только BTC+ETH; только мемы и молодые (HYPE, PUMP, PEPE, ENA).
Для каждого — W25 со схемой агента 2 (паника ×1,25) против защиты < 60 дн с паникой ×1,4 и ×1,5 и контроля «×1,5 без защиты».
Безопасно = 0 ликвидаций на 105 стартах и при минимумах −20/−30%. Критерий (заранее): защита безопасна во всех портфелях и медиана выше базы
не меньше чем в 12 из 14. Запуск: python3 app/agent4a_loop9.py <out.json>"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4a_loop7 import W25, LEV, base_scheme, split, plan_of, c
import agent2_margin as M
from agent2_margin import sim2, starts
from cross_lev import T

NOSH = np.zeros(M.CC.shape)


def port_sub(A, G, lev, keep):
    """Портфель только из монет keep: остальные столбцы — NaN (монета пропускается)."""
    CC, LO, HI = M.CC.copy(), M.LO.copy(), M.HI.copy()
    for k in range(len(T)):
        if T[k] not in keep:
            CC[:, k] = np.nan; LO[:, k] = np.nan; HI[:, k] = np.nan
    levv = np.array(list(lev) + [1.0] * (8 - len(lev)), float)
    R = [sim2(CC, LO, HI, A, G, NOSH, int(s), levv, 1.0, 0.0, 0.15 / 365, 0, True, True) for s in starts]
    x = np.array([q[1] for q in R]) * 100
    o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R))}
    for st, key in ((0.8, "l20"), (0.7, "l30")):
        o[key] = int(sum(sim2(CC, LO, HI, A, G, NOSH, int(s), levv, st, 0.0, 0.15 / 365, 0, True, True)[0] > 0 for s in starts))
    return o


if __name__ == "__main__":
    out, res = sys.argv[1], []
    B = base_scheme(W25); G60 = split(B, c("btcdays", "<", 60), 5, 1.0)
    V = [("база ×1,25", B, LEV)]
    for lp in (1.4, 1.5):
        L = list(LEV); L[2] = lp; L[7] = lp; L[5] = 1.0; V.append((f"защита < 60 дн, ×{lp}", G60, L))
    L = list(LEV); L[2] = 1.5; L[7] = 1.5; V.append(("×1,5 без защиты", B, L))
    P = [(f"без {t}", [x for x in T if x != t]) for t in T] + [("крупные BTC ETH SOL DOGE", ["BTC", "ETH", "SOL", "DOGE"]), ("BTC+ETH", ["BTC", "ETH"]),
         ("мемы и молодые HYPE PUMP PEPE ENA", ["HYPE", "PUMP", "PEPE", "ENA"]), ("все 9", T)]
    plans = [(tag, *plan_of(S)[:2], lev) for tag, S, lev in V]
    for pn, keep in P:
        row = {"portfolio": pn}
        for tag, A, G, lev in plans:
            o = port_sub(A, G, lev, keep); row[tag] = o
        res.append(row); json.dump(res, open(out, "w"), ensure_ascii=False)
        print(f"{pn:34s} " + " | ".join(f"{tag}: {o['med']:+.0f}% p10 {o['p10']:+.0f}% ликв {o['liq']}/{o['l20']}/{o['l30']} {o['lvl']:.2f}" for tag, o in row.items() if tag != "portfolio"), flush=True)
