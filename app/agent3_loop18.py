"""Агент 3, круг 18: устойчивая схема R16 (дно 25% ×2, паника доли ×2 ×1,25, разворот 50% ×1,5, отложенная 50% ×1) — соседние схемы
на трёх портфелях (плато безопасности), «риск размером»: разворот крупнее, но с меньшим плечом; шорт BTC 10/20% на P1 со стрессом максимумов;
по годам старта. Гипотеза: R16 стоит не на краю — соседние шаги тоже безопасны на P1–P3, а шорт BTC 10% не добавляет ликвидаций.
Запуск: python3 app/agent3_loop18.py <out.json>"""
import sys, os, json, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent3_margin import W25, C4, plan_of, sized, su_sized, sim2, CC, LO as LO1, HI as HI1, fmt2, starts, idx, short_mask
from agent3_loop15 import P, universe, plan, STARTS
from agent3_loop16 import run

BASE = dict(sb=0.25, sp=2.0, sr=0.5, sd=0.5, lb=2, lp=1.25, lr=1.5, ld=1)
NB = [("R16", {}), ("дно 50%", dict(sb=0.5)), ("дно ×2,5", dict(lb=2.5)), ("дно ×1,5", dict(lb=1.5)), ("паника ×1,5", dict(lp=1.5)), ("паника ×1", dict(lp=1)),
      ("паника доли ×1,5", dict(sp=1.5)), ("разворот ×2 (агент 2)", dict(lr=2)), ("разворот ×1,25", dict(lr=1.25)), ("разворот 75% ×1,5", dict(sr=0.75)),
      ("разворот 100% ×1,25", dict(sr=1.0, lr=1.25)), ("разворот 75% ×1,25", dict(sr=0.75, lr=1.25)), ("разворот 100% ×1", dict(sr=1.0, lr=1)), ("отложенная ×1,5", dict(ld=1.5)), ("отложенная 100%", dict(sd=1.0))]

if __name__ == "__main__":
    out = sys.argv[1]; t0 = time.time(); res = {}
    U = {"P1": (CC, LO1, HI1, None, starts)}
    for pn, coins in P.items():
        C, LO, HI, closes = universe(coins); U[pn.split()[0]] = (C, LO, HI, (coins, closes), STARTS)
    cache = {}
    def plans(S0, cfg, pn):
        key = (id(S0), cfg["sb"], cfg["sp"], cfg["sr"], cfg["sd"], pn)
        if key not in cache:
            S = su_sized(sized(S0, cfg["sb"], cfg["sp"], cfg["sr"], cfg["sd"]), "K1")
            C, LO, HI, extra, S_ = U[pn]
            cache[key] = plan_of(S)[:2] if pn == "P1" else plan(S, extra[0], extra[1], C)[:2]
        return cache[key]
    print("соседние схемы C4 (P1 / P2 / P3: медиана, ✔ — 0 ликвидаций и при −20/−30%, мин. активы/долг):")
    for S0, nm in ((C4, "C4"), (W25, "W25")):
        for tag, ch in (NB if nm == "C4" else NB[:1] + NB[7:8]):
            cfg = {**BASE, **ch}; lev = [1, cfg["lb"], cfg["lp"], cfg["lr"], 1, 1, cfg["ld"], cfg["lp"]] + [1] * 8; row = {}
            for pn in ("P1", "P2", "P3"):
                C, LO, HI, extra, S_ = U[pn]; A, G = plans(S0, cfg, pn)
                o = run(C, LO, HI, A, G, lev, S_); row[pn] = o
            res[f"{nm} {tag}"] = row
            f = lambda o: f"{o['med']:+.0f}% {'✔' if not (o['liq'] or o['l20'] or o['l30']) else str(o['liq']) + '/' + str(o['l20']) + '/' + str(o['l30'])} {o['lvl']:.2f}"
            print(f"  {nm} {tag:22s}: " + " | ".join(f"{pn} {f(row[pn])}" for pn in ("P1", "P2", "P3")), flush=True)
    # шорт BTC на P1 (стресс: минимумы −20/−30% и максимумы +20/+30%), по годам старта
    from agent2_margin import port2
    W = short_mask(); years = np.array([idx[s].year for s in starts])
    print("\nP1, шорт BTC (вход жадность > 75, выход сигнал дна/разворот):")
    for S0, nm in ((C4, "C4"), (W25, "W25")):
        S = su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1"); A, G, _ = plan_of(S)
        for lr in (1.5, 2):
            for sh in (0.0, 0.10, 0.20):
                o = port2(A, G, (1, 2, 1.25, lr, 1, 1, 1, 1.25), W=W if sh else None, sh=sh, sep=True, xs=True); x = np.array(o.pop("_x"))
                byy = " ".join(f"{y}:{np.median(x[years == y]):+.0f}%" for y in sorted(set(years)))
                print(f"  {nm} разворот ×{lr}, шорт {int(sh * 100)}%: {fmt2(o)} | худший старт {x.min():+.0f}% | по годам {byy}", flush=True)
                res[f"P1 {nm} lr{lr} sh{sh}"] = {**o, "worst_start": float(x.min()), "by_year": {int(y): float(np.median(x[years == y])) for y in sorted(set(years))}}
    json.dump(res, open(out, "w")); print(f"{time.time() - t0:.0f} с")
