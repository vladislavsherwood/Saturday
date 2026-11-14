"""Агент 2, круг 0 (портфель): основа (K3 + отложенная покупка) без плеча, со схемой плеча K3 (дно 25% ×2, паника 50/100/100% ×1,25,
разворот 50% ×2) и с шортом BTC 10%; отложенная — 50% без плеча и ×2. Для сравнения K1 и K3. Запуск: python3 app/agent2_loop0.py"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent2_margin import MAIN, run, sized, fmt, grouped, HERE

K3 = json.load(open(os.path.join(HERE, "found", "agent-best.json")))
B = json.load(open(os.path.join(HERE, "found", "main-crypto-B.json")))
K1 = {"base": 1, "rules": [({**r, "act": -0.4} if r["conds"] == [{"ind": "qt", "op": ">", "v": 0.5}] else r) for r in B["rules"]]}
if __name__ == "__main__":
    for r in grouped(MAIN)["rules"]:
        print(r["grp"], r["act"], " & ".join(f"{x['ind']}{x['op']}{x['v']}" for x in r["conds"]))
    for name, S in (("основа", MAIN), ("K3", K3), ("K1", K1)):
        print(f"\n== {name}")
        print("  без плеча:              ", fmt(run(S)))
        print("  без плеча + шорт BTC 10%:", fmt(run(S, sh=0.10)))
        for sd, ld in ((0.5, 1), (0.5, 2)):
            L = (1, 2, 1.25, 2, 1, 1, ld)
            Z = sized(S, 0.25, 2.0, 0.5, sd)
            print(f"  плечо K3, отложенная {sd:.0%} ×{ld}:          ", fmt(run(Z, L)))
            print(f"  плечо K3, отложенная {sd:.0%} ×{ld} + шорт 10%:", fmt(run(Z, L, sh=0.10)))
            if name != "основа":
                break
