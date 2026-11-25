"""Круг 3 mlt: школа 2 — тренд. Запуск: python3 app/mlt_r3.py"""
import numpy as np

import mlt_lib as L


def t_sma(n):
    def fn(X):
        c = X.c
        m = L.sma(c, n)
        return L.hyst3(L.b(c < m), L.b(c > m))
    return L.Rule(fn, f"T1 цена к SMA{n}")


def t_mom(n):
    def fn(X):
        r = L.ret(X.c, n)
        return L.hyst3(L.b(r < 0), L.b(r > 0))
    return L.Rule(fn, f"T2 импульс {n} дн.")


def t_cross(a, b_):
    def fn(X):
        fa, fb = L.sma(X.c, a), L.sma(X.c, b_)
        return L.hyst3(L.b(fa < fb), L.b(fa > fb))
    return L.Rule(fn, f"T3 SMA{a}/SMA{b_}")


def t_don(n, m):
    def fn(X):
        c = X.c
        return L.hyst3(L.b(c < L.rmin(c, n)), L.b(c > L.rmax(c, m)))
    return L.Rule(fn, f"T4 Дончиан выход {n} / вход {m}")


def main():
    L.tee("r3.txt")
    print("Круг 3. Тренд, ядро mb1, f = 30% (прибавка смеси к ядру; решение до 2025-12)\n")
    rules = ([t_sma(n) for n in (20, 50, 100, 200)] + [t_mom(n) for n in (21, 63, 126, 250)]
             + [t_cross(a, b_) for a, b_ in ((10, 50), (20, 100), (50, 200))]
             + [t_don(n, m) for n in (20, 50, 100) for m in (n // 2, n)])
    res = L.scan(rules)
    print("\nСводка: прошли", sum(1 for z in res if z[2]), "из", len(res))
    print("\nВсе правила — ядро DCA (кратко) и после решения:")
    for r, o, g, why in res:
        od = L.check(r, core="dca", starts=False, epis=False)
        print(f"  {r.name}: DCA-ядро {L.fmt(od, short=True)} | 2005–25 {od['fsum']:+.1f} | {L.fafter(o)}")
    print("\nЛучшие 3 — точность:")
    for r, o, g, why in L.best(res, 3):
        print(f"  {r.name}: {L.pfmt(L.precision(r))}")


if __name__ == "__main__":
    main()
