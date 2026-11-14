"""Агент 4C, круг 8 (портфель 9 монет): плечо по признаку монеты. Гипотеза (заранее): покупки на заём у монеты, которая слабее BTC
(к BTC за 180 дн < −15%), — самые рискованные; если такие покупки делать без плеча (или с меньшим), освободится запас по ликвидации,
и сильным монетам можно дать больше плеча (дно ×2,5, разворот ×2,5 или 75%, паника ×1,5) — медиана выше при 0 ликвидаций в стрессе
−20/−30%. Риск — только через размер и плечо покупок на сигналах. Критерий: медиана и худшие 10% стартов выше лучшей безопасной схемы
круга 7 (то же правило продаж, схема агента 2), 0 ликвидаций в стрессе. Запуск: python3 app/agent4c_loop8.py <кандидаты.json> <out.json>"""
import sys, os, json, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import agent4c_loop7  # noqa: F401  (регистрирует rel90/rel180)
from agent2_margin import sized, plan_of, port2, fmt2, short_mask, stress_ok
from agent2_loop2 import su_sized

WEAK = {"ind": "rel180", "op": "<", "v": -15}
MAP = {1: 8, 2: 9, 3: 10, 7: 11}                      # слабые монеты: дно, паника, разворот, неподтв. паника → свои группы плеча


def weak_split(S, sizes=None):
    """Перед каждым правилом покупки групп 1/2/3/7 — копия «и монета слабее BTC» со своей группой (и размером, если задан)."""
    R = []
    for r in S["rules"]:
        g = r.get("grp", 0)
        if g in MAP and r["act"] > 1:
            q = {**r, "conds": r["conds"] + [WEAK], "grp": MAP[g]}
            if sizes and g in sizes:
                q["act"] = 1 + min(1.0, (r["act"] - 1) * sizes[g])
            R.append(q)
        R.append(r)
    return {**S, "rules": R}


if __name__ == "__main__":
    CANDS = json.load(open(sys.argv[1])); out = []
    W = short_mask()
    for nm in [k for k in CANDS if "180" in k]:
        S0 = CANDS[nm]
        for (lb, lp, lr, sr), (wl, ws) in itertools.product([(2, 1.25, 2, 0.5), (2.5, 1.25, 2, 0.5), (2, 1.5, 2, 0.5), (2, 1.25, 2.5, 0.5), (2, 1.25, 2, 0.75), (2.5, 1.25, 2.5, 0.5)],
                                                             [("как у сильных", None), ("×1", None), ("×1,5 дно/разворот", None), ("×1, размер ×0,5", 0.5)]):
            S = su_sized(sized(S0, 0.25, 2.0, sr, 0.5), "K1")
            S = weak_split(S, {1: ws, 2: ws, 3: ws, 7: ws} if ws else None)
            base = [1, lb, lp, lr, 1, 1, 1, lp]
            if wl == "как у сильных":
                weak = [lb, lp, lr, lp]
            elif wl == "×1" or wl.startswith("×1, "):
                weak = [1, 1, 1, 1]
            else:
                weak = [1.5, 1, 1.5, 1]
            lev = tuple(base + weak)
            A, G, _ = plan_of(S)
            o = port2(A, G, lev, sep=True)
            tag = f"{nm} | дно ×{lb}, паника ×{lp}, разворот {int(sr * 100)}% ×{lr} | слабые: {wl}"
            ok = o["liq"] == 0 and o.get("l20") == 0 and o.get("l30") == 0
            if ok:
                o2 = port2(A, G, lev, W=W, sh=0.10, sep=True); o["sh_med"] = o2["med"]; o["sh_ok"] = o2["liq"] == 0 and o2.get("l20") == 0 and o2.get("l30") == 0
            print(f"{'✔' if ok else '·'} {tag}: {fmt2(o)}" + (f" | + шорт 10%: {o['sh_med']:+.0f}%{'' if o['sh_ok'] else ' (ликв.)'}" if ok else ""), flush=True)
            out.append({"tag": tag, "ok": ok, **{q: o.get(q) for q in ("med", "p10", "liq", "l20", "l30", "lvl", "sh_med", "sh_ok")}})
    json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False, indent=1)
