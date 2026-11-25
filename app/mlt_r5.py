"""Круг 5 mlt: гибрид — режим по тренду, точки по контртренду. Запуск: python3 app/mlt_r5.py"""
import numpy as np

import mlt_lib as L


def regime(X, kind):
    f = L.F(X)
    c = X.c
    if kind == "Ra":
        return L.b(f["ma200"] > 1) & L.b(L.sma(c, 50) > L.sma(c, 200))
    if kind == "Rb":
        return L.b(f["ma200"] > 1)
    if kind == "Rc":
        return L.b(f["r250"] > 0)
    raise ValueError(kind)


def ob(X, kind, thr):
    f = L.F(X)
    if kind == "RSI":
        return L.b(f["rsi"] > thr)
    if kind == "Z21":
        return L.b(f["z21"] > thr)
    raise ValueError(kind)


def hy1(rg, kind, thr, back="SMA20", maxout=126):
    def fn(X):
        up = regime(X, rg)
        s = ob(X, kind, thr) & ~up
        f = L.F(X)
        if back == "SMA20":
            bb = L.b(X.c <= L.sma(X.c, 20))
        else:
            bb = L.b(f["rsi"] < 45)
        return L.hyst(s, bb, maxout)
    return L.Rule(fn, f"HY1 {rg} {kind}>{thr} откуп {back}/{maxout}")


def hy2(rg, kind, thr, exitk, maxin=63):
    def fn(X):
        f = L.F(X)
        up = regime(X, rg)
        if kind == "RSI":
            buy = L.b(f["rsi"] < thr)
        else:
            buy = L.b(f["z21"] < -thr)
        if exitk == "RSI55":
            ex = L.b(f["rsi"] > 55)
        else:
            ex = L.b(f["ma50"] > 1)
        # автомат по x = 1 − e вне режима: x = 1 (вне металла) → покупка → x = 0 → выход/срок → x = 1
        x = L.hyst(buy, ex, maxin, 1.0)
        return np.where(up, 1.0, 1 - x)
    return L.Rule(fn, f"HY2 {rg} покупка {kind}<{'−' if kind != 'RSI' else ''}{thr}, выход {exitk}/{maxin}")


def hy3(rg, kind, thr, k50=2.0):
    def fn(X):
        f = L.F(X)
        up = regime(X, rg)
        s = (ob(X, kind, thr) & ~up) | (L.b(np.log(f["ma50"]) > k50 * f["sd250"] * 5) & up)
        bb = np.where(up, L.b(f["rsi"] < 50), L.b(X.c <= L.sma(X.c, 20)))
        return L.hyst(s, bb, 126)
    return L.Rule(fn, f"HY3 {rg} {kind}>{thr} + в росте отрыв>{k50}σ√25")


def main():
    L.tee("r5.txt")
    print("Круг 5. Гибрид, ядро mb1, f = 30%\n")
    rules = []
    for rg in ("Ra", "Rb", "Rc"):
        for kind, thrs in (("RSI", (60, 65, 70)), ("Z21", (1.0, 1.25, 1.5))):
            for t in thrs:
                for bk in ("SMA20", "RSI45"):
                    rules.append(hy1(rg, kind, t, bk))
    print("--- HY1: продавай отскоки вне сильного роста ---")
    r1 = L.scan(rules)
    print("--- HY2: покупай провалы в нисходящем (по умолчанию вне металла) ---")
    r2 = L.scan([hy2(rg, kind, t, ex) for rg in ("Ra", "Rb") for kind, t in (("RSI", 30), ("RSI", 35), ("Z21", 1.5)) for ex in ("RSI55", "SMA50")])
    print("--- HY3: HY1 + крайний перегрев в росте ---")
    r3 = L.scan([hy3(rg, kind, t) for rg in ("Ra", "Rb", "Rc") for kind, t in (("RSI", 65), ("RSI", 70), ("Z21", 1.25), ("Z21", 1.5))])
    res = r1 + r2 + r3
    print("\nСводка: прошли", sum(1 for z in res if z[2]), "из", len(res))
    arr = np.array([z[1]["sum"] for z in r1])
    print(f"HY1: медиана {np.median(arr):+.1f}, B > 0 у {sum(1 for z in r1 if z[1]['B'] > 0)}/{len(r1)}, сделок ≥ 2 у {sum(1 for z in r1 if z[1]['tpy_min'] >= 2)}")
    print("\nЛучшие 4 по сумме (среди ≥ 1,5 сделки/год) — ядро DCA, после решения, точность:")
    pool = [z for z in res if z[1]["tpy_min"] >= 1.5]
    for r, o, g, why in L.best(pool, 4):
        print(f"  {r.name}: {L.fmt(o)} | сделок/год {o['tpy']:.1f} (мин {o['tpy_min']:.1f}) → {'✓' if g else '✗ ' + why}")
        od = L.check(r, core="dca", starts=False, epis=False)
        print(f"     ядро DCA: {L.fmt(od, short=True)} | 2005–25 {od['fsum']:+.1f}")
        print(f"     {L.fafter(o)}")
        print(f"     точность: {L.pfmt(L.precision(r))}")


if __name__ == "__main__":
    main()
