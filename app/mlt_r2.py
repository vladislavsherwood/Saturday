"""Круг 2 mlt: школа 1 — возврат к среднему (контртренд). Запуск: python3 app/mlt_r2.py"""
import numpy as np

import mlt_lib as L


def sell_sig(X, kind, thr):
    f = L.F(X)
    c = X.c
    if kind == "RSI":
        return f["rsi"] > thr
    if kind == "BB":
        return (c - L.sma(c, 20)) / L.sstd(c, 20) > thr
    if kind == "Z21":
        return f["z21"] > thr
    if kind == "MA50":
        return np.log(f["ma50"]) > thr * f["sd250"] * 5
    raise ValueError(kind)


def mr_rule(kind, thr, back, regime=0):
    def fn(X):
        f = L.F(X)
        c = X.c
        s = L.b(sell_sig(X, kind, thr))
        if regime == 1:
            strong = L.b(f["ma200"] > 1) & L.b(L.sma(c, 50) > L.sma(c, 200))
            s = s & ~strong
        if back == "B1":
            return L.hyst(s, L.b(c <= L.sma(c, 20)), 126)
        if back == "B2":
            return L.hyst(s, L.b(f["rsi"] < 50), 126)
        if back == "B3":
            return L.hyst(s, np.zeros(X.n, bool), 21)
        if back == "B4":
            return L.hyst(s, np.zeros(X.n, bool), 63)
    return L.Rule(fn, f"{kind}>{thr} откуп {back}{' r1' if regime else ''}")


def mr_out(thr, maxin):
    """Зеркальный: по умолчанию вне металла; покупка при RSI14 < thr, продажа при RSI14 > 50 или через maxin дн."""
    def fn(X):
        f = L.F(X)
        buy = L.b(f["rsi"] < thr)
        sell = L.b(f["rsi"] > 50)
        e = L.hyst(buy, sell, maxin, 1.0)   # автомат по x = 1 − e: x = 1 (вне) → покупка → x = 0 → продажа/срок → x = 1
        return 1 - e
    return L.Rule(fn, f"по умолчанию вне: покупка RSI<{thr}, продажа RSI>50 / {maxin} дн.")


def main():
    L.tee("r2.txt")
    print("Круг 2. Контртренд, ядро mb1, f = 30% (прибавка смеси к ядру, сумма лог-разниц 8 ячеек; решение до 2025-12)\n")
    grid = {"RSI": (70, 75, 80), "BB": (2.0, 2.5, 3.0), "Z21": (1.5, 2.0, 2.5), "MA50": (1.5, 2.0, 2.5)}
    allres = []
    for regime in (0, 1):
        for kind, thrs in grid.items():
            print(f"--- {kind}, фильтр режима r{regime} ---")
            rules = [mr_rule(kind, t, bk, regime) for t in thrs for bk in ("B1", "B2", "B3", "B4")]
            allres += L.scan(rules)
    print("--- зеркальный (по умолчанию вне металла) ---")
    allres += L.scan([mr_out(t, m) for t in (30, 25) for m in (21, 63)])
    print("\nСводка: прошли", sum(1 for z in allres if z[2]), "из", len(allres))
    arr = np.array([z[1]["sum"] for z in allres])
    arrB = np.array([z[1]["B"] for z in allres])
    arrA = np.array([z[1]["A"] for z in allres])
    print(f"сумма: медиана {np.median(arr):+.1f}, макс {arr.max():+.1f}; A медиана {np.median(arrA):+.1f}; B медиана {np.median(arrB):+.1f}, B > 0 у {int((arrB > 0).sum())}/{len(arrB)}")
    print("\nЛучшие 5 по сумме (полные строки + точность + ядро DCA):")
    for r, o, g, why in L.best(allres, 5):
        print(f"  {r.name}: {L.fmt(o)} | сделок/год {o['tpy']:.1f} → {'✓' if g else '✗ ' + why}")
        print(f"     {L.fafter(o)}")
        p = L.precision(r)
        print(f"     точность: {L.pfmt(p)}")
        od = L.check(r, core="dca")
        print(f"     ядро DCA: {L.fmt(od, short=True)}")


if __name__ == "__main__":
    main()
