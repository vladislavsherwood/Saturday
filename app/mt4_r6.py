"""Круг 6: серебро/золото — индикатор ликвидности (диагностика) и «дешёвое серебро» (докупка резерва при высоком отношении);
контроль — платина/золото. Месячная модель (протокол агента 3) и дневная. Запуск: python3 app/mt4_r6.py"""
import itertools

import numpy as np

import mt4_lib as M
from mt4_r5 import buy_events, fwd

RS, GS = [70, 75, 80, 85, 90], [0.25, 0.5]
PS = [0.45, 0.5, 0.55, 0.6]


def m_rule(D, k, ratio_fn, thr, g, hi=True):
    """Месячный план Q2 + «дешёв к золоту»: при отношении за thr — докупка g резерва (если план не продаёт)."""
    def f(d):
        p = M.VERS["Q2"](d).copy()
        if d is not D[k] and d.get("key", k) != k:
            return p
        r = ratio_fn(d)
        c = (r >= thr) if hi else (r <= thr)
        on = np.nan_to_num(c).astype(bool) & (p >= 0)
        p[on] = np.maximum(p[on], 1 + g)
        return p
    return f


def ratio_m(D, k):
    g = D["gold"]
    gs = dict(zip(g["t"], g["c"]))

    def f(d):
        gg = np.array([gs.get(t, np.nan) for t in d["t"]])
        return gg / d["c"] if k == "silver" else d["c"] / gg
    return f


def mstats(D, k, plan_fn):
    d = D[k]
    c, n, h, m = d["c"], len(d["c"]), d["h82"], d["m"]
    p = plan_fn(d)
    q2, r3 = M.VERS["Q2"](d), M.VERS["R3"](d)
    o = {}
    o["h2"] = M.rel(M.msim(c, p, h, m)[0], M.msim(c, q2, h, m)[0])
    o["h2lag"] = M.rel(M.msim(c, p, h, m, 1)[0], M.msim(c, q2, h, m, 1)[0])
    st = []
    for y in range(1982, 1991):
        a0 = int(np.searchsorted(d["t"].values, np.datetime64(f"{y}-01-01")))
        st.append(M.rel(M.msim(c, p, a0, m)[0], M.msim(c, q2, a0, m)[0]))
    o["share"] = float((np.array(st) >= -0.5).mean() * 100)
    o["after_q2"] = M.rel(M.msim(c, p, m, n)[0], M.msim(c, q2, m, n)[0])
    o["after_r3"] = M.rel(M.msim(c, p, m, n)[0], M.msim(c, r3, m, n)[0])
    o["h1"] = M.rel(M.msim(c, p, 0, h)[0], M.msim(c, q2, 0, h)[0]) if h > 24 else np.nan
    o["ok"] = o["h2"] >= 2 and o["h2lag"] >= 0 and o["share"] >= 70
    return o


