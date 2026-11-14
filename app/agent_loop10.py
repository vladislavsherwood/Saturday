"""Круг 10 (портфель): финальная проверка K3 с плечом и шортом BTC — соседние схемы плеча (плато), старты по годам,
стресс минимумов −20/−30% и максимумов +20/+30%, худшие старты. Сохраняет схему в found/agent-best-margin.json.
Запуск: python3 app/agent_loop10.py <cands9.json>"""
import sys, os, json, itertools
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent_margin import plan_of, portfolio, fmt, mask, short_state, idx, starts
from agent_loop5 import sized
from agent_loop6 import ENTRY, EXIT

if __name__ == "__main__":
    C = json.load(open(sys.argv[1]))
    W = short_state(mask(ENTRY["жадность > 75"]), mask(EXIT["дно или разворот BTC"][0]))
    years = np.array([idx[s].year for s in starts])
    by_year = lambda o: " ".join(f"{y}:{np.median(np.array(o['_x'])[years == y]):+.0f}%" for y in sorted(set(years)))   # noqa: E731
    from agent_margin import sim, C as CC, LO, HI
    def full(A, G, lev, sh=0.0):
        o = portfolio(A, G, lev, SHORT=W if sh else None, sh_size=sh, sh_rate=0.15 / 365, sh_coin=0)
        levv = np.array(list(lev) + [1.0] * (8 - len(lev)), float); SH = W.astype(float) if sh else np.zeros(CC.shape)
        o["_x"] = [sim(CC, LO, HI, A, G, SH, int(s), levv, 1.0, sh, 0.15 / 365, 0)[1] * 100 for s in starts]
        return o
    rows = {}
    for name in ("B", "K1: B + тихая вершина 40%", "K3: K1 + подтверждение OI"):
        S = C[name]; A0, G0, _ = plan_of(S); A, G, _ = plan_of(sized(S, 0.25, 2.0, 0.5))
        LEV = (1, 2, 1.25, 2, 1, 1)
        for tag, (AA, GG, lev, sh) in (("без плеча", (A0, G0, (1,) * 6, 0)), ("с плечом", (A, G, LEV, 0)), ("с плечом + шорт BTC 10%", (A, G, LEV, 0.10)), ("без плеча + шорт BTC 10%", (A0, G0, (1,) * 6, 0.10))):
            o = full(AA, GG, lev, sh); rows[f"{name} | {tag}"] = o
            print(f"{name} | {tag}: {fmt(o)}\n    по годам старта: {by_year(o)} | худший старт {min(o['_x']):+.0f}%", flush=True)
    # плато вокруг схемы плеча для K3
    S = C["K3: K1 + подтверждение OI"]
    print("\nK3, соседние схемы (размеры дно/паника×/разворот; плечо дно/паника/разворот):")
    for sb, sp, sr, lb, lp, lr in [(0.25, 2, 0.5, 2, 1.25, 2), (0.25, 1.5, 0.5, 2, 1.25, 2), (0.25, 2, 0.75, 2, 1.25, 2), (0.5, 2, 0.5, 2, 1.25, 2), (0.25, 2, 0.5, 2.5, 1.25, 2),
                                   (0.25, 2, 0.5, 2, 1.25, 2.5), (0.25, 2, 0.5, 1.5, 1.25, 2), (0.25, 2, 0.5, 2, 1, 2), (0.25, 2, 0.5, 2, 1.5, 2), (0.25, 2, 0.5, 3, 1.25, 3)]:
        A, G, _ = plan_of(sized(S, sb, sp, sr)); o = portfolio(A, G, (1, lb, lp, lr, 1, 1))
        print(f"  {sb}/{sp}/{sr}; ×{lb}/×{lp}/×{lr}: {fmt(o)}")
    best = {"strategy": "found/agent-best.json (K3)", "sizes": {"дно (капитуляция, волна ликвидаций)": "25% резерва", "паника (подтверждённая OI)": "доли ×2: 50/100/100% резерва",
            "паника без подтверждения": "10% резерва, без плеча", "разворот BTC": "50% резерва"},
            "leverage": {"обычный взнос": 1, "дно": 2, "паника (подтверждённая)": 1.25, "разворот": 2, "паника без подтверждения": 1},
            "short": {"coin": "BTC", "size": "10% капитала счёта при открытии", "entry": [[{"ind": "fng", "op": ">", "v": 75}]],
                      "exit": EXIT["дно или разворот BTC"][0], "borrow_rate_year": 0.15},
            "rules_with_sizes": sized(S, 0.25, 2.0, 0.5),
            "results": {k: {q: v for q, v in o.items() if q != "_x"} for k, o in rows.items()}}
    json.dump(best, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "agent-best-margin.json"), "w"), ensure_ascii=False, indent=1)
