"""Круг 3: хрупкость порога серии докупок. Основа — R3.
H3a — серия начинается и при (маркеров дна ≥ K − r) И цена к средней за 3 года < процентиля q; удержание — на маркер ниже входа.
H3c — серия начинается и при маркеров дна ≥ K − 1 подряд p месяцев.
Проверка на обычном пороге (K = 5 из 8) и строгом (K = 6 из 8). Критерий — в журнале; после 1999 — только вето.
Запуск: python3 app/metals_agent2_loop3.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L


def series(bn, K, deep=None, r=0, persist=0):
    n = len(bn)
    ep = np.zeros(n, bool)
    run = 0
    for i in range(n):
        run = run + 1 if bn[i] >= K - 1 else 0
        start = bn[i] >= K or (deep is not None and deep[i] and bn[i] >= K - r) or (persist and run >= persist)
        hold = i > 0 and ep[i - 1] and (bn[i] >= K - 1 or (deep is not None and deep[i] and bn[i] >= K - 1 - r))
        ep[i] = start or hold
    return ep


def plan(d, strict=0, q=None, r=0, persist=0, a=None):
    """R3 с заменой правила серии. strict=1 — порог на маркер строже (K = 6 из 8)."""
    P = A.DEF
    tn, bn, nt, nb = d["tn3"], d["bn3"], d["nt"], d["nb"]
    p = np.select([tn >= nt - 1, tn >= nt - 2], [-P["s6"], -P["s5"]], default=1.0)
    hot = (np.nan_to_num(A.feat(d, A.P3)) > P["hot3"]) & (np.nan_to_num(A.feat(d, A.Y1)) > P["hot1"])
    p = np.where(hot, np.minimum(p, -P["sh"]), p)
    K = nb - 3 + strict
    deep = (np.nan_to_num(A.feat(d, A.P3), nan=9.0) < a) if q is not None else None
    ep = series(bn, K, deep, r, persist)
    p = np.where(ep, 1 + P["g"], p)
    p = np.where(d["cu_past"] & (tn >= nt - 3) & (p == 1.0), -P["lead"], p)
    return p


def main():
    D = A.load()
    R3 = A.evaluate(D, A.r3)
    chk = A.evaluate(D, lambda d: plan(d), lag=False)
    assert all(abs(chk[k]["full"] - R3[k]["full"]) < 1e-9 for k in A.metals(D))
    RS = A.evaluate(D, lambda d: plan(d, 1))
    s = A.cmp(RS, R3)
    print("R3 со строгим порогом (6 из 8) против R3 — " + A.fb(s) + "\n   по металлам до 1999: " + A.bymetal(s, "before"))
    QA, RA, PA = (0.05, 0.10, 0.15), (1, 2), (2, 3, 4)
    C, meta = {}, {}
    for q in QA:
        a = L.pooled(D, A.P3, q)
        for r in RA:
            C[f"H3a: цена к ср. 3 г. < {a:.2f} (q{int(q * 100)}) → порог ниже на {r}"] = (q, r, 0, a); meta[f"H3a: цена к ср. 3 г. < {a:.2f} (q{int(q * 100)}) → порог ниже на {r}"] = ("a", q, r)
    for pp in PA:
        C[f"H3c: маркеров ≥ K−1 подряд {pp} мес."] = (None, 0, pp, None); meta[f"H3c: маркеров ≥ K−1 подряд {pp} мес."] = ("c", pp)
    rows = []
    for nm, (q, r, pp, a) in C.items():
        Rn = A.evaluate(D, lambda d, q=q, r=r, pp=pp, a=a: plan(d, 0, q, r, pp, a))
        Rs = A.evaluate(D, lambda d, q=q, r=r, pp=pp, a=a: plan(d, 1, q, r, pp, a))
        sn, ss, s3 = A.cmp(Rn, R3), A.cmp(Rs, RS), A.cmp(Rs, R3)
        b = sn["before"]
        neutral = b["ok"] >= 7 and b["worst"] >= -3 and b["logsum"] >= -2 and sn["h1"]["logsum"] >= -2 and sn["h2"]["logsum"] >= -2
        robust = ss["before"]["logsum"] >= 20 and s3["before"]["worst"] > s["before"]["worst"]
        rows.append({"name": nm, "Rn": Rn, "Rs": Rs, "sn": sn, "ss": ss, "s3": s3, "ok": neutral and robust, "neutral": neutral, "robust": robust})
        print(f"  {'✓' if neutral and robust else '·'} {nm}\n      обычный порог к R3: {A.fb(sn)}\n      строгий порог к R3-строгому: сумма до 1999 {ss['before']['logsum']:+.1f} "
              f"(половины {ss['h1']['logsum']:+.1f}/{ss['h2']['logsum']:+.1f}); строгий к R3: не хуже {s3['before']['ok']}/8, худш. {s3['before']['worst']:+.1f}, сумма {s3['before']['logsum']:+.1f}")
    by = {meta[r["name"]]: r for r in rows}
    good = []
    for r in rows:
        key = meta[r["name"]]
        ax = (None, QA, RA) if key[0] == "a" else (None, PA)
        r["plateau"] = A.plateau(by, key, ax)
        if r["ok"] and r["plateau"]:
            good.append(r)
    good.sort(key=lambda r: -r["ss"]["before"]["logsum"])
    print(f"\nпрошли критерий с плато: {len(good)} из {len(rows)}")
    if not good:
        print("R3 не меняется")
        return
    best = good[0]
    print(f"\nВЫБРАН: {best['name']}")
    print("  обычный порог, до 1999 по металлам: " + A.bymetal(best["sn"], "before"))
    print("  строгий порог к R3-строгому, до 1999: " + A.bymetal(best["ss"], "before"))
    ok, why = A.veto_ok(best["sn"])
    print(f"  ВЕТО (обычный порог к R3): {A.fa(best['sn'])} → {'проходит' if ok else 'ОТКЛОНЁН: ' + why}")
    print(f"  после 1999 строгий к R3-строгому: сумма {best['ss']['after']['logsum']:+.1f}, мед. {best['ss']['after']['med']:+.1f}, худш. {best['ss']['after']['worst']:+.1f}"
          f"; R3-строгий к R3 после 1999: мед. {s['after']['med']:+.1f}, худш. {s['after']['worst']:+.1f}; новый строгий к R3: мед. {best['s3']['after']['med']:+.1f}, худш. {best['s3']['after']['worst']:+.1f}")
    print("  метрики (обычный порог, вся история): " + A.fprox(A.agg(best["Rn"], A.SEL)))
    print("  итог к DCA: " + A.line(best["Rn"], A.SEL))


if __name__ == "__main__":
    main()
