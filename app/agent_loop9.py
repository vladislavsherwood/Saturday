"""Круг 9 (портфель): сочетания K1/K3/K4 под плечом и с шортом BTC. 9 монет, 105 стартов, 0 ликвидаций и при −20/−30%
(для шортов — и при максимумах +20/+30%). Запуск: python3 app/agent_loop9.py <cands9.json> <out.json>"""
import sys, os, json, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent_margin import plan_of, portfolio, fmt, mask, short_state
from agent_loop5 import sized
from agent_loop6 import ENTRY, EXIT

if __name__ == "__main__":
    C = json.load(open(sys.argv[1])); out = {}
    keep = ["B", "K1: B + тихая вершина 40%", "K3: K1 + подтверждение OI", "K4: K1 + жадность + OI", "K2: K1 + жадность>70 2%"]
    SH = {"шорт BTC 10%, жадность > 75": (short_state(mask(ENTRY["жадность > 75"]), mask(EXIT["дно или разворот BTC"][0])), 0.10),
          "шорт BTC 5%, жадность > 75": (short_state(mask(ENTRY["жадность > 75"]), mask(EXIT["дно или разворот BTC"][0])), 0.05),
          "шорт BTC 10%, тихая вершина и фандинг > 1%": (short_state(mask(ENTRY["тихая вершина и фандинг > 1%"]), mask(EXIT["дно или разворот BTC"][0])), 0.10)}
    for name in keep:
        S = C[name]; rows = []
        A0, G0, _ = plan_of(S)
        base = portfolio(A0, G0, stress=False)
        for sb, sp, sr in itertools.product((0.25, 0.5), (1.0, 1.5, 2.0), (0.5, 1.0)):
            A, G, _ = plan_of(sized(S, sb, sp, sr))
            for lb, lp, lr in itertools.product((1.5, 2, 2.5), (1, 1.25), (1.5, 2, 2.5)):
                lev = (1, lb, lp, lr, 1, 1)
                o = portfolio(A, G, lev, stress=False)
                if o["liq"] == 0:
                    o2 = portfolio(A, G, lev); o.update(l20=o2["l20"], l30=o2["l30"])
                o["cfg"] = [sb, sp, sr, lb, lp, lr]; rows.append(o)
        safe = sorted([o for o in rows if o["liq"] == 0 and o.get("l20") == 0 and o.get("l30") == 0], key=lambda o: -o["med"])
        print(f"\n=== {name} ===\n  без плеча (размеры как есть): {fmt(base)}", flush=True)
        for o in safe[:3]:
            print(f"  {fmt(o)} | {o['cfg']}", flush=True)
        best = safe[0]; A, G, _ = plan_of(sized(S, *best["cfg"][:3])); lev = (1, *best["cfg"][3:], 1, 1)
        res = {"base": base, "best": best, "short": {}}
        for sn, (W, sz) in SH.items():
            o = portfolio(A, G, lev, SHORT=W, sh_size=sz, sh_rate=0.15 / 365, sh_coin=0)
            o0 = portfolio(A0, G0, SHORT=W, sh_size=sz, sh_rate=0.15 / 365, sh_coin=0)
            print(f"  + {sn}: с плечом {fmt(o)}\n      без плеча {fmt(o0)}", flush=True)
            res["short"][sn] = {"lev": o, "nolev": o0}
        out[name] = res
    json.dump(out, open(sys.argv[2], "w"))
