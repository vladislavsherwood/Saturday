"""Круг 9 mlt: тонкое плато HY3, HY1 целиком, стресс BTC на одном эпизоде, итоговые цифры. Запуск: python3 app/mlt_r9.py"""
import numpy as np

import mlt_lib as L
from mlt_r6 import lift_window

NM = L.NAME
B3 = dict(rg="Ra", z=1.25, k50=2.0, nb=20, rsib=50, maxout=126, zn=21)
B1 = dict(B3, k50=None)


def H(base, **kw):
    p = dict(base)
    p.update(kw)
    return L.HY3(**p)


def table(rule, name):
    """Итог по металлам: прибавка к ядру mb1 и итог к DCA (ядро и ядро + торговая часть), A / B / 2005–25 / 2000–26; сделок в год."""
    D, DD, MM, base = L.load()
    print(f"\n  {name}: итог к DCA, % (ядро mb1 → ядро + торговая часть 30%) и прибавка к ядру; A 2005–15 / B 2016–25 / 2005–25 / 2005–26.11 / 2000–26:")
    for k in L.DSEL + ["palladium", "aluminum"]:
        X = MM[k]
        sg = L.segs(X)
        a0 = sg["A"][0] if sg["A"][1] - sg["A"][0] >= 250 else sg["B"][0]
        segs = [sg["A"], sg["B"], (a0, sg["B"][1]), (a0, X.n), (0, X.n)]
        cells = []
        for seg in segs:
            if seg[1] - seg[0] < 250:
                cells.append("—")
                continue
            rc = L.R(X, None, seg)
            tot = L.combo(rc, L.R(X, rule.e(X), seg), L.F0)
            rd = L.R(X, None, seg, "dca")
            totd = L.combo(rd, L.R(X, rule.e(X), seg, "dca"), L.F0)
            cells.append(f"mb1 {rc:+.0f}→{tot:+.0f} ({L.rel(tot, rc):+.1f}); DCA+торг. {totd:+.1f}")
        tp = L.ntrades(rule.e(X), max(L.ix(X.t, L.A0), 1), L.ix(X.t, L.CUT), X.t)
        print(f"    {NM[k]} (сделок/год {tp:.1f}): " + " | ".join(cells))


def main():
    L.tee("r9.txt")
    D, DD, MM, base = L.load()
    print("Круг 9. Сборка; ядро mb1, f = 30%\n")
    print("(a) HY3 — тонкое плато (справка, после просмотра круга 6):")
    fine = [H(B3, z=1.125), H(B3, z=1.375), H(B3, k50=1.75), H(B3, k50=2.25), H(B3, nb=15), H(B3, nb=30), H(B3, rsib=47.5), H(B3, rsib=52.5),
            H(B3, zn=15), H(B3, zn=30)]
    rf = L.scan(fine)
    print(f"  соседей, проходящих правило плато: {sum(1 for z in rf if z[1]['sum'] >= 0 and z[1]['ok'] >= 6)}/10")

    print("\n(b) HY1 — весь протокол:")
    h1 = H(B1, name="HY1 Ra z21>1,25σ, откуп ≤ SMA20, 126 дн.")
    o1 = L.scan([h1])[0][1]
    print("  широкое плато:")
    nb1 = [H(B1, z=1.0), H(B1, z=1.5), H(B1, nb=10), H(B1, nb=50), H(B1, zn=10), H(B1, zn=42), H(B1, rg="Rb"), H(B1, rg="Rc"),
           H(B1, maxout=63), H(B1, maxout=252)]
    r1 = L.scan(nb1)
    print(f"  соседей, проходящих правило плато: {sum(1 for z in r1 if z[1]['sum'] >= 0 and z[1]['ok'] >= 6)}/{len(r1)}")
    for nm, kw in (("комиссия 0,5%", dict(fee=0.005)), ("макро-резерв в векселях", dict(mrate="tb"))):
        o = L.check(h1, starts=False, epis=False, after=False, **kw)
        print(f"  {nm}: {L.fmt(o, short=True)}")
    for kk in (["palladium"], ["aluminum"]):
        o = L.check(h1, keys=kk, starts=False)
        print(f"  экзамен {NM[kk[0]]}: {L.fmt(o, kk, short=True)}")
    print(f"  {L.fafter(o1)}")
    p = L.precision(h1)
    ctl = L.control(h1, nseed=50)
    g, why = L.prec_ok(p, ctl)
    print(f"  (г): {L.pfmt(p)}; перемешанные: медиана {ctl['med']:+.1f}, правило выше {ctl['pct']:.0f}%; место продаж {ctl['sell_pos180']:.2f}, откупов {ctl['buy_pos180']:.2f}, "
          f"поймано {ctl['caught']:.0f} → {'✓' if g else '✗ ' + why}")

    print("\n(c) HY3 (г) на 100 перемешанных (повтор круга 6 с другим числом):")
    h3 = H(B3)
    p3 = L.precision(h3)
    c3 = L.control(h3, nseed=100)
    g3, w3 = L.prec_ok(p3, c3)
    print(f"  правило выше {c3['pct']:.0f}% (медиана {c3['med']:+.1f}); место продаж {p3['sell_pos180']:.2f} / {c3['sell_pos180']:.2f}, откупов {p3['buy_pos180']:.2f} / {c3['buy_pos180']:.2f}, "
          f"поймано {p3['lows_caught'] + p3['highs_caught']} / {c3['caught']:.0f} → {'✓' if g3 else '✗ ' + w3}")
    print("  точность по металлам (HY3): " + "; ".join(
        f"{NM[k]}: " + L.pfmt(L.precision(h3, keys=[k])) for k in L.DSEL))

    print("\n(d) стресс BTC (M4) поверх HY3: вклад без окна 2015–16")
    import pandas as pd
    btc = DD["x"]["btc"]
    r30 = btc / btc.shift(1, freq="30D").reindex(btc.index, method="ffill") - 1
    ev = (r30 <= -0.25).astype(float)

    def stress(X):
        return pd.Series(L.C.on_days(ev, X.t)).rolling(90, min_periods=1).max().values > 0
    m4 = H(B3, buy_block=stress, name="HY3 + M4")
    for nm, (a, b_) in L.EPW.items():
        v3 = sum(lift_window(h3, a, b_))
        v4 = sum(lift_window(m4, a, b_))
        print(f"  окно {nm}: вклад HY3 {v3:+.1f}, HY3+M4 {v4:+.1f} (разница {v4 - v3:+.1f})")
    for T, W in ((0.2, 90), (0.3, 90), (0.25, 60), (0.25, 120)):
        def st2(X, T=T, W=W):
            e2 = (r30 <= -T).astype(float)
            return pd.Series(L.C.on_days(e2, X.t)).rolling(W, min_periods=1).max().values > 0
        o = L.check(H(B3, buy_block=st2), starts=False, epis=False, after=False)
        print(f"  M4 T {T:.0%} W {W}: {L.fmt(o, short=True)}")

    print("\n(e) Итоговые цифры по металлам:")
    table(h3, "HY3")
    table(h1, "HY1")


if __name__ == "__main__":
    main()
