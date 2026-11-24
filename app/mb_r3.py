"""Круг 3 mb: темп траты резерва в серии (g = 20/33/50/67/100% в месяц). Дневной + месячный протокол 2005–26, эпизодный тест, точность.
Запуск: python3 app/mb_r3.py"""
import numpy as np

import mb_lib as B

GS = [0.2, 0.33, 0.5, 0.67, 1.0]


def main():
    B.tee("r3.txt")
    D, DD, MM = B.load()
    ref = lambda X: B.q2d(D, X)  # noqa: E731
    res = {}
    for g in GS:
        fm = B.q2var(g=g)
        fd = lambda X, fm=fm: B.q2d(D, X, fm)  # noqa: E731
        od = B.dcheck2(MM, fd, ref)
        om = B.mcheck2(D, fm, B.Q2M)
        okd, wd = B.dok2(od)
        okm, wm = B.mok2(om)
        sec, gross, ws = B.msec(om)
        ep = B.ep_sum(B.ep_all_monthly(D, fm, B.Q2M))
        epd = B.ep_sum(B.ep_all_daily(MM, fd, ref))
        P = B.dprec2(MM, fd)
        res[g] = okd and okm and not gross and (ep["share"] >= 60 and ep["med"] >= 0)
        print(f"g = {g:.0%}:\n  дневная: {B.dfmt2(od)} → {'✓' if okd else '✗ ' + wd}\n  месячная: {B.mfmt2(om)} → {'✓' if okm else '✗ ' + wm}"
              f"{'' if sec else ' [втор.: ' + ws + ']'}\n  эпизодный тест месячный: {B.fep(ep)}\n  эпизодный тест дневной: {B.fep(epd)}\n  точность 2005–26: {B.fprec2(P)}")
    print("\nпрошли всё: " + ", ".join(f"{g:.0%}" for g, ok in res.items() if ok))
    ok = [g for g in GS if res[g] and all(res.get(GS[i], True) for i in (GS.index(g) - 1, GS.index(g) + 1) if 0 <= i < len(GS))]
    print("с плато: " + ", ".join(f"{g:.0%}" for g in ok))


if __name__ == "__main__":
    main()
