"""Металлы: исполнение раз в неделю против ежедневного (стратегия mb1 = Q2д + пауза после обвала BTC). Вопрос сессии ShiftMate:
владелец покупает металлы раз в неделю. Недельный счёт: взносы копятся всю неделю (те же $10 в торговый день), в первый торговый день
недели исполняется план прошлой недели: доля резерва 1 − Π(1 − g_дня), продажа 1 − Π(1 − f_дня); дни «копить» — их взносы в резерв.
Итог к DCA с тем же графиком денег (ежедневный DCA и недельный DCA). Запуск: python3 app/mt_weekly.py"""
import numpy as np
import mb_lib as B
import mt4_lib as M
from mb_r9 import mb1


def weekly(c, plan, t, lo, hi, rate, fee=0.001):
    cash = units = du = dw = pend = 0.0; gp = fp = 1.0; cp = 0.0
    wk = t.isocalendar().week.values * 10000 + t.isocalendar().year.values
    for i in range(lo, hi):
        p = c[i]; cash *= 1 + rate[i]
        if i > lo and wk[i] != wk[i - 1]:   # первый день новой недели: исполнить прошлую
            if fp < 1.0:
                v = (1 - fp) * units * p; units -= (1 - fp) * units; cash += v * (1 - fee)
            buy_res = (1 - gp) * max(0.0, cash - pend - cp)
            v = min(cash, max(0.0, pend - cp) + buy_res); units += v * (1 - fee) / p; cash -= v
            dw_units = pend_dca / p * (1 - fee) if (pend_dca := pend) else 0.0
            dw += dw_units
            pend = 0.0; gp = fp = 1.0; cp = 0.0
        cash += 10.0; pend += 10.0; du += 10.0 * (1 - fee) / p
        a = plan[i - 1] if i - 1 >= lo else 1.0
        if a < 0: fp *= (1 + a); cp += 10.0          # день продажи: взнос в резерв
        elif a == 0: cp += 10.0                       # копить
        elif a > 1: gp *= 1 - (a - 1)
    dw += pend * (1 - fee) / c[hi - 1]
    fin = units * c[hi - 1] + cash
    return (fin / (du * c[hi - 1]) - 1) * 100, (fin / (dw * c[hi - 1]) - 1) * 100


def main():
    D, DD, MM = B.load()
    cand = mb1(D, DD)
    print("металл: период — к ежедневному DCA: дневное исполнение / недельное (к дневному DCA) / недельное к недельному DCA")
    for k in B.DSEL + B.DEXAM:
        X = MM[k]; p = cand(X); sg = B.dsegs(X)
        for nm, (a0, a1) in (("2005–15", sg["A"]), ("2016–26", sg["B"]), ("2005–26", (sg["A"][0], X.n))):
            d = M.dsim(X.c, p, a0, a1, 0, X.rate0, 0.001)[0]
            w, ww = weekly(X.c, p, X.t, a0, a1, X.rate0)
            print(f"  {B.NAME[k]:9s} {nm}: {d:+7.1f}% / {w:+7.1f}% / {ww:+7.1f}%   (разница {M.rel(w, d):+.1f}%)")


if __name__ == "__main__":
    main()
