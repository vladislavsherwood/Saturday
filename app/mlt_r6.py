"""Круг 6 mlt: устойчивость HY3 и макро-фильтры. Запуск: python3 app/mlt_r6.py"""
import numpy as np
import pandas as pd

import mlt_lib as L
import mt4_lib as M

NM = L.NAME
BASE = dict(rg="Ra", z=1.25, k50=2.0, nb=20, rsib=50, maxout=126, zn=21)


def H(**kw):
    p = dict(BASE)
    p.update(kw)
    return L.HY3(**p)


def lift_window(rule, a, b_, keys=L.DSEL):
    """Вклад окна: прибавка 2005–25 полного правила минус прибавка правила, выключенного в окне (e = 1)."""
    D, DD, MM, base = L.load()
    v = []
    for k in keys:
        X = MM[k]
        sg = L.segs(X)
        seg = (sg["A"][0], sg["B"][1])
        e = rule.e(X)
        w = (X.t >= a) & (X.t <= b_)
        rc = L.R(X, None, seg)
        full = L.rel(L.combo(rc, L.R(X, e, seg), L.F0), rc)
        off = L.rel(L.combo(rc, L.R(X, np.where(w, 1.0, e), seg), L.F0), rc)
        v.append(full - off)
    return v


def real_rate(X):
    D, DD, MM, base = L.load()
    m = DD["monthly"]
    rr = m["y10"] - (m["cpi"] / m["cpi"].shift(12) - 1) * 100
    return M.monthly_on_days(rr, X.t, 15)


