"""Круг 3: «пузырь и сдувание» по дневной цене поверх Q2д. Запуск: python3 app/mt4_r3.py"""
import itertools

import numpy as np

import mt4_lib as M

XS = [1.20, 1.25, 1.30, 1.35, 1.40]
YS = [30, 50, 70]
SS = [0.1, 0.2, 0.3]


def base_plans(D, MM):
    return {k: M.mmap(M.VERS["Q2"](D[k]), D[k]["t"], MM[k].t, True) for k in MM}


def bubble_mask(X, x, y):
    s2 = M.sma(X.c, 200)
    r = M.ret(X.c, 250)
    return np.nan_to_num(X.c / s2) > x, np.nan_to_num(r) > y


def add_bubble(p, X, x, y, s, gap=21):
    a, b = bubble_mask(X, x, y)
    cond = a & b
    q = p.copy()
    last = -10 ** 6
    ev = np.zeros(len(p), bool)
    for i in range(len(p)):
        if cond[i] and i - last >= gap:
            if q[i] > -s:
                q[i] = -s
            last = i
            ev[i] = True
    return q, ev


def add_deflate(q, ev, X, z, g, win=500):
    s2 = M.sma(X.c, 200)
    since = M.L.since(ev)
    cond = (since <= win) & (since > 0) & (np.nan_to_num(X.c / s2, nan=9) < 1 - z)
    gd = 1 - (1 - g) ** (1 / 21)
    r = q.copy()
    r[cond & (r >= 0)] = 1 + gd
    return r


def main():
    M.tee("r3.txt")
    D = M.mload()
    DD = M.dload()
    MM = M.dmetals(DD, M.DSEL + M.DEXAM)
    BP = base_plans(D, MM)
    # диагностика: максимум цены к SMA200 и роста за 250 дн. в эпизодах
    print("Диагностика: максимум цены/SMA200 и роста за 250 дн. по годам-эпизодам:")
    for k in M.DSEL + M.DEXAM:
        X = MM[k]
        s2 = X.c / M.sma(X.c, 200)
        r = M.ret(X.c, 250)
        row = []
        for yrs in (("2006", "2006"), ("2008", "2008"), ("2010", "2011"), ("2020", "2021"), ("2024", "2024"), ("2025", "2026")):
            w = (X.t >= f"{yrs[0]}-01-01") & (X.t <= f"{yrs[1]}-12-31")
            if w.any():
                row.append(f"{yrs[0]}–{yrs[1][2:]} {np.nanmax(s2[w]):.2f}/{np.nanmax(r[w]):+.0f}%")
        print(f"  {M.NAME[k]}: " + "; ".join(row))
    base = lambda X: BP[X.k]  # noqa: E731
    rows, by = {}, {}
    for x, y, s in itertools.product(XS, YS, SS):
        f = lambda X, x=x, y=y, s=s: add_bubble(BP[X.k], X, x, y, s)[0]  # noqa: E731
        o = M.dstat(MM, f, base)
        ok, why = M.dok(o)
        rows[(x, y, s)] = (o, ok, why)
        by[(x, y, s)] = ok
    print("\nH3a: пузырь (X = цена/SMA200, Y = рост за 250 дн., s = доля продажи) к Q2д:")
    good = []
    for key, (o, ok, why) in sorted(rows.items(), key=lambda kv: -kv[1][0]["sum"]):
        pl = M.dplateau(by, key, [XS, YS, SS])
        print(f"  {'✓' if ok and pl else ('·' if not ok else 'п')} X {key[0]:.2f} Y {key[1]} s {key[2]:.0%}: {M.dfmt(o)}{'' if ok else '  ← ' + why}")
        if ok and pl:
            good.append((key, o))
    print(f"  прошли с плато: {len(good)} из {len(rows)}")
    best = max(good, key=lambda g: g[1]["sum"])[0] if good else None
    # H3b
    print("\nH3b: сдувание (z — цена ниже SMA200 на z, g — доля резерва в месяц), поверх " + (f"H3a {best}" if best else "Q2д (с событиями H3a X1,30 Y50 s0 — только как метка пузыря)"))
    bx, by_, bs = best if best else (1.30, 50, 0.0)
    rows2, by2 = {}, {}
    for z, g in itertools.product([0.0, 0.1, 0.2], [0.25, 0.5]):
        def f(X, z=z, g=g):
            q, ev = add_bubble(BP[X.k], X, bx, by_, max(bs, 1e-9))
            if not best:
                q = BP[X.k].copy()
            return add_deflate(q, ev, X, z, g)
        ref = (lambda X: add_bubble(BP[X.k], X, bx, by_, bs)[0]) if best else base
        o = M.dstat(MM, f, ref)
        ok, why = M.dok(o)
        rows2[(z, g)] = (o, ok, why); by2[(z, g)] = ok
    for key, (o, ok, why) in sorted(rows2.items(), key=lambda kv: -kv[1][0]["sum"]):
        pl = M.dplateau(by2, key, [[0.0, 0.1, 0.2], [0.25, 0.5]])
        print(f"  {'✓' if ok and pl else '·'} z {key[0]:.0%} g {key[1]:.0%}: {M.dfmt(o)}{'' if ok else '  ← ' + why}")
    if best:
        f = lambda X: add_bubble(BP[X.k], X, *best)[0]  # noqa: E731
        print("\nЭкзамен (палладий, алюминий) для лучшего H3a: " + ", ".join(
            f"{M.NAME[k]} H1 {M.rel(MM[k].run(f(MM[k]), 'h1')[0], MM[k].run(BP[k], 'h1')[0]):+.1f} / H2 {M.rel(MM[k].run(f(MM[k]), 'h2')[0], MM[k].run(BP[k], 'h2')[0]):+.1f}" for k in M.DEXAM))
        for k in M.DSEL + M.DEXAM:
            q, ev = add_bubble(BP[k], MM[k], *best)
            print(f"  продажи H3a {M.NAME[k]}: " + ", ".join(f"{str(MM[k].t[i])[:10]} {MM[k].c[i]:.1f}" for i in np.where(ev)[0]))


if __name__ == "__main__":
    main()
