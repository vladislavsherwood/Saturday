"""Круг 4: общий резерв на все металлы (идея 2-го агента, круг 11: +11% к портфелю до 1999, отклонён из-за −2% в 1972–81).
Портфель 8 металлов отбора, $300 в месяц на каждый; сигналы — Q1. Сравнение — тот же портфель при отдельных счетах.
H4a общий котёл, в месяц серии каждый из S металлов в серии берёт g/S резерва; H4b каждый берёт g/8; H4c котлы драг./пром., g/S. g = 33/50/67%.
Критерий (заранее): 1982–98 (старт 1982) портфель лучше отдельных счетов на ≥ 2%; сдвиг исполнения ≥ 0; портфели «без одного металла»
не хуже на ≥ 7 из 8; старты каждый январь 1982–1990 до 1999 — не хуже в ≥ 70%; плато по g. Из прошедших — наибольший выигрыш.
Вето (только выбранный): 1999–2026 портфель ≥ 0 к отдельным счетам Q1 и к отдельным счетам R3, «без одного» не хуже на ≥ 5 из 8.
Запуск: python3 app/metals_agent3_loop4.py"""
import numpy as np

import metals_agent2_lib as A
from metals_agent2_loop11 import run, setup
from metals_agent3_loop2 import q1

GS = (0.33, 0.5, 0.67)


def main():
    D = A.load()
    C, P, per, tb = setup(D, q1)
    _, P3, _, _ = setup(D, A.ver("R3"))
    idx = D["_X"].index
    for y in range(1982, 1991):
        per[f"s{y}"] = (int(idx.searchsorted(np.datetime64(f"{y}-01-01"))), per["h2"][1])
    K = len(A.SEL)
    own, one = np.arange(K), np.zeros(K, np.int64)
    two = np.array([0 if A.GROUP[k] == "prec" else 1 for k in A.SEL])
    base = run(C, P, per, 0, 0.5, own)
    base3 = run(C, P3, per, 0, 0.5, own)
    blag = run(C, P, per, 0, 0.5, own, lag=1)
    print("портфель, отдельные счета Q1 (к DCA портфеля): 1982–98 %+.1f, 1999–2026 %+.1f, вся (с 1972) %+.1f; доля денег 1982–98 %.0f%%"
          % (base["h2"][0], base["after"][0], base["full"][0], base["h2"][1] * 100))
    loo0 = {}
    for r in range(K):
        act = np.ones(K, np.bool_); act[r] = False
        loo0[r] = run(C, P, per, 0, 0.5, own, act=act)
    rows = []
    for fam, mode, groups, nm in (("a", 1, one, "H4a общий котёл, g/S"), ("b", 2, one, "H4b общий котёл, g/8"), ("c", 1, two, "H4c котлы драг./пром., g/S")):
        for g in GS:
            res = run(C, P, per, mode, g, groups)
            lag = run(C, P, per, mode, g, groups, lag=1)
            loo = {}
            for r in range(K):
                act = np.ones(K, np.bool_); act[r] = False
                loo[r] = run(C, P, per, mode, g, groups, act=act)
            rel = {p: A.rel(res[p][0], base[p][0]) for p in per}
            lb = np.array([A.rel(loo[r]["h2"][0], loo0[r]["h2"][0]) for r in range(K)])
            st = np.array([rel[f"s{y}"] for y in range(1982, 1991)])
            rl = A.rel(lag["h2"][0], blag["h2"][0])
            ok = rel["h2"] >= 2 and rl >= 0 and (lb >= -0.5).sum() >= 7 and (st >= -0.5).mean() >= 0.7
            rows.append({"name": f"{nm}, g = {g:.0%}", "key": (fam, g), "rel": rel, "lb": lb, "ok": ok, "res": res, "loo": loo, "mode": mode, "groups": groups})
            print(f"  {'✓' if ok else '·'} {nm}, g = {g:.0%}: 1982–98 {rel['h2']:+.1f}%, сдвиг {rl:+.1f}; без одного не хуже {(lb >= -0.5).sum()}/8 (худший {lb.min():+.1f}); "
                  f"старты не хуже {(st >= -0.5).mean() * 100:.0f}% (медиана {np.median(st):+.1f}); доля денег {res['h2'][1] * 100:.0f}%")
    by = {r["key"]: r for r in rows}
    good = [r for r in rows if r["ok"] and A.plateau(by, r["key"], (None, GS))]
    good.sort(key=lambda r: -r["rel"]["h2"])
    print(f"\nпрошли критерий с плато: {len(good)}")
    if not good:
        return
    best = good[0]
    la = np.array([A.rel(best["loo"][r]["after"][0], loo0[r]["after"][0]) for r in range(K)])
    r3a = A.rel(best["res"]["after"][0], base3["after"][0])
    ok = best["rel"]["after"] >= 0 and r3a >= 0 and (la >= -0.5).sum() >= 5
    print(f"ВЫБРАН: {best['name']}\n  ВЕТО: 1999–2026 к отдельным счетам Q1 {best['rel']['after']:+.1f}%, к отдельным R3 {r3a:+.1f}%; вся {best['rel']['full']:+.1f}%; "
          f"без одного металла после 1999 не хуже {(la >= -0.5).sum()}/8 (худший {la.min():+.1f}) → {'проходит' if ok else 'ОТКЛОНЁН'}")
    print(f"  портфель к DCA: отдельные Q1 1982–98/после/вся {base['h2'][0]:+.1f}/{base['after'][0]:+.1f}/{base['full'][0]:+.1f}; "
          f"общий {best['res']['h2'][0]:+.1f}/{best['res']['after'][0]:+.1f}/{best['res']['full'][0]:+.1f}; отдельные R3 {base3['h2'][0]:+.1f}/{base3['after'][0]:+.1f}/{base3['full'][0]:+.1f}")
    print("  все варианты после 1999 (справочно, после выбора): " + "; ".join(f"{r['name']} {r['rel']['after']:+.1f}" for r in rows))
    tbr = run(C, P, per, 0, 0.5, own, rate=tb)
    tbp = run(C, P, per, best["mode"], best["key"][1], best["groups"], rate=tb)
    print(f"  резерв в векселях: отдельные {tbr['h2'][0]:+.1f}/{tbr['after'][0]:+.1f}; общий {tbp['h2'][0]:+.1f}/{tbp['after'][0]:+.1f}")


if __name__ == "__main__":
    main()
