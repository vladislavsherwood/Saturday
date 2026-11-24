"""Круг 7: простой резерва — доход векселей (H7a) и медленный возврат резерва по тренду (H7b) / без тренда (H7c).
Месячная модель (протокол агента 3) → дневная. Запуск: python3 app/mt4_r7.py"""
import itertools

import numpy as np

import metals_agent3_lib as T
import mt4_lib as M

YS, RS = [24, 36, 48], [0.05, 0.1, 0.2]


def redeploy(Y, r, trend=True):
    def f(d):
        p = M.VERS["Q2"](d).copy()
        c = d["c"]
        ma = M.A.ma(c, 10)
        since = M.L.since(p < 0)
        on = (since >= Y) & (p >= 0) & (p <= 1.0)
        if trend:
            on &= np.nan_to_num(c > ma).astype(bool)
        p[on] = 1 + r
        return p
    return f


def main():
    M.tee("r7.txt")
    D = M.mload()
    DD = M.dload()
    MM = M.dmetals(DD, M.DSEL + M.DEXAM)
    # H7a
    print("H7a: доход векселей на резерв (Q2), итог к DCA, % (месячная: 1982–98 / 1999–2026; дневная: H1 / H2):")
    for k in M.DSEL + ["aluminum", "nickel", "lead", "zinc"]:
        d = D[k]
        p = M.VERS["Q2"](d)
        rate = d["tb3"] / 1200
        a = [M.msim(d["c"], p, d["h82"], d["m"])[0], M.msim(d["c"], p, d["m"], len(d["c"]))[0]]
        b = [M.msim(d["c"], p, d["h82"], d["m"], 0, rate)[0], M.msim(d["c"], p, d["m"], len(d["c"]), 0, rate)[0]]
        s = f"  {M.NAME[k]}: месячная {a[0]:+.1f}/{a[1]:+.1f} → с доходом {b[0]:+.1f}/{b[1]:+.1f}"
        if k in MM:
            X = MM[k]
            pd_ = M.mmap(p, d["t"], X.t, True)
            s += f"; дневная {X.run(pd_, 'h1')[0]:+.1f}/{X.run(pd_, 'h2')[0]:+.1f} → {X.run(pd_, 'h1', rate=X.ratetb)[0]:+.1f}/{X.run(pd_, 'h2', rate=X.ratetb)[0]:+.1f}"
        print(s)
    Q2 = T.run(D, M.VERS["Q2"])
    R3 = T.run(D, M.VERS["R3"])
    for trend in (True, False):
        nm = "H7b (по тренду)" if trend else "H7c (без тренда)"
        print(f"\n{nm}: месячная модель, отбор 1982–98 к Q2:")
        rows = []
        meta = {}
        for Y, r in itertools.product(YS, RS):
            name = f"Y {Y} r {r:.0%}"
            meta[name] = (Y, r)
            R = T.run(D, redeploy(Y, r, trend))
            s = T.cmp(R, Q2)
            ok, why = T.sel_ok(s)
            rows.append({"name": name, "R": R, "s": s, "ok": ok, "why": why})
        for rr in sorted(rows, key=lambda x: -x["s"]["h2"]["logsum"]):
            print(f"  {'✓' if rr['ok'] else '·'} {rr['name']}: {T.fs(rr['s'])}{'' if rr['ok'] else '  ← ' + rr['why']} | по металлам: {T.bym(rr['s'], 'h2')}")
        good, by = T.pick(rows, meta, [YS, RS])
        if good:
            T.veto(good[0], R3)
        else:
            print("  ни один не прошёл с плато; справочно 1999–2026 к Q2 (медиана / худший): " + ", ".join(
                f"{rr['name']} {rr['s']['after']['med']:+.1f}/{rr['s']['after']['worst']:+.1f}" for rr in rows))
        # дневная
        print(f"  дневная модель к Q2д:")
        res, dby = {}, {}
        for Y, r in itertools.product(YS, RS):
            f = redeploy(Y, r, trend)
            P = {k: M.mmap(f(D[k]), D[k]["t"], MM[k].t, True) for k in MM}
            o = M.gstat(MM, lambda X, P=P: P[X.k], lambda X: M.mmap(M.VERS["Q2"](D[X.k]), D[X.k]["t"], X.t, True))
            ok, why = M.gok(o)
            res[(Y, r)] = (o, ok, why); dby[(Y, r)] = ok
        for key, (o, ok, why) in sorted(res.items(), key=lambda kv: -kv[1][0]["sum"])[:5]:
            print(f"    {'✓' if ok and M.dplateau(dby, key, [YS, RS]) else '·'} Y {key[0]} r {key[1]:.0%}: {M.gfmt(o)}{'' if ok else '  ← ' + why}")


if __name__ == "__main__":
    main()
