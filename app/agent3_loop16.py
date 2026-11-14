"""Агент 3, круг 16: схема плеча, безопасная сразу на трёх портфелях — P1 (исходные 9 монет), P2 (крупные альты), P3 (мемы и дикие альты).
Круг 15: схема агента 2 безопасна на P1 и P2, но на P3 даёт 11 ликвидаций при −30%. Гипотеза: риск задают монеты с очень высокой бетой;
если у них (бета180 > b, а также без 180 дней истории) брать меньше плеча на дне/развороте/панике, схема станет безопасной везде, а доход
на P1 почти не упадёт. Сетка: b 1,3/1,5/1,8; низкая бета — схема агента 2 или мягче; высокая — дно ×1/1,5/2, паника ×1/1,25, разворот ×1/1,5/2.
Размеры — как у агента 2 (дно 25%, паника доли ×2, разворот 50%, отложенная 50% ×1). Стратегия — C4.
Критерий: 0 ликвидаций на всех стартах трёх портфелей и при минимумах −20/−30%; среди безопасных — наибольшая медиана P1.
Запуск: python3 app/agent3_loop16.py <out.json>"""
import sys, os, json, itertools, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent3_margin import C4, plan_of, lev_scheme, ind_matrix, sim2, CC, LO as LO1, HI as HI1, fmt2, starts
from agent3_loop15 import P, universe, plan, STARTS


def run(C, LO, HI, A, G, lev16, S0, stress=True):
    lev = np.array(tuple(lev16), float); SH = np.zeros(C.shape)
    R = [sim2(C, LO, HI, A, G, SH, int(s), lev, 1.0, 0.0, 0.15 / 365, 0, True, True) for s in S0]
    x = np.array([q[1] for q in R]) * 100
    o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)),
         "early": float(np.median(x[:48])), "late": float(np.median(x[48:])), "shpnl": 0.0}
    if stress:
        for st, key in ((0.8, "l20"), (0.7, "l30")):
            o[key] = 0
            for s in S0:
                if sim2(C, LO, HI, A, G, SH, int(s), lev, st, 0.0, 0.15 / 365, 0, True, True)[0] > 0:
                    o[key] += 1
    return o


if __name__ == "__main__":
    out = sys.argv[1]; t0 = time.time(); U = {}
    A1, G1, _ = plan_of(lev_scheme(C4)); U["P1"] = (CC, LO1, HI1, A1, G1, np.nan_to_num(ind_matrix("beta180"), nan=9.0))
    for pn, coins in P.items():
        C, LO, HI, closes = universe(coins); A, G, B = plan(lev_scheme(C4), coins, closes, C); U[pn.split()[0]] = (C, LO, HI, A, G, np.nan_to_num(B, nan=9.0))
    rows = []
    LOW = {"агент 2 (2/1,25/2)": (2, 1.25, 2), "дно ×1,5": (1.5, 1.25, 2), "разворот ×1,5": (2, 1.25, 1.5), "паника ×1": (2, 1, 2)}
    for b in (1.3, 1.5, 1.8):
        for lk, (lb, lp, lr) in LOW.items():
            for hb, hp, hr in itertools.product((1, 1.5, 2), (1, 1.25), (1, 1.5, 2)):
                lev = [1, lb, lp, lr, 1, 1, 1, lp] + [1, hb, hp, hr, 1, 1, 1, hp]; res = {}; ok = True
                for pn in ("P3", "P2", "P1"):                    # сначала самый опасный портфель — быстрый отсев
                    C, LO, HI, A, G, B = U[pn]
                    Gs = G.copy(); m = (B > b) & np.isin(G, (1, 2, 3, 6, 7)); Gs[m] += 8
                    o = run(C, LO, HI, A, Gs, lev, starts if pn == "P1" else STARTS)
                    res[pn] = o
                    if o["liq"] or o["l20"] or o["l30"]:
                        ok = False
                        if pn != "P1":
                            break
                rows.append({"b": b, "low": lk, "high": [hb, hp, hr], "ok": ok, "res": res})
    print(f"{len(rows)} схем, {time.time() - t0:.0f} с; безопасных на трёх портфелях: {sum(r['ok'] for r in rows)}\n")
    # эталоны
    for tag, b, lk, hi in (("схема агента 2 у всех", 99, "агент 2 (2/1,25/2)", None),):
        pass
    best = sorted([r for r in rows if r["ok"]], key=lambda r: -r["res"]["P1"]["med"])
    for r in best[:15]:
        print(f"бета > {r['b']}: низкая {r['low']}, высокая дно/паника/разворот ×{r['high']}:")
        for pn in ("P1", "P2", "P3"):
            print(f"    {pn}: {fmt2(r['res'][pn])}")
    json.dump(rows, open(out, "w"))
