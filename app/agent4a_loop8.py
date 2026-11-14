"""Агент 4A, круг 8 (портфель): устойчивость и продолжение находки круга 7 (паника без плеча в молодом медвежьем рынке).
H8a: другая мера «вершина была недавно» — BTC ближе X% к максимуму (btcath < 15/25/35) вместо дней с максимума; и обе вместе.
H8b: та же защита для дна (капитуляция, вынос OI) и разворота BTC — позволяет ли она поднять их плечо (×2 → ×2,5).
H8c: размер паники при защите (доли ×1,5 вместо ×2) и отложенная с плечом.
H8d: шорт BTC 10% (жадность > 75, выход на сигнале дна/развороте) поверх — без ликвидаций при минимумах −20/−30% и максимумах +20/+30%.
База круга 7: «< 60 дн: паника без плеча, иначе ×1,5» (+1171%). Запуск: python3 app/agent4a_loop8.py <out.json>"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4a_loop7 import W25, LEV, base_scheme, split, plan_of, port2, fmt2, c
from agent2_margin import sized, short_mask
from agent2_loop2 import su_sized


def split_g(S, cond, groups, newg):
    """Перед каждым правилом из groups — копия с доп. условием и группой newg[g]."""
    R = []
    for r in S["rules"]:
        if r["grp"] in groups:
            R.append({**r, "conds": r["conds"] + [cond], "grp": newg[r["grp"]]})
        R.append(r)
    return {**S, "rules": R}


if __name__ == "__main__":
    out, res = sys.argv[1], []
    W = short_mask()
    def rep(tag, S, lev, sh=0.0):
        A, G, _ = plan_of(S); o = port2(A, G, tuple(lev), W=W if sh else None, sh=sh, sep=True); o["tag"] = tag; res.append(o)
        print(f"{tag}: {fmt2(o)}", flush=True); json.dump(res, open(out, "w"), ensure_ascii=False)
    B = base_scheme(W25)
    L15 = list(LEV); L15[2] = 1.5; L15[7] = 1.5; L15[5] = 1.0
    G60 = split(B, c("btcdays", "<", 60), 5, 1.0)
    rep("круг 7: < 60 дн паника без плеча, иначе ×1,5", G60, L15)
    print("\nH8a: «вершина недавно» по близости BTC к максимуму")
    for X in (15, 25, 35):
        for lp in (1.4, 1.5):
            L = list(LEV); L[2] = lp; L[7] = lp; L[5] = 1.0
            rep(f"BTC < {X}% от максимума: паника без плеча, иначе ×{lp}", split(B, c("btcath", "<", X), 5, 1.0), L)
    print("\nH8b: защита и для дна (гр. 1) и разворота (гр. 3); их плечо выше")
    for lb, lr in ((2, 2), (2.5, 2), (2, 2.5), (2.5, 2.5)):
        S = split_g(G60, c("btcdays", "<", 60), (1, 3), {1: 6, 3: 6})   # группа 6 (отложенная) и так без плеча
        L = list(L15); L[1] = lb; L[3] = lr; L[6] = 1.0
        rep(f"+ дно и разворот без плеча < 60 дн; иначе дно ×{lb}, разворот ×{lr}", S, L)
    for lb, lr in ((2.5, 2), (2, 2.5)):
        L = list(L15); L[1] = lb; L[3] = lr
        rep(f"без защиты дна/разворота: дно ×{lb}, разворот ×{lr}", G60, L)
    print("\nH8c: размеры")
    for sp in (1.5,):
        Bs = su_sized(sized(W25, 0.25, sp, 0.5, 0.5), "K1"); rep(f"паника доли ×{sp} (вместо ×2), защита < 60 дн, ×1,5", split(Bs, c("btcdays", "<", 60), 5, 1.0), L15)
    for ld in (1.25, 1.5):
        L = list(L15); L[6] = ld; rep(f"отложенная с плечом ×{ld}", G60, L)
    print("\nH8d: шорт BTC")
    for sh in (0.10, 0.20):
        rep(f"W25 схема агента 2 + шорт BTC {int(sh * 100)}%", B, LEV, sh)
        rep(f"круг 7 + шорт BTC {int(sh * 100)}%", G60, L15, sh)
