"""Агент 3, круг 6 (портфель 9 монет, модель sim2 агента 2): C4 с плечом и шортом, плечо по бете монеты.
H6a: C4 (крупнее продажи у слабых высокобетовых) добавляет доход и под плечом — продаёт долю позиции с долгом перед падением.
H6b: риск под плечом задают обвалы высокобетовых монет; если в дни, когда бета монеты к BTC за 180 дней > b, брать меньше плеча
(дно/разворот ×1,5, паника ×1), а в остальные дни — больше (дно/разворот ×2,5/×3, паника ×1,5), итог выше при тех же 0 ликвидаций.
Безопасно — 0 ликвидаций на 105 стартах и при минимумах −20/−30%. Запуск: python3 app/agent3_loop6.py <out.json>"""
import sys, os, json, itertools, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent3_margin import W25, C4, LEV, plan_of, port2, fmt2, short_mask, grouped, lev_scheme, ind_matrix, beta_split, port3, stress_ok

if __name__ == "__main__":
    out = sys.argv[1]; t0 = time.time(); W = short_mask(); res = {}
    for nm, S0 in (("W25", W25), ("C4", C4)):
        for tag, S, lev, sh in (("без плеча", grouped(S0), (1,) * 8, 0.0), ("без плеча + шорт 10%", grouped(S0), (1,) * 8, 0.10),
                                ("плечо", lev_scheme(S0), LEV, 0.0), ("плечо + шорт 10%", lev_scheme(S0), LEV, 0.10)):
            A, G, _ = plan_of(S); o = port2(A, G, lev, W=W if sh else None, sh=sh, sep=True)
            res[f"{nm} {tag}"] = {k: o[k] for k in ("med", "p10", "liq", "lvl", "l20", "l30") if k in o}
            print(f"{nm} {tag}: {fmt2(o)}", flush=True)
    # H6b: плечо по бете (C4, размеры схемы агента 2)
    A, G, _ = plan_of(lev_scheme(C4)); B = ind_matrix("beta180"); rows = []
    for b in (1.1, 1.3, 1.5):
        Gs = beta_split(G, np.nan_to_num(B, nan=9.0) > b)          # нет беты (молодая монета) — считаем высокобетовой
        for lb, lr, lp, hb, hr, hp in itertools.product((2, 2.5, 3), (2, 2.5, 3), (1.25, 1.5), (1, 1.5, 2), (1, 1.5, 2), (1, 1.25)):
            if lb == 2 and lr == 2 and lp == 1.25 and hb == 2 and hr == 2 and hp == 1.25 and b != 1.1:
                continue
            lev = [1, lb, lp, lr, 1, 1, 1, lp] + [1, hb, hp, hr, 1, 1, 1, hp]
            o = port3(A, Gs, lev, stress=False); del o["_x"]
            o["cfg"] = [b, lb, lr, lp, hb, hr, hp]; rows.append(o)
    print(f"\nсхем {len(rows)}, {time.time() - t0:.0f} с", flush=True)
    rows.sort(key=lambda o: -o["med"]); nsafe = 0; best = []
    for o in [o for o in rows if o["liq"] == 0][:300]:
        b, lb, lr, lp, hb, hr, hp = o["cfg"]
        Gs = beta_split(G, np.nan_to_num(B, nan=9.0) > b)
        oo = port3(A, Gs, [1, lb, lp, lr, 1, 1, 1, lp] + [1, hb, hp, hr, 1, 1, 1, hp]); del oo["_x"]
        o.update(l20=oo.get("l20", 1), l30=oo.get("l30", 1))
        if o["l20"] == 0 and o["l30"] == 0:
            nsafe += 1; best.append(o)
            if nsafe <= 15:
                print(f"  бета > {b}: низкая — дно ×{lb}, разворот ×{lr}, паника ×{lp}; высокая — дно ×{hb}, разворот ×{hr}, паника ×{hp}: {fmt2(oo)}", flush=True)
        if nsafe >= 40:
            break
    print(f"безопасных среди проверенных: {nsafe}, {time.time() - t0:.0f} с")
    json.dump({"res": res, "rows": rows[:2000], "best": best}, open(out, "w"))
