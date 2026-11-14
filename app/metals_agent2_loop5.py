"""Круг 5: размер продажи по росту от последней серии докупок. Основа — R4. Плюс сводка кругов 1–5 (с экзаменом).
H5a — рост < L → продажи × m (m = 0 — не продавать).  H5b — рост ≥ H → продажи × m (≤ 90%).
Рост = цена / средняя цена месяцев последней серии докупок (до первой серии — минимум за 36 мес.).
Запуск: python3 app/metals_agent2_loop5.py"""
import numpy as np
import pandas as pd

import metals_agent2_lib as A

LA, MA, HB, MB = (1.2, 1.4, 1.6, 2.0), (0.0, 0.5), (2.0, 2.5, 3.0, 4.0), (1.3, 1.6)


def rise(d, p):
    c = d["c"]
    ep = p > 1.0
    ref = np.full(len(c), np.nan)
    s = cnt = 0.0
    last = np.nan
    for i in range(len(c)):
        if ep[i]:
            if i == 0 or not ep[i - 1]:
                s = cnt = 0.0
            s += c[i]; cnt += 1
            last = s / cnt
        ref[i] = last
    fb = pd.Series(c).rolling(36, min_periods=1).min().values
    ref = np.where(np.isnan(ref), fb, ref)
    return c / ref


def scale(kind, x, m):
    def f(d):
        p = A.ver("R4")(d)
        r = rise(d, p)
        if kind == "a":
            hit = (p < 0) & (r < x)
            q = np.where(hit, p * m, p)
            return np.where(hit & (q > -1e-9), 1.0, q)
        hit = (p < 0) & (r >= x)
        return np.where(hit, np.maximum(p * m, -0.9), p)
    return f


def main():
    D = A.load()
    R3 = A.evaluate(D, A.r3)
    R4 = A.evaluate(D, A.ver("R4"))
    # распределение роста в месяцы продаж (до 1999)
    rr = np.concatenate([rise(D[k], A.ver("R4")(D[k]))[(A.ver("R4")(D[k]) < 0)] for k in A.SEL])
    print(f"рост от последней серии в месяцы продаж (вся история, 8 металлов): квартили {np.percentile(rr, 25):.2f} / {np.median(rr):.2f} / {np.percentile(rr, 75):.2f}")
    C, meta = {}, {}
    for L_ in LA:
        for m in MA:
            nm = f"H5a: рост < {L_} → продажи × {m}"
            C[nm] = scale("a", L_, m); meta[nm] = ("a", L_, m)
    for H in HB:
        for m in MB:
            nm = f"H5b: рост ≥ {H} → продажи × {m}"
            C[nm] = scale("b", H, m); meta[nm] = ("b", H, m)
    print(f"\n=== {len(C)} вариантов; только период подбора (до 1999) ===")
    rows = A.study(D, C, R4, show=16)
    axes = lambda key: (None, LA, MA) if key[0] == "a" else (None, HB, MB)   # noqa: E731
    good, by = A.pick(rows, meta, axes)
    if not good:
        print("\nНИ ОДИН вариант не прошёл критерий с плато — R4 не меняется")
    else:
        best = good[0]
        print(f"\nВЫБРАН по «до 1999»: {best['name']}\n  {A.fb(best['s'])}\n  до 1999 по металлам: {A.bymetal(best['s'], 'before')}")
        A.veto([best], R4)
        print("  итог к DCA: " + A.line(best["R"], A.SEL))

    # сводка кругов 1–5 (после принятия H5b: R5 = R4 + продажи × 1,3 при росте ≥ 2,5)
    R5 = A.evaluate(D, A.ver("R5"))
    for nm, R in (("R4", R4), ("R5", R5)):
        print(f"\n=== СВОДКА КРУГОВ 1–5: {nm} против R3 ===")
        s = A.cmp(R, R3, A.SEL)
        print("  8 металлов: " + A.fb(s) + "\n  " + A.fa(s))
        print("  экзамен (палладий, олово) к R3, до/после/вся: " + A.exam(R, R3))
        print(f"  итог к DCA {nm}: " + A.line(R, A.metals(D)))
        print(f"  метрики {nm} (8 металлов, вся история): " + A.fprox(A.agg(R, A.SEL)) + "\n  экзамен: " + A.fprox(A.agg(R, A.EXAM)))


if __name__ == "__main__":
    main()