def main():
    M.tee("r6.txt")
    D = M.mload()
    DD = M.dload()
    MM = M.dmetals(DD, M.DSEL + M.DEXAM)
    BP = {k: M.mmap(M.VERS["Q2"](D[k]), D[k]["t"], MM[k].t, True) for k in MM}
    # H6a
    G = MM["gold"]
    print("H6a: серебро за 21 торг. день отстало от золота на ≥ X% → избыток 63 дней, % [H1/H2]:")
    S = MM["silver"]
    rs = M.ret(S.c, 21) - M.on_days(__import__("pandas").Series(M.ret(G.c, 21), index=G.t), S.t)
    for X in (5, 10, 15):
        row = []
        for k in M.DSEL + M.DEXAM:
            Y = MM[k]
            ev = M.on_days(__import__("pandas").Series((np.nan_to_num(rs) <= -X).astype(float), index=S.t), Y.t) > 0
            e = buy_events(ev, 30)
            fw = fwd(Y)
            parts = []
            for a, b in ((0, Y.n), (0, Y.hs), (Y.hs, Y.n)):
                w = np.zeros(Y.n, bool); w[a:b] = True; w &= np.isfinite(fw)
                parts.append((np.nanmean(fw[e & w]) - np.nanmean(fw[w]) if (e & w).any() else np.nan, int((e & w).sum())))
            row.append(f"{M.NAME[k][:4]} {parts[0][0]:+.1f} n{parts[0][1]} [{parts[1][0]:+.1f}/{parts[2][0]:+.1f}]")
        print(f"  отставание ≥ {X}%: " + "; ".join(row))
    # H6b/H6c месячная модель
    for k, grid, hi, nm in (("silver", RS, True, "золото/серебро ≥ R"), ("platinum", PS, False, "платина/золото ≤ P")):
        print(f"\nМЕСЯЧНАЯ МОДЕЛЬ, {M.NAME[k]}, {nm} → докупка g резерва (к Q2; отбор 1982–98, критерий: ≥ +2%, сдвиг ≥ 0, старты ≥ 70%):")
        rf = ratio_m(D, k)
        res, by = {}, {}
        for thr, g in itertools.product(grid, GS):
            o = mstats(D, k, m_rule(D, k, rf, thr, g, hi))
            res[(thr, g)] = o; by[(thr, g)] = o["ok"]
        for key, o in res.items():
            pl = M.dplateau(by, key, [grid, GS])
            print(f"  {'✓' if o['ok'] and pl else '·'} {key[0]} g {key[1]:.0%}: 1982–98 {o['h2']:+.1f} (сдвиг {o['h2lag']:+.1f}, старты {o['share']:.0f}%), 1965/72–81 {o['h1']:+.1f}")
        good = [kk for kk, o in res.items() if o["ok"] and M.dplateau(by, kk, [grid, GS])]
        if good:
            best = max(good, key=lambda kk: res[kk]["h2"])
            o = res[best]
            print(f"  ВЫБРАН {best}: ВЕТО 1999–2026 к Q2 {o['after_q2']:+.1f}, к R3 {o['after_r3']:+.1f} → {'проходит' if o['after_q2'] >= -0.5 and o['after_r3'] >= -0.5 else 'ОТКЛОНЁН'}")
            print("  справочно после выбора (1999–2026 к Q2): " + ", ".join(f"{kk[0]}/{kk[1]:.0%} {res[kk]['after_q2']:+.1f}" for kk in res))
        else:
            print("  ни один вариант не прошёл отбор с плато; справочно 1999–2026 к Q2: " + ", ".join(f"{kk[0]}/{kk[1]:.0%} {res[kk]['after_q2']:+.1f}" for kk in res))
        # дневная модель
        print(f"\nДНЕВНАЯ МОДЕЛЬ, {M.NAME[k]} (к Q2д; H1/H2, сдвиг, без эпизода мин., старты):")
        X = MM[k]
        gd = M.on_days(__import__("pandas").Series(G.c, index=G.t), X.t)
        ratio = gd / X.c if k == "silver" else X.c / gd
        dres = {}
        dby = {}
        for thr, g in itertools.product(grid, GS):
            def f(Y, thr=thr, g=g):
                p = BP[Y.k].copy()
                if Y.k != k:
                    return p
                c = (ratio >= thr) if hi else (ratio <= thr)
                on = np.nan_to_num(c).astype(bool) & (p >= 0)
                gdd = 1 - (1 - g) ** (1 / 21)
                p[on] = np.maximum(p[on], 1 + gdd)
                return p
            o = M.gstat({k: X}, f, lambda Y: BP[Y.k], keys=[k])
            ok = o["h1"] >= 0 and o["h2"] >= 0 and o["lagsum"] >= 0 and min(o["epsum"].values()) >= 0 and o["share"] >= 70 and o["sum"] >= 2
            dres[(thr, g)] = o; dby[(thr, g)] = ok
        for key, o in dres.items():
            pl = M.dplateau(dby, key, [grid, GS])
            print(f"  {'✓' if dby[key] and pl else '·'} {key[0]} g {key[1]:.0%}: H1 {o['h1']:+.1f} / H2 {o['h2']:+.1f}, сдвиг {o['lagsum']:+.1f}, без эпизода "
                  + ", ".join(f"{a} {b:+.1f}" for a, b in o["epsum"].items()) + f", старты {o['share']:.0f}%")


if __name__ == "__main__":
    main()
