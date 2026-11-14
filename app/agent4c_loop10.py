"""Агент 4C, круг 10 (портфель 9 монет): финал — W25 против C1.25/C1.5 по годам старта, соседние пороги/множители с плечом и стрессом;
сохраняет found/agent4c-best-margin.json. Запуск: python3 app/agent4c_loop10.py <cands10.json>"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import agent4c_loop7  # noqa: F401  (rel90/rel180)
from agent2_margin import grouped, sized, plan_of, port2, fmt2, short_mask, starts, idx, HERE, BOT, c
from agent2_loop2 import su_sized

LEV = (1, 2, 1.25, 2, 1, 1, 1, 1.25)


def scheme(S0):
    return su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1")


def with_rel(S0, w, v, k):
    """W25 + перед каждым правилом продажи копия «и к BTC за w дней < v%» с долей ×k."""
    R = []
    for r in S0["rules"]:
        if r["act"] < 0:
            R.append({**r, "act": max(-1.0, r["act"] * k), "conds": r["conds"] + [c(f"rel{w}", "<", v)]})
        R.append(r)
    return {**S0, "rules": R}


if __name__ == "__main__":
    CANDS = json.load(open(sys.argv[1])); W = short_mask()
    years = np.array([idx[s].year for s in starts]); res = {}
    for nm, S0 in CANDS.items():
        for tag, S, lev, sh in (("без плеча", grouped(S0), (1,) * 8, 0.0), ("с плечом", scheme(S0), LEV, 0.0), ("с плечом + шорт BTC 10%", scheme(S0), LEV, 0.10)):
            A, G, _ = plan_of(S); o = port2(A, G, lev, W=W if sh else None, sh=sh, sep=True, xs=True)
            o["by_year"] = {int(y): float(np.median(np.array(o["_x"])[years == y])) for y in sorted(set(years))}; o["worst_start"] = float(min(o["_x"])); del o["_x"]
            res[f"{nm} | {tag}"] = o
            print(f"{nm} | {tag}: {fmt2(o)} | худший старт {o['worst_start']:+.0f}%", flush=True)
    print("\nпо годам старта: " + " ".join(str(y) for y in sorted(set(years))))
    for k, o in res.items():
        print(f"  {k}: " + " ".join(f"{v:+.0f}%" for v in o["by_year"].values()))
    W25 = CANDS["W25"]; nb = []
    print("\nсоседи (с плечом, стресс −20/−30%):")
    for w in (90, 180):
        for v in (-10, -15, -20, -25):
            for k in (1.25, 1.5, 1.75):
                A, G, _ = plan_of(scheme(with_rel(W25, w, v, k))); o = port2(A, G, LEV, sep=True)
                nb.append({"w": w, "v": v, "k": k, **{q: o.get(q) for q in ("med", "p10", "liq", "l20", "l30", "lvl")}})
                print(f"  к BTC за {w} дн < {v}% ×{k}: {fmt2(o)}", flush=True)
    key = [k for k in CANDS if k.startswith("C1.25")][0]
    best = {"strategy": "found/agent4c-best.json (W25 + продажи ×1,25 у монеты, отставшей от BTC за 180 дней больше чем на 15%)",
            "model": "agent2_margin.sim2: 9 монет по $2/день, кросс-маржа, ликвидация при активы/долг ≤ 1,1 по минимуму дня, заём 11% годовых, 105 стартов",
            "scheme": "как found/agent2-best-margin.json: дно 25% ×2, паника (любая) 50/100/100% ×1,25, разворот 50% ×2, отложенная 50% ×1; шорт BTC 10% на жадности > 75, выход на сигнале дна или развороте BTC",
            "rules_with_sizes": scheme(CANDS[key]), "group_leverage": {"0": 1, "1": 2, "2": 1.25, "3": 2, "4": 1, "6": 1, "7": 1.25},
            "short": {"coin": "BTC", "size": 0.10, "entry": [[c("fng", ">", 75)]], "exit": BOT + [[c("btcr30", ">", 20)]]},
            "results": res, "neighbors": nb}
    json.dump(best, open(os.path.join(HERE, "found", "agent4c-best-margin.json"), "w"), ensure_ascii=False, indent=1)
    print("\nсохранено: app/found/agent4c-best-margin.json")
