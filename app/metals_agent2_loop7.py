"""Круг 7: новые данные делового цикла (загрузка мощностей ФРС G17, деловая уверенность ОЭСР). Основа — R5.
H7a — тёплая ступень продаж у промышленных при «горячем» цикле (загрузка или уверенность выше 80-го процентиля 1967–1998).
H7c — то же при развороте цикла (уверенность > 100 и снизилась за 3 мес.).
H7b — цикл как маркер: вершина + загрузка высоко (пром.); дно + уверенность низко / загрузка низко (все).
Критерий: select_ok + плато + пропусков вершин до 1999 не больше R5; после 1999 — только вето.
Запуск: python3 app/metals_agent2_loop7.py"""
import numpy as np

import metals_agent2_lib as A
import metals_agent_lib as L

QS, SS = (0.85, 0.88, 0.90, 0.92), (0.05, 0.10, 0.15)
QM = (0.75, 0.80, 0.85)


def main():
    D = A.load()
    G = A.cycle(D)
    pre = G[G.index < "1999-01-01"]
    q = {c: {x: float(pre[c].dropna().quantile(x)) for x in (0.15, 0.2, 0.25, 0.75, 0.8, 0.85)} for c in ("cu", "bci")}
    print("пороги (1967/1950–1998): загрузка мощностей q20/q80 = %.1f / %.1f; деловая уверенность q20/q80 = %.2f / %.2f" % (q["cu"][0.2], q["cu"][0.8], q["bci"][0.2], q["bci"][0.8]))
    for k in A.metals(D):
        d = D[k]
        d["_cu"] = A.onmetal(d, G["cu"])
        d["_bci"] = A.onmetal(d, G["bci"])
        b3 = np.r_[np.full(3, np.nan), d["_bci"][:-3]]
        d["_bturn"] = np.nan_to_num((d["_bci"] > 100) & (d["_bci"] < b3)).astype(bool)
    base = A.ver("R5")
    R5 = A.evaluate(D, base)
    miss0 = A.agg(R5, A.SEL, "prox_b")["miss"]

    def gate(d, g):
        if g == "cu":
            return np.nan_to_num(d["_cu"] > q["cu"][0.8]).astype(bool)
        if g == "bci":
            return np.nan_to_num(d["_bci"] > q["bci"][0.8]).astype(bool)
        return d["_bturn"]

    def warm(a, b, s, g):
        def f(d):
            p = base(d)
            if A.GROUP[d["key"]] != "ind":
                return p
            cond = (np.nan_to_num(A.feat(d, A.P3)) > a) & (np.nan_to_num(A.feat(d, A.Y1)) > b) & gate(d, g)
            return np.where(cond & (p <= 1.0), np.minimum(p, -s), p)
        return f

    def marker(kind, ser, qq):
        def f(d):
            x = d["_" + ser]
            if kind == "top":
                if A.GROUP[d["key"]] != "ind":
                    return base(d)
                tn = d["tn3"] + np.nan_to_num(x > q[ser][qq]).astype(np.int64)
                return A.r3(d, **A.VERS["R5"], tn=tn, nt=d["nt"] + 1)
            bn = d["bn3"] + np.nan_to_num(x < q[ser][qq]).astype(np.int64)
            return A.r3(d, **A.VERS["R5"], bn=bn, nb=d["nb"] + 1)
        return f

    C, meta = {}, {}
    names = {"cu": "загрузка > q80", "bci": "уверенность > q80", "turn": "уверенность > 100 и падает"}
    for g in ("cu", "bci", "turn"):
        for qq in QS:
            a, b = L.pooled(D, A.P3, qq), L.pooled(D, A.Y1, qq)
            for s in SS:
                nm = f"H7{'a' if g != 'turn' else 'c'} [{names[g]}]: пром., q{int(qq * 100)} (×{a:.2f}, +{b:.0f}%) → {s:.0%}"
                C[nm] = warm(a, b, s, g); meta[nm] = ("w", g, qq, s)
    for kind, ser, qs in (("top", "cu", QM), ("bot", "bci", (0.15, 0.2, 0.25)), ("bot", "cu", (0.15, 0.2, 0.25))):
        for qq in qs:
            nm = f"H7b: {'вершина + загрузка высоко (пром.)' if kind == 'top' else ('дно + ' + ('уверенность' if ser == 'bci' else 'загрузка') + ' низко (все)')} q{int(qq * 100)}"
            C[nm] = marker(kind, ser, qq); meta[nm] = ("m", kind + ser, qq)
    print(f"\n=== {len(C)} вариантов; только период подбора (до 1999) ===")
    rows = A.study(D, C, R5, show=14)
    axes = lambda key: (None, None, QS, SS) if key[0] == "w" else (None, None, QM if key[1] == "topcu" else (0.15, 0.2, 0.25))   # noqa: E731
    good, by = A.pick(rows, meta, axes, extra=lambda r: r["a"]["miss"] <= miss0)
    for g in ("cu", "bci", "turn"):
        print(f"\n  {names[g]}: сумма до 1999 (половины) ✓ пропущено до 1999")
        for qq in QS:
            print(f"    q{int(qq * 100)}: " + "  ".join(
                f"{s:.0%}: {by[('w', g, qq, s)]['s']['before']['logsum']:+6.1f} ({by[('w', g, qq, s)]['s']['h1']['logsum']:+.0f}/{by[('w', g, qq, s)]['s']['h2']['logsum']:+.0f})"
                f"{'✓' if by[('w', g, qq, s)]['ok'] else ' '} {by[('w', g, qq, s)]['a']['miss']}" for s in SS))
    print("\n  H7b маркеры: " + "; ".join(f"{r['name'][5:]}: {r['s']['before']['logsum']:+.1f} ({r['s']['h1']['logsum']:+.0f}/{r['s']['h2']['logsum']:+.0f}){'✓' if r['ok'] else ''}"
                                       for r in rows if meta[r["name"]][0] == "m"))
    print(f"\nпрошли критерий с плато и без роста пропусков: {len(good)}")
    if not good:
        print("R5 не меняется")
        return
    best = good[0]
    print(f"\nВЫБРАН по «до 1999»: {best['name']}\n  {A.fb(best['s'])}\n  до 1999 по металлам: {A.bymetal(best['s'], 'before')}\n  до 1999: " + A.fprox(best["a"]))
    A.veto([best], R5)
    print("  метрики, вся история: " + A.fprox(A.agg(best["R"], A.SEL)) + "\n  R5:                   " + A.fprox(A.agg(R5, A.SEL)))
    print("  итог к DCA: " + A.line(best["R"], A.SEL))
    for k in A.IND:
        d = D[k]
        p0, p1 = base(d), best["R"][k]["plan"]
        print(f"    {A.NAME[k]}: доп. продажи " + ", ".join(f"{d['t'][i]:%y-%m}" for i in range(len(p0)) if p1[i] != p0[i]))


if __name__ == "__main__":
    main()
