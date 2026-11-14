"""Агент 2, круг 9: плечо по смыслу сигнала (риск — размером и плечом покупки, без лимитов займа).
H9a: возврат резерва на развороте BTC у самого максимума (пробой, BTC < X% от максимума) — это покупка на вершине; с плечом она опаснее,
чем разворот из просадки. Разделить: у максимума — меньше и без плеча, из просадки — крупнее и с большим плечом; освободившийся запас
отдать туда, где отскок вероятнее.
H9b: дно (капитуляция, волна ликвидаций) при глубокой просадке BTC (> 50% от максимума) — плечо больше (×2,5/×3).
Основа сравнения — W25 со схемой круга 2 (дно 25% ×2, паника 50/100/100% ×1,25, разворот 50% ×2, отложенная 50% ×1): +804%.
Запуск: python3 app/agent2_loop9.py <кандидаты.json>"""
import sys, os, json, itertools
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent2_margin import grouped, sized, plan_of, port2, fmt2, stress_ok, c
from agent2_loop2 import su_sized


def split(S, ind, op, v, grp_from, grp_new, act_new=None):
    """Каждое правило группы grp_from раздваивается: с условием ind op v — новая группа grp_new (и размер act_new), без него — как было."""
    S = json.loads(json.dumps(S)); R = []
    for r in S["rules"]:
        if r["grp"] == grp_from:
            R.append({**r, "conds": r["conds"] + [c(ind, op, v)], "grp": grp_new, "act": act_new if act_new is not None else r["act"]})
        R.append(r)
    S["rules"] = R
    return S


if __name__ == "__main__":
    CANDS = json.load(open(sys.argv[1])); S0 = grouped(CANDS[list(CANDS)[1]])
    base = su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1")
    A, G, _ = plan_of(base); LEV = (1, 2, 1.25, 2, 1, 1, 1, 1.25, 1, 1)
    o = port2(A, G, LEV, sep=True); print("W25, схема круга 2:", fmt2(o), flush=True)
    rows = []
    print("\nH9a: разворот у максимума (группа 8) отдельно от разворота из просадки (группа 3)")
    for X in (10, 15, 20, 30):
        for sa, sd in itertools.product((0.25, 0.5), (0.5, 0.75, 1.0)):
            S = split(sized(base, sr=sd), "btcath", "<", X, 3, 8, 1 + sa)
            A, G, _ = plan_of(S)
            for la, ld in itertools.product((1, 1.5, 2), (2, 2.5, 3)):
                lev = (1, 2, 1.25, ld, 1, 1, 1, 1.25, la, 1)
                o = port2(A, G, lev, sep=True, stress=False)
                if o["liq"] == 0:
                    ok = stress_ok(A, G, lev); o.update(l20=0 if ok else 1, l30=0 if ok else 1)
                o["tag"] = f"у максимума (BTC < {X}%) {int(sa * 100)}% ×{la}; из просадки {int(sd * 100)}% ×{ld}"; rows.append(o)
    ok_rows = sorted([o for o in rows if o["liq"] == 0 and o.get("l30") == 0], key=lambda o: -o["med"])
    print(f"  безопасных {len(ok_rows)} из {len(rows)}")
    for o in ok_rows[:10]:
        print(f"  {fmt2(o)} | {o['tag']}", flush=True)
    for X in (10, 15, 20, 30):
        q = [o for o in ok_rows if f"BTC < {X}%" in o["tag"]]
        if q:
            print(f"  лучший при X = {X}: {q[0]['med']:+.0f}% | {q[0]['tag']}")
    print("\nH9b: дно при глубокой просадке BTC (> 50%) — группа 9")
    for sb2, lb2 in itertools.product((0.25, 0.5), (2, 2.5, 3)):
        S = split(base, "btcath", ">", 50, 1, 9, 1 + sb2); A, G, _ = plan_of(S)
        lev = (1, 2, 1.25, 2, 1, 1, 1, 1.25, 1, lb2)
        o = port2(A, G, lev, sep=True, stress=False)
        if o["liq"] == 0:
            ok = stress_ok(A, G, lev); o.update(l20=0 if ok else 1, l30=0 if ok else 1)
        print(f"  глубокое дно {int(sb2 * 100)}% ×{lb2}: {fmt2(o)}", flush=True)
