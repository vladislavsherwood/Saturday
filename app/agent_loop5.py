"""Круг 5: размеры покупок под плечо для кандидатов кругов 1–3 (портфель 9 монет, 105 стартов, ноль ликвидаций и при −20%/−30%).
H5a — растянутые покупки на панике (доли ×0,6) позволяют безопасно взять плечо и на панике; H5b — подтверждение паники выносом плеч (OI):
плечо только на подтверждённой панике; H5c — продажа на жадности добавляет доход и под плечом.
Запуск: python3 app/agent_loop5.py <cands.json> <out.json>"""
import sys, os, json, itertools
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent_margin import plan_of, portfolio, fmt


def sized(S, sb, sp, sr):
    S = json.loads(json.dumps(S))
    for r in S["rules"]:
        g = r.get("grp", 0)
        if g == 1: r["act"] = 1 + sb
        if g == 2: r["act"] = 1 + min(1.0, (r["act"] - 1) * sp)
        if g == 3: r["act"] = 1 + sr
    return S


if __name__ == "__main__":
    C = json.load(open(sys.argv[1])); out = {}
    for name, S in C.items():
        rows = []
        for sb, sp, sr in itertools.product((0.25, 0.5), (0.6, 1.0, 1.5, 2.0), (0.5, 0.75, 1.0)):
            A, G, _ = plan_of(sized(S, sb, sp, sr))
            for lb, lp, lr in itertools.product((1, 1.5, 2, 2.5, 3), (1, 1.25, 1.5, 2), (1, 1.5, 2, 2.5, 3)):
                o = portfolio(A, G, (1, lb, lp, lr, 1, 1), stress=False)
                if o["liq"] == 0 and (lb, lp, lr) != (1, 1, 1):
                    o2 = portfolio(A, G, (1, lb, lp, lr, 1, 1)); o.update(l20=o2["l20"], l30=o2["l30"])
                o["cfg"] = [sb, sp, sr, lb, lp, lr]; rows.append(o)
        out[name] = rows
        safe = sorted([o for o in rows if o["liq"] == 0 and o.get("l20", 0) == 0 and o.get("l30", 0) == 0], key=lambda o: -o["med"])
        nolev = sorted([o for o in rows if o["cfg"][3:] == [1, 1, 1]], key=lambda o: -o["med"])
        print(f"\n=== {name} ===\n  без плеча лучшие размеры: {nolev[0]['med']:+.0f}% {nolev[0]['cfg'][:3]}; как в B (дно 25/50→0.25, паника ×1, разворот 100%): "
              + f"{[o for o in nolev if o['cfg'][:3] == [0.25, 1.0, 1.0]][0]['med']:+.0f}%", flush=True)
        for o in safe[:6]:
            print(f"  {fmt(o)} | размеры дно {o['cfg'][0]:.2f}, паника ×{o['cfg'][1]}, разворот {o['cfg'][2]} | плечо дно ×{o['cfg'][3]}, паника ×{o['cfg'][4]}, разворот ×{o['cfg'][5]}", flush=True)
        # H5a: лучшая безопасная схема с плечом на панике > 1,25
        pl = [o for o in safe if o["cfg"][4] >= 1.5]
        if pl:
            o = pl[0]; print(f"  с плечом на панике ≥1,5: {fmt(o)} | {o['cfg']}")
    json.dump(out, open(sys.argv[2], "w"))
