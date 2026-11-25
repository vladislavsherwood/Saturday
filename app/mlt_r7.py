"""Круг 7 mlt: формы откупа HY3 и рыночные данные (CFTC, GVZ, перегрев SMA200). Запуск: python3 app/mlt_r7.py"""
import numpy as np
import pandas as pd
from numba import njit

import mlt_lib as L
import mbx_lib
import mop_lib

BASE = dict(rg="Ra", z=1.25, k50=2.0, nb=20, rsib=50, maxout=126, zn=21)


@njit(cache=True)
def hyst_rev(sell, arm, c, thr, maxout):
    """Продажа → вне металла; «взвод» при arm; после взвода откуп, когда закрытие > минимума с момента взвода × (1 + thr); срок maxout."""
    n = len(sell)
    out = np.empty(n)
    e = 1.0
    armed = False
    mn = 0.0
    cnt = 0
    for j in range(n):
        if e == 1.0:
            if sell[j]:
                e = 0.0
                armed = False
                cnt = 0
        else:
            cnt += 1
            if not armed and arm[j]:
                armed = True
                mn = c[j]
            if armed:
                mn = min(mn, c[j])
                if c[j] > mn * (1 + thr[j]):
                    e = 1.0
            if maxout > 0 and cnt >= maxout:
                e = 1.0
        out[j] = e
    return out


def bk(form, par=None, upform="RSI"):
    def fn(X):
        f = L.F(X)
        c = X.c
        up, s_dn, s_up, bb0 = L.hy3_parts(X, **{k: v for k, v in BASE.items() if k != "maxout"})
        s = s_dn | s_up
        sd = f["sd250"]
        bup = L.b(f["rsi"] < 50) if upform == "RSI" else L.b(c <= L.sma(c, 20))
        if form == "BK1":
            bdn = L.b(np.log(c / L.sma(c, 20)) < -par * sd * np.sqrt(20))
        elif form == "BK3":
            bdn = L.b(f["rsi"] < 40)
        else:
            bdn = L.b(c <= L.sma(c, 20))
        if form == "BK2":
            arm = np.where(up, bup, bdn)
            return hyst_rev(s, arm, c, np.nan_to_num(par * sd * np.sqrt(5)), 126)
        return L.hyst(s, np.where(up, bup, bdn), 126)
    nm = {"BK0": "откуп ≤ SMA20 (HY3)", "BK1": f"откуп ≤ SMA20 − {par}σ√20", "BK2": f"откуп на развороте +{par}σ√5 после касания", "BK3": "откуп RSI < 40"}[form]
    return L.Rule(fn, f"HY3 {nm}; в режиме {'RSI<50' if upform == 'RSI' else '≤ SMA20'}")


def cot_pct(X):
    """Перцентиль чистой позиции некоммерческих (CFTC, 260 недель) на днях металла; отчёт известен через 4 дня."""
    w = mbx_lib.cot_weekly(X.k)
    net = w["net"]
    pct = net.rolling(260, min_periods=104).apply(lambda x: (x[:-1] < x[-1]).mean(), raw=True)
    pct.index = pct.index + pd.Timedelta(days=4)
    return L.C.on_days(pct, X.t)


def gvz(X):
    s = mop_lib.ser("^GVZ")
    return L.C.on_days(s, X.t)


def main():
    L.tee("r7.txt")
    print("Круг 7. Формы откупа и рыночные данные поверх HY3; ядро mb1, f = 30%\n")
    rules = [bk("BK0"), bk("BK0", upform="SMA20"), bk("BK1", 0.5), bk("BK1", 1.0), bk("BK2", 0.5), bk("BK2", 1.0), bk("BK2", 0.5, "SMA20"), bk("BK3")]
    print("--- формы откупа ---")
    res = L.scan(rules)
    print("\nточность форм откупа (место откупов; перемешанные у HY3 — 0,47):")
    for r, o, g, why in res:
        p = L.precision(r)
        print(f"  {r.name}: Σ {o['sum']:+.1f}; {L.pfmt(p)}")
    print("\n--- рыночные данные (фильтры/триггеры поверх HY3) ---")
    H = lambda **kw: L.HY3(**{**BASE, **kw})  # noqa: E731
    is_prec = lambda X: X.k in ("gold", "silver", "platinum", "palladium")  # noqa: E731
    rr = [
        H(sell_ok=lambda X: L.b(cot_pct(X) > 0.5) | L.regime(X) | ~np.isfinite(cot_pct(X)), name="C1 продажа вне режима при CFTC > медианы 5 лет"),
        L.Rule(lambda X: L.hyst(L.hy3_parts(X)[1] | L.hy3_parts(X)[2] | (L.b(cot_pct(X) > 0.95) & ~L.regime(X)), L.hy3_parts(X)[3], 126),
               "C2 + продажа вне режима при CFTC в верхних 5%"),
        H(buy_force=lambda X: (L.b(gvz(X) / L.sma(gvz(X), 50) > 1.3) if is_prec(X) else np.zeros(X.n, bool)), name="G1 откуп сразу при всплеске GVZ > 1,3×SMA50"),
        H(sell_ok=lambda X: (L.b(gvz(X) < L.sma(gvz(X), 50)) | L.regime(X)) if is_prec(X) else np.ones(X.n, bool), name="G2 продажа вне режима при GVZ < SMA50"),
        L.Rule(lambda X: L.hyst(L.hy3_parts(X)[1] | (L.b(np.log(L.F(X)["ma200"]) > 3 * L.F(X)["sd250"] * np.sqrt(50)) & L.regime(X)), L.hy3_parts(X)[3], 126),
               "O1 в режиме — перегрев к SMA200 > 3σ√50 вместо отрыва от SMA50"),
    ]
    r2 = L.scan(rr)
    o0 = res[0][1]
    for r, o, g, why in r2:
        print(f"  {r.name}: к HY3 {o['sum'] - o0['sum']:+.1f} (A {o['A'] - o0['A']:+.1f}, B {o['B'] - o0['B']:+.1f}); {L.fafter(o)}")


if __name__ == "__main__":
    main()
