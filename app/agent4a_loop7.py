"""Агент 4A, круг 7 (портфель 9 монет с маржой): размер и плечо покупок у дна по силе сигнала.
Гипотезы. H7a: сильная паника в стейблах (usdt > 1,2/1,25/1,3 — по кругу 6 покупки всего ~13% над будущим минимумом) надёжнее обычной —
под плечом её можно покупать крупнее (доля ×1,5 / весь резерв) и с большим плечом (×1,25/1,5/2), не трогая остальные покупки.
H7b: плечо паники ×1,5/×1,75 (у агента 2 без стресса уже 11 ликвидаций) станет безопасным, если в молодом медвежьем рынке
(< 60/90/120 дней с максимума BTC — там дно ещё впереди, круг 4) паника покупается без плеча.
База — W25 со схемой агента 2 (дно 25% ×2, паника 50/100/100% ×1,25, разворот 50% ×2, отложенная 50% без плеча): +804%.
Безопасно = 0 ликвидаций на 105 стартах и при минимумах −20%/−30%. Критерий (заранее): медиана выше +804% при безопасности, худшие 10%
стартов не хуже, мин. активы/долг ≥ 1,5. Запуск: python3 app/agent4a_loop7.py <out.json>"""
import sys, os, json, time
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import agent_margin as AM
from agent2_margin import grouped, sized, plan_of, port2, fmt2, c, HERE
from agent2_loop2 import su_sized

_b = AM._btc
_bd = pd.Series(np.nan, index=_b.index)
m, d, v = -1.0, 0, []
for x in _b.values:
    if not (x < m): m, d = x, 0
    else: d += 1
    v.append(d)
_bd = pd.Series(v, index=_b.index, dtype=float)
AM.EXTRA["btcdays"] = lambda close, kind, I: _bd.reindex(close.index, method="ffill")

W25 = json.load(open(os.path.join(HERE, "found", "agent2-best.json")))
LEV = [1, 2, 1.25, 2, 1, 1, 1, 1.25]


def base_scheme(S):
    return su_sized(sized(S, 0.25, 2.0, 0.5, 0.5), "K1")


def split(S, cond, grp, k=1.0):
    """Перед каждым правилом паники (группы 2 и 7) — копия с доп. условием, группой grp и долей ×k."""
    R = []
    for r in S["rules"]:
        if r["grp"] in (2, 7):
            R.append({**r, "act": 1 + min(1.0, (r["act"] - 1) * k), "conds": r["conds"] + [cond], "grp": grp})
        R.append(r)
    return {**S, "rules": R}


if __name__ == "__main__":
    out, res = sys.argv[1], []
    B = base_scheme(W25)
    def rep(tag, S, lev):
        t = time.time(); A, G, _ = plan_of(S); o = port2(A, G, tuple(lev), sep=True)
        o["tag"] = tag; res.append(o); print(f"{tag}: {fmt2(o)} [{time.time() - t:.0f} с]", flush=True)
        json.dump(res, open(out, "w"), ensure_ascii=False)
    rep("W25, схема агента 2", B, LEV)
    print("\nH7a: сильная паника — группа 5 со своим плечом и размером")
    for T in (1.2, 1.25, 1.3):
        for k in (1.0, 1.5, 9.0):
            for ls in (1.25, 1.5, 2.0):
                if k == 1.0 and ls == 1.25: continue
                L = list(LEV); L[5] = ls
                rep(f"usdt > {T}: доля ×{k if k < 9 else 'весь'} плечо ×{ls}", split(B, c("usdt", ">", T), 5, k), L)
    print("\nH7b: без плеча в молодом медвежьем рынке, плечо паники больше")
    for D in (60, 90, 120):
        for lp in (1.25, 1.5, 1.75):
            L = list(LEV); L[2] = lp; L[7] = lp; L[5] = 1.0
            rep(f"< {D} дн с максимума BTC — паника без плеча; иначе плечо ×{lp}", split(B, c("btcdays", "<", D), 5, 1.0), L)