def main():
    L.tee("r6.txt")
    D, DD, MM, base = L.load()
    h0 = H()
    print("Круг 6. HY3 — устойчивость; ядро mb1, f = 30%\n")
    o0 = L.scan([h0])[0][1]
    print("\n(1) Плато (соседи ±1 шаг по каждому параметру):")
    nb = []
    for key, vals in (("z", (1.0, 1.5)), ("k50", (1.5, 2.5)), ("nb", (10, 50)), ("rsib", (45, 55)), ("maxout", (63, 252)), ("zn", (10, 42)),
                      ("rg", ("Rb", "Rc"))):
        for v in vals:
            nb.append(H(**{key: v}))
    rn = L.scan(nb)
    good = [z for z in rn if z[1]["sum"] >= 0 and z[1]["ok"] >= 6]
    print(f"  соседей с суммой ≥ 0 и не хуже ≥ 6/8: {len(good)}/{len(rn)} (по 6 числовым параметрам: "
          f"{sum(1 for z in rn[:12] if z[1]['sum'] >= 0 and z[1]['ok'] >= 6)}/12)")

    print("\n(2) Части по отдельности:")
    L.scan([H(k50=None, name="HY3 только вне режима (= HY1 Ra z 1,25)"), H(z=None, name="HY3 только в режиме (отрыв > 2σ√25)")])

    print("\n(3) Комиссия, векселя, ставка торговой части, f:")
    for nm, kw in (("комиссия 0,5%", dict(fee=0.005)), ("макро-резерв mb1 в векселях", dict(mrate="tb"))):
        o = L.check(h0, starts=False, epis=False, after=False, **kw)
        print(f"  {nm}: {L.fmt(o, short=True)} | сдвиг {'/'.join(f'{v:+.1f}' for v in o['lag'].values())}")
    s = []
    for k in L.DSEL:
        X = MM[k]
        for seg in L.segs(X).values():
            rc = L.R(X, None, seg)
            s.append(L.rel(L.combo(rc, L.R(X, h0.e(X), seg, trate=X.rate0), L.F0), rc))
    print(f"  деньги торговой части без дохода (0%): сумма {L.lsum(s):+.1f} (с векселями {o0['sum']:+.1f})")
    for f in (0.2, 0.5, 1.0):
        o = L.check(h0, f=f, starts=False, epis=False, after=True)
        print(f"  f = {f:.0%}: {L.fmt(o, short=True)} | 2005–25 {o['fsum']:+.1f} | после решения Σ {o['f26sum']:+.1f}")

    print("\n(4) Экзамен (палладий; алюминий с 2014 — справочно):")
    for kk in (["palladium"], ["aluminum"]):
        o = L.check(h0, keys=kk, starts=False)
        print(f"  {NM[kk[0]]}: {L.fmt(o, kk)} | {L.fafter(o, kk)}")
        od = L.check(h0, keys=kk, core="dca", starts=False, epis=False)
        print(f"     ядро DCA: {L.fmt(od, kk, short=True)}")

    print("\n(5) (г) против 50 перемешанных (те же длины отрезков в/вне металла):")
    p = L.precision(h0)
    ctl = L.control(h0, nseed=50)
    g, why = L.prec_ok(p, ctl)
    print(f"  правило: прибавка 2005–25 {ctl['real']:+.1f}; {L.pfmt(p)}")
    print(f"  перемешанные: медиана {ctl['med']:+.1f}, 80-й перц. {ctl['p80']:+.1f}, правило выше {ctl['pct']:.0f}%; место продаж {ctl['sell_pos180']:.2f}, откупов {ctl['buy_pos180']:.2f}, "
          f"поймано {ctl['caught']:.0f}; к местной DCA прод. {ctl['sell_loc180']:+.1f}, откуп {ctl['buy_loc180']:+.1f} → (г) {'✓' if g else '✗ ' + why}")

    print("\n(6) Откуда прибавка (вклад окна в прибавку 2005–25, сумма 4 металлов; по годам):")
    for nm, (a, b_) in L.EPW.items():
        v = lift_window(h0, a, b_)
        print(f"  {nm}: {sum(v):+.1f} (" + " ".join(f"{NM[k][:3]} {x:+.1f}" for k, x in zip(L.DSEL, v)) + ")")
    yr = []
    for y in range(2005, 2026):
        v = lift_window(h0, f"{y}-01-01", f"{y}-12-31")
        yr.append((y, sum(v)))
    print("  по годам: " + " ".join(f"{y} {x:+.1f}" for y, x in yr))
    print(f"  лет с вкладом > 0: {sum(1 for _, x in yr if x > 0)}/21; крупнейший год — {max(yr, key=lambda z: z[1])}")

    print("\n(7) Макро-фильтры поверх HY3:")
    dxr = lambda X: L.F(X)["dxy_r21"]  # noqa: E731
    vix = lambda X: L.F(X)["vix"]  # noqa: E731

    def btc_stress(X, T=0.25, W=90):
        btc = DD["x"]["btc"]
        r30 = btc / btc.shift(1, freq="30D").reindex(btc.index, method="ffill") - 1
        ev = (r30 <= -T).astype(float)
        e = L.C.on_days(ev, X.t)
        return pd.Series(e).rolling(W, min_periods=1).max().values > 0

    def rr_up(X):
        r = real_rate(X)
        return L.b(r - pd.Series(r).shift(63).values > 0)

    def gsr_dn(X):
        if X.k != "silver":
            return np.ones(X.n, bool)
        g = 1.0 / L.C.cross(MM, "silver", "gold")
        return L.b(g < L.sma(g, 50))
    filt = [
        ("M1 продажа вне режима только при росте DXY 21 дн.", dict(sell_ok=lambda X: L.b(dxr(X) > 0) | L.regime(X))),
        ("M1' продажа вне режима только при падении DXY 21 дн.", dict(sell_ok=lambda X: L.b(dxr(X) < 0) | L.regime(X))),
        ("M2 откуп отложить, пока DXY 21 дн. > +2%", dict(buy_block=lambda X: L.b(dxr(X) > 0.02))),
        ("M3 VIX > 30: откуп сразу, продажа запрещена", dict(sell_ok=lambda X: ~L.b(vix(X) > 30), buy_force=lambda X: L.b(vix(X) > 30))),
        ("M4 откуп отложить 90 дн. после стресса BTC", dict(buy_block=lambda X: btc_stress(X))),
        ("M5 продажа вне режима только при росте реальной ставки за 3 мес.", dict(sell_ok=lambda X: rr_up(X) | L.regime(X))),
        ("M6 серебро: продажа вне режима при золото/серебро < SMA50", dict(sell_ok=lambda X: gsr_dn(X) | L.regime(X))),
    ]
    fr = L.scan([H(name=nm, **kw) for nm, kw in filt])
    for r, o, g_, why in fr:
        print(f"  {r.name}: к HY3 {o['sum'] - o0['sum']:+.1f} (B {o['B'] - o0['B']:+.1f}); {L.fafter(o)}")


if __name__ == "__main__":
    main()
