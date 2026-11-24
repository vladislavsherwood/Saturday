"""Круг 10: итог — Q2д (Q2 в дневном исполнении) + резерв в векселях; плато, сдвиг, комиссия, экзамен, PAXG/XAUT, маржа, «что сейчас»;
сохраняет found/mt4-best.json. Запуск: python3 app/mt4_r10.py"""
import json
import os

import numpy as np
import pandas as pd

import mt4_lib as M

ALL = M.DSEL + M.DEXAM


def dplan(D, X, fn):
    return M.mmap(fn(D[X.k]), D[X.k]["t"], X.t, True)


def silver_opt(D, MM, R=85, g=0.25):
    G = MM["gold"]

    def f(X):
        p = dplan(D, X, M.VERS["Q2"])
        if X.k != "silver":
            return p
        gd = M.on_days(pd.Series(G.c, index=G.t), X.t)
        on = np.nan_to_num(gd / X.c >= R).astype(bool) & (p >= 0)
        p[on] = np.maximum(p[on], 1 + (1 - (1 - g) ** (1 / 21)))
        return p
    return f


def clean(o):
    if isinstance(o, dict):
        return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [clean(v) for v in o]
    if hasattr(o, "item"):
        o = o.item()
    if isinstance(o, float):
        return None if not np.isfinite(o) else round(o, 2)
    return o


