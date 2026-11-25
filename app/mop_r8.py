"""Круг 8 mop: О1-AuAg (только золото — GVZ и серебро — VXSLV), плато, концентрация по годам, реализованная замена, 2026. Запуск: python3 app/mop_r8.py"""
import numpy as np

import mop_lib as P
from mop_r4 import o1

AUAG = ("gold", "silver")


def only(fn, keys=AUAG):
    def f(X):
        return fn(X) if X.k in keys else P.mb1(X)
    return f


def rv_rule(y, g):
    gd = 1 - (1 - g) ** (1 / 21)
    V = P.vol()

    def f(X):
        p = P.mb1(X)
        if X.k not in AUAG:
            return p
        with np.errstate(invalid="ignore"):
            m = np.nan_to_num(P.rvol(X.c) - P.on(V["^VIX"], X) < -y).astype(bool) & (p >= 0) & (p <= 1.0)
        q = p.copy()
        q[m] = 1.0 + gd
        return q
    return f


def main():
    P.tee("r8.txt")
    D, DD, MM = P.load()
    print("(1) плато О1-AuAg (до 2025-12; ✓/✗ и сумма; по всему ряду):")
    grid = {}
    for g in (0.33, 0.5, 0.8):
        row = []
        for y in (6, 8, 10, 12, 14, 16):
            fn = only(o1(y=y, g=g))
            o = P.check(MM, fn, None, P.DSEL, P.END25)
            k, why = P.ok(o)
            of = P.check(MM, fn, None, P.DSEL, None, starts=False)
            grid[(g, y)] = (k, o, of)
            row.append(f"y{y}: {'✓' if k else '✗'} {o['sum']:+.1f} [{of['sum']:+.1f}]")
        print(f"  g {g:.0%}: " + "; ".join(row))
    k, o, of = grid[(0.5, 10)]
    print(f"\n  О1-AuAg y 10, g 50%: {P.fmt(o)} → {P.ok(o)}")
    print(f"  весь ряд: {P.fmt(of)}")
    print("\n(2) вклад по годам (y 10, g 50%):")
    base = only(o1())
    tot = o["sum"]
    rows = []
    for yr in range(2008, 2026):
        oy = P.check(MM, only(o1(off=(f"{yr}-01-01", f"{yr}-12-31"))), None, P.DSEL, P.END25, starts=False, eps=False, extra=False)
        if abs(tot - oy["sum"]) > 0.05:
            rows.append((yr, tot - oy["sum"]))
    for yr, d in rows:
        print(f"  {yr}: {d:+.1f} ({d / tot * 100:.0f}%)")
    top = max(rows, key=lambda r: r[1])
    print(f"  крупнейший год {top[0]} — {top[1] / tot * 100:.0f}% → {'да' if top[1] / tot < 0.5 else 'нет'}")
    for y, g in ((8, 0.5), (12, 0.5), (10, 0.8)):
        oo = P.check(MM, only(o1(y=y, g=g)), None, P.DSEL, P.END25, starts=False, eps=False, extra=False)
        o22 = P.check(MM, only(o1(y=y, g=g, off=("2022-01-01", "2022-12-31"))), None, P.DSEL, P.END25, starts=False, eps=False, extra=False)
        o08 = P.check(MM, only(o1(y=y, g=g, off=("2008-01-01", "2008-12-31"))), None, P.DSEL, P.END25, starts=False, eps=False, extra=False)
        print(f"  сосед y {y}, g {g:.0%}: Σ {oo['sum']:+.1f}, доля 2022 {(oo['sum'] - o22['sum']) / oo['sum'] * 100:.0f}%, доля 2008 {(oo['sum'] - o08['sum']) / oo['sum'] * 100:.0f}%")
    print("\n(3) весь ряд до 2026-11: " + ", ".join(f"{P.NAME[q]} {of['cells'][(q, 'A')]:+.1f}/{of['cells'][(q, 'B')]:+.1f}, вся история {of['all'][q]:+.1f}" for q in AUAG))
    print("\n(4) реализованная замена (реализ. вол − VIX < −y), только золото и серебро:")
    for g in (0.5, 0.8):
        print(f"  g {g:.0%}: " + "; ".join(f"y{y}: {P.check(MM, rv_rule(y, g), None, P.DSEL, P.END25, starts=False, eps=False)['sum']:+.1f}" for y in (6, 8, 10, 12, 14, 16)))
    print("\n(5) по металлам (y 10, g 50%), до 2025-12 / весь ряд: ячейки A/B, с 2008, с 2011, вся история с 2000:")
    for q in AUAG:
        print(f"  {P.NAME[q]}: {o['cells'][(q, 'A')]:+.1f}/{o['cells'][(q, 'B')]:+.1f}, с08 {o['c08'][q]:+.1f}, с11 {o['c11'][q]:+.1f}, с 2000 {o['all'][q]:+.1f} | "
              f"весь: {of['cells'][(q, 'A')]:+.1f}/{of['cells'][(q, 'B')]:+.1f}, с08 {of['c08'][q]:+.1f}, с11 {of['c11'][q]:+.1f}, с 2000 {of['all'][q]:+.1f}")
    print("  без эпизода (до 2025-12): " + ", ".join(f"{nm} {v:+.1f}" for nm, v in o["epsum"].items()))


if __name__ == "__main__":
    main()
