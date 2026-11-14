"""Агент 3, круг 13 (портфель): риск — размером покупок по бете монеты, а не только плечом. M6 (круг 6): дно 25% ×2, паника доли ×2
(×1,5 при бете ≤ 1,5, иначе ×1,25), разворот 50% ×2, отложенная 50% ×1. H13a: у низкобетовых (≤ 1,5) крупнее дно (50%), разворот (75%),
отложенная (100%, плечо ×1,5); H13b: паника с плечом ×1,75, но меньшими долями (×1,5); H13c: у высокобетовых — меньше размер паники
(доли ×1 = 25/50/50%) при плече ×1,5. Безопасно — 0 ликвидаций и при −20/−30%. Запуск: python3 app/agent3_loop13.py <out.json>"""
import sys, os, json, itertools, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent3_margin import C4, plan_of, fmt2, ind_matrix, port3, sized, su_sized

if __name__ == "__main__":
    out = sys.argv[1]; t0 = time.time()
    low = np.nan_to_num(ind_matrix("beta180"), nan=9.0) <= 1.5
    P = {}
    def plan(sb, sp, sr, sd):
        k = (sb, sp, sr, sd)
        if k not in P:
            P[k] = plan_of(su_sized(sized(C4, sb, sp, sr, sd), "K1"))[:2]
        return P[k]
    rows = []
    HIGH = {"как M6 (паника ×2 размер, ×1,25 плечо)": ((0.25, 2.0, 0.5, 0.5), (2, 1.25, 2, 1)), "паника ×1 размер, ×1,5 плечо": ((0.25, 1.0, 0.5, 0.5), (2, 1.5, 2, 1))}
    for hk, (hs, hl) in HIGH.items():
        Ah, Gh = plan(*hs)
        for sp, lp, sb, sr, sd, ld in itertools.product((1.5, 2.0), (1.5, 1.75), (0.25, 0.5), (0.5, 0.75), (0.5, 1.0), (1, 1.5)):
            Al, Gl = plan(sb, sp, sr, sd)
            A = np.where(low, Al, Ah); G = np.where(low, Gl, np.where(np.isin(Gh, (1, 2, 3, 6, 7)), Gh + 8, Gh))
            lev = [1, 2, lp, 2, 1, 1, ld, lp] + [1, hl[0], hl[1], hl[2], 1, 1, hl[3], hl[1]]
            o = port3(A, G, lev); del o["_x"]
            o["cfg"] = dict(high=hk, sp=sp, lp=lp, sb=sb, sr=sr, sd=sd, ld=ld); o["safe"] = o["liq"] == 0 and o.get("l20", 1) == 0 and o.get("l30", 1) == 0
            rows.append(o)
    print(f"{len(rows)} схем, {time.time() - t0:.0f} с")
    m6 = next(o for o in rows if o["cfg"] == dict(high=list(HIGH)[0], sp=2.0, lp=1.5, sb=0.25, sr=0.5, sd=0.5, ld=1))
    print(f"M6: {fmt2(m6)}\n\nбезопасные, лучшие по медиане:")
    for o in sorted([o for o in rows if o["safe"]], key=lambda o: -o["med"])[:20]:
        print(f"  {o['cfg']}: {fmt2(o)}")
    print(f"\nбезопасных {sum(o['safe'] for o in rows)} из {len(rows)}; небезопасные с медианой выше M6: {sum((not o['safe']) and o['med'] > m6['med'] for o in rows)}")
    json.dump(rows, open(out, "w"))