def main():
    M.tee("r10.txt")
    D = M.mload()
    DD = M.dload()
    MM = M.dmetals(DD, ALL)
    one = lambda X: np.ones(X.n)  # noqa: E731
    vers = {"R3д": lambda X: dplan(D, X, M.VERS["R3"]), "R6д": lambda X: dplan(D, X, M.VERS["R6"]), "Q2д": lambda X: dplan(D, X, M.VERS["Q2"]),
            "Q2д + дешёвое серебро (опция)": silver_opt(D, MM)}
    out = {"daily": {}, "monthly": {}}
    print("ИТОГ К ДНЕВНОМУ DCA, % (H1 2000-09…2013-09 / H2 2013-10…2026-11-23 / весь отрезок); резерв без дохода; [с доходом векселей]:")
    for nm, f in vers.items():
        row = []
        out["daily"][nm] = {}
        for k in ALL:
            X = MM[k]
            p = f(X)
            r = {pt: X.run(p, pt)[0] for pt in ("h1", "h2", "full")}
            rr = {pt: X.run(p, pt, rate=X.ratetb)[0] for pt in ("h1", "h2", "full")}
            out["daily"][nm][k] = {"plain": r, "tbill": rr}
            row.append(f"{M.NAME[k]} " + "/".join("—" if not np.isfinite(r[pt]) else f"{r[pt]:+.0f}" for pt in ("h1", "h2", "full"))
                       + " [" + "/".join("—" if not np.isfinite(rr[pt]) else f"{rr[pt]:+.0f}" for pt in ("h1", "h2", "full")) + "]")
        print(f"  {nm}: " + "; ".join(row))
    for a, b in (("Q2д", "R3д"), ("Q2д", "R6д"), ("Q2д + дешёвое серебро (опция)", "Q2д")):
        o = M.gstat(MM, vers[a], vers[b])
        out["daily"][f"{a} к {b}"] = {"sum": o["sum"], "h1": o["h1"], "h2": o["h2"], "ok": o["ok"], "worst": o["worst"], "lag": o["lagsum"], "starts": o["share"], "epmin": min(o["epsum"].values())}
        print(f"  {a} к {b}: {M.gfmt(o)}")
    o = M.gstat(MM, vers["Q2д"], one)
    print(f"  Q2д к DCA (протокол): {M.gfmt(o)}; без эпизода: " + ", ".join(f"{x} {y:+.1f}" for x, y in o["epsum"].items()))
    # H10a плато
    print("\nH10a ПЛАТО (дневная; к R3д не хуже из 8 ячеек; к Q2д сумма):")
    plat = True
    for nm, fn in (("затяжной перегрев 40%", M.q2plan(hot2=0.4)), ("затяжной перегрев 60%", M.q2plan(hot2=0.6)), ("остывание 12 мес.", M.q2plan(N=12)),
                   ("остывание 36 мес.", M.q2plan(N=36)), ("остывание после продажи ≥ 50%", M.q2plan(v=0.5))):
        f = lambda X, fn=fn: dplan(D, X, fn)  # noqa: E731
        a = M.gstat(MM, f, vers["R3д"], starts=False, episodes=False)
        b = M.gstat(MM, f, vers["Q2д"], starts=False, episodes=False)
        ok = a["ok"] >= 7 and abs(b["sum"]) <= 15
        plat &= ok
        print(f"  {'✓' if ok else '✗'} {nm}: к R3д {a['ok']}/8 (сумма {a['sum']:+.1f}), к Q2д {b['sum']:+.1f} (H1 {b['h1']:+.1f}, H2 {b['h2']:+.1f})")
    print(f"  H10a: {'да' if plat else 'нет'}")
    # H10b сдвиг/комиссия
    print("\nH10b: Q2д к дневному DCA (сумма по 4 металлам H1 / H2) при сдвиге исполнения и комиссии:")
    h10b = True
    for lag, fee in ((0, 0.001), (1, 0.001), (2, 0.001), (0, 0.005)):
        s1 = s2 = 0.0
        for k in M.DSEL:
            X = MM[k]
            p = vers["Q2д"](X)
            for pt in ("h1", "h2"):
                e = M.rel(X.run(p, pt, lag, fee=fee)[0], X.run(np.ones(X.n), pt, lag, fee=fee)[0])
                if pt == "h1":
                    s1 += np.log1p(e / 100) * 100
                else:
                    s2 += np.log1p(e / 100) * 100
        h10b &= s1 >= 0 and s2 >= 0
        print(f"  сдвиг {lag} дн., комиссия {fee:.1%}: H1 {s1:+.1f} / H2 {s2:+.1f}")
    print(f"  H10b: {'да' if h10b else 'нет'}")
    # H10c экзамен
    print("\nH10c ЭКЗАМЕН (Q2д к дневному DCA, H1 / H2; к R3д):")
    for k in M.DEXAM:
        X = MM[k]
        p, p3 = vers["Q2д"](X), vers["R3д"](X)
        print(f"  {M.NAME[k]}: к DCA {X.run(p, 'h1')[0]:+.1f} / {X.run(p, 'h2')[0]:+.1f}; к R3д "
              + " / ".join("—" if not np.isfinite(X.run(p, pt)[0]) else f"{M.rel(X.run(p, pt)[0], X.run(p3, pt)[0]):+.1f}" for pt in ("h1", "h2")))
    # H10d PAXG / XAUT
    print("\nH10d: исполнение 24/7 по токенам (с 2020-01; план Q2 золота по месяцам, размазан по календарным дням):")
    J = json.load(open(os.path.join(M.data.CACHE, "au_mkt.json")))
    for sym in ("PAXG-USD", "XAUT-USD", "GC=F"):
        s = pd.Series(J[sym]["c"], index=pd.to_datetime(J[sym]["d"]))
        s = s[s.index >= "2020-01-01"]
        t = s.index
        p = M.mmap(M.VERS["Q2"](D["gold"]), D["gold"]["t"], t, True)
        c = s.values.astype(np.float64)
        e = M.dsim(c, p, 0, len(c), 0, np.zeros(len(c)), 0.001)[0]
        e1 = M.dsim(c, p, 0, len(c), 1, np.zeros(len(c)), 0.001)[0]
        print(f"  {sym}: {len(c)} дней, {str(t[0])[:10]}…{str(t[-1])[:10]}: Q2 золота к DCA {e:+.2f}% (сдвиг 1 день {e1:+.2f}%)")
    sv = J.get("SI=F")
    # H10e маржа
    print("\nH10e МАРЖА: заём 0,5× суммы докупки из резерва при ставке ФРС < 3% (ставка + 2%), ликвидация при обеспечении ≤ 1,1 по минимуму дня × стресс:")
    mres = {}
    tot_liq = tot_runs = 0
    worst = 1e9
    for k in ALL:
        X = MM[k]
        p = vers["Q2д"](X)
        lev = np.where((p > 1.0) & (np.nan_to_num(X.ff, nan=5) < 3.0), 0.5, 0.0)
        low = np.where(np.isfinite(X.l) & (X.l > 0.8 * X.c), X.l, X.c * 0.97)
        ff = np.nan_to_num(X.ff, nan=5.0)
        segs = [(pt, *X.seg(pt)) for pt in ("h1", "h2", "full")] + [(f"с {y}", int(np.searchsorted(X.t.values, np.datetime64(f"{y}-01-01"))), X.n) for y in range(2001, 2021)]
        mres[k] = {}
        for nm, a0, a1 in segs:
            if a1 - a0 < 250:
                continue
            e0 = M.dsim(X.c, p, a0, a1, 0, X.rate0, 0.001)[0]
            for st in (1.0, 0.8, 0.7):
                for lag in (0, 1):
                    e, lq, w = M.dsim_margin(X.c, low, p, lev, ff, a0, a1, lag, st, 2.0, 1.1, 0.001)
                    tot_liq += lq; tot_runs += 1
                    if st == 1.0:
                        worst = min(worst, w)
                    if st == 1.0 and lag == 0 and nm in ("h1", "h2", "full"):
                        mres[k][nm] = M.rel(e, e0)
        print(f"  {M.NAME[k]}: к Q2д без займа H1 / H2 / весь " + " / ".join("—" if pt not in mres[k] else f"{mres[k][pt]:+.1f}" for pt in ("h1", "h2", "full")))
    print(f"  прогонов {tot_runs}, ликвидаций {tot_liq}, мин. обеспечение без стресса {worst:.2f}")
    # что сейчас
    print("\nЧТО СЕЙЧАС (решение по 2026-10, исполняется в ноябре 2026; решение по ноябрю — в начале декабря):")
    now = {}
    G = MM["gold"]
    for k in ["gold", "silver", "platinum", "palladium", "copper", "aluminum", "nickel", "lead", "zinc", "tin"]:
        d = D[k]
        p = M.VERS["Q2"](d)
        last = p[-1]
        act = "докупка резерва 50% в месяц" if last > 1 else ("продать " + f"{-last:.0%}" if last < 0 else ("копить взносы в резерв (остывание после продажи)" if last == 0 else "обычный взнос"))
        sinces = M.L.since(p <= -0.2 + 1e-9)[-1]
        cool_left = max(0, 24 - int(sinces)) if sinces < 10 ** 5 else 0
        now[k] = {"plan": float(last), "action": act, "top": int(d["tn3"][-1]), "top_n": int(d["nt"]), "bottom": int(d["bn3"][-1]), "bottom_n": int(d["nb"]),
                  "cooldown_months_left": cool_left, "price_month": float(d["c"][-1])}
        print(f"  {M.NAME[k]}: {act}; вершина {d['tn3'][-1]}/{d['nt']}, дно {d['bn3'][-1]}/{d['nb']}" + (f"; остывание ещё {cool_left} мес." if cool_left else ""))
    S = MM["silver"]
    gs = G.c[-1] / S.c[-1]
    b = DD["x"]["btc"]
    r30 = (b.iloc[-1] / b.loc[:b.index[-1] - pd.Timedelta(days=30)].iloc[-1] - 1) * 100
    print(f"  золото/серебро сейчас {gs:.1f} (опция «дешёвое серебро» при ≥ 85 {'включена' if gs >= 85 else 'не включена'}); BTC за 30 дн. {r30:+.1f}%; "
          f"золото {G.c[-1]:.0f} ({(G.c[-1] / G.c.max() - 1) * 100:+.0f}% от рекорда), серебро {S.c[-1]:.2f} ({(S.c[-1] / S.c.max() - 1) * 100:+.0f}%)")
    out["now"] = now
    out["now_extra"] = {"gold_silver_ratio": gs, "btc_30d": r30, "gold": G.c[-1], "silver": S.c[-1], "date": str(G.t[-1])[:10]}
    out["margin"] = {"runs": tot_runs, "liquidations": tot_liq, "min_cover": worst, "rel": mres}
    json.dump(clean(out), open(os.path.join(M.LOGDIR, "r10.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
