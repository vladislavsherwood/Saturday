"""Круг 5 mb: H5a — серия и при ≥ 4 из 8 маркеров дна p мес. подряд; H5b — скользящие пороги маркеров дна (W лет, по 8 металлам, только прошлое).
Запуск: python3 app/mb_r5.py"""
import numpy as np

import mb_lib as B
import metals_agent_lib as L
from metals_agent3_loop5 import cool

PS = (1, 2, 3, 4, 6)
WS = (15, 20, 30, 99)


def q2_persist(p):
    if p == 1:
        return B.q2var(k_on=4)
    return B.q2var(persist=p)


def rolling_bn(D, W):
    """Счётчик маркеров дна со скользящими порогами: для месяца i порог — 20/80-й процентиль значений признака по 8 металлам за [i − 12W, i)."""
    keys = B.A.SEL
    t = D["gold"]["t"]
    bot = D["gold"]["bot"]
    out = {}
    thr_t = {}
    for f, dr in bot:
        # общий календарь: берём ряды по датам
        vals = {k: dict(zip(D[k]["t"], D[k]["F"][f].values)) for k in keys}
        dates = sorted(set().union(*[set(D[k]["t"]) for k in keys]))
        arr = np.array([[vals[k].get(dt, np.nan) for k in keys] for dt in dates])
        th = np.full(len(dates), np.nan)
        for i in range(len(dates)):
            a = 0 if W == 99 else max(0, i - 12 * W)
            v = arr[a:i].ravel()
            v = v[np.isfinite(v)]
            if len(v) >= 12 * 8 * 5:          # нужно ≥ 5 лет истории
                th[i] = np.quantile(v, 0.8 if dr == "hi" else 0.2)
        thr_t[(f, dr)] = dict(zip(dates, th))
    for k in B.ALLM:
        d = D[k]
        n = np.zeros(len(d["c"]), np.int64)
        for f, dr in bot:
            x = d["F"][f].values
            th = np.array([thr_t[(f, dr)].get(dt, np.nan) for dt in d["t"]])
            fixed = D["_thr3"][(f, dr)]
            th = np.where(np.isfinite(th), th, fixed)
            h = (x > th) if dr == "hi" else (x < th)
            n += np.nan_to_num(h, nan=0).astype(np.int64)
        out[k] = n
    return out, thr_t


def q2_bn(BN):
    def f(d):
        return cool(lambda dd: B.A.r3(dd, hot2=0.5, bn=BN[dd["key"]], nb=8), 0.2, 24)(d)
    return f


def report(D, MM, name, fm, ref_d):
    fd = lambda X: B.q2d(D, X, fm)  # noqa: E731
    om = B.mcheck2(D, fm, B.Q2M)
    od = B.dcheck2(MM, fd, ref_d)
    okm, wm = B.mok2(om)
    okd, wd = B.dok2(od)
    sec, gross, ws = B.msec(om)
    ser16 = {k: int((np.asarray(fm(D[k])) > 1)[B._ix(D[k]["t"], B.B0):].sum()) for k in B.A.SEL}
    print(f"{name}:\n  месячная: {B.mfmt2(om)} → {'✓' if okm else '✗ ' + wm}{'' if sec else ' [втор.: ' + ws + ']'}{' ГРУБО' if gross else ''}"
          f"\n  дневная: {B.dfmt2(od)} → {'✓' if okd else '✗ ' + wd}"
          f"\n  месяцев серии 2016–26: " + ", ".join(f"{B.NAME[k][:3]} {v}" for k, v in ser16.items())
          + f"\n  точность 2005–26 (дневная): {B.fprec2(B.dprec2(MM, fd))}")
    return okm and okd and not gross, om, od


def main():
    B.tee("r5.txt")
    D, DD, MM = B.load()
    ref_d = lambda X: B.q2d(D, X)  # noqa: E731
    print(f"Q2д точность 2005–26: {B.fprec2(B.dprec2(MM, ref_d))}\n")
    print("=== H5a: серия и при ≥ 4 из 8 маркеров p мес. подряд ===")
    oka = {}
    for p in PS:
        oka[p], _, _ = report(D, MM, f"p = {p}", q2_persist(p), ref_d)
    good = [p for p in PS if oka[p] and all(oka[PS[i]] for i in (PS.index(p) - 1, PS.index(p) + 1) if 0 <= i < len(PS))]
    print("  прошли: " + str([p for p in PS if oka[p]]) + "; с плато: " + str(good))
    print("\n=== H5b: скользящие пороги маркеров дна ===")
    okb = {}
    for W in WS:
        BN, thr = rolling_bn(D, W)
        fm = q2_bn(BN)
        okb[W], _, _ = report(D, MM, f"W = {'расширяющееся' if W == 99 else str(W) + ' лет'}", fm, ref_d)
        last = {f[:20]: round(v[max(v)], 2) for (f, dr), v in thr.items()}
        print(f"  пороги на 2026-10: {last}")
    print("  прошли: " + str([w for w in WS if okb[w]]))
    print("\nфиксированные пороги (1965–98): " + str({f[:20]: round(v, 2) for (f, dr), v in D["_thr3"].items() if (f, dr) in D["gold"]["bot"]}))


if __name__ == "__main__":
    main()
