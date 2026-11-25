"""Круг 4 mbx: CFTC COT — диагностика капитуляции спекулянтов и «малая серия» по ней. Запуск: python3 app/mbx_r4.py"""
import numpy as np

import mbx_lib as X
from mbx_r1 import BOTS, fwd

COTK = list(X.COT_CODE)
SIG = [("idx", 0.1), ("idx", 0.2), ("pct", 0.1), ("pct", 0.2), ("net", 0.0)]
EPO = [("1989–98", "1989-01-01", "1999-01-01"), ("1999–04", "1999-01-01", "2005-01-01"), ("2005–15", "2005-01-01", "2016-01-01"),
       ("2016–23", "2016-01-01", "2024-01-01")]


def ccond(d, k, nm, thr):
    if k not in X.COT_CODE:
        return np.zeros(len(d["c"]), bool)
    v = X.cot_monthly(d, k)[nm]
    return np.nan_to_num(v, nan=9.0) <= thr


def small_cot(nm, thr, g, cool=True, retr=None):
    def f(d):
        p0 = X.Q2M(d)
        m = ccond(d, d["key"], nm, thr)
        if retr is not None:
            m = m & X.mcond(d, "retr", retr)
        ok = (p0 == 1.0) | ((p0 == 0.0) if cool else False)
        return np.where(ok & m, 1.0 + g, p0)
    return f


def main():
    X.tee("r4.txt")
    D, DD, MM = X.load()
    for k in D:
        if not k.startswith("_"):
            D[k]["key"] = k
    print("=== H4a: избыток роста 24 мес. (12 мес.) после месяцев капитуляции COT, п.п.; 5 металлов [месяцев] ===")
    for nm, thr in SIG:
        row = []
        for ep, a, b in EPO:
            e24, e12, cnt = [], [], 0
            for k in COTK:
                d = D[k]
                c, t = d["c"], d["t"]
                w = (t >= a) & (t < b) & np.isfinite(X.cot_monthly(d, k)["idx"])
                m = ccond(d, k, nm, thr) & w
                for h, acc in ((24, e24), (12, e12)):
                    f = fwd(c, t, h)
                    v = f[m]
                    acc.extend(list(v[np.isfinite(v)] - np.nanmean(f[w])))
                cnt += int(m.sum())
            row.append((ep, np.mean(e24) if e24 else np.nan, np.mean(e12) if e12 else np.nan, cnt))
        r = {ep: x for ep, *x in row}
        ok = r["2005–15"][0] > 5 and r["2016–23"][0] > 5 and r["1989–98"][0] >= 0
        print(f"  {nm} ≤ {thr}: " + " | ".join(f"{ep} {a:+6.1f} ({b:+5.1f}) [{n}]" for ep, a, b, n in row) + ("  ✓" if ok else ""))
    print("\n=== H4a/H4b: на современных доньях и на спуске 2013-01…2015-06 ===")
    hit = {s: 0 for s in SIG}
    npair = 0
    for k in COTK:
        d = D[k]
        c, t = d["c"], d["t"]
        o = X.cot_monthly(d, k)
        row = []
        for bn, (a, b) in BOTS.items():
            w = np.where((t >= a) & (t <= b))[0]
            j = w[int(np.argmin(c[w]))]
            npair += 1
            for s in SIG:
                if ccond(d, k, *s)[max(0, j - 3): j + 4].any():
                    hit[s] += 1
            row.append(f"{bn}: net {o['net'][j]:+.2f}, idx {o['idx'][j]:.2f}, pct {o['pct'][j]:.2f}")
        w = (t >= "2013-01-01") & (t <= "2015-06-30")
        pre = {f"{s[0]}≤{s[1]}": int((ccond(d, k, *s) & w).sum()) for s in SIG}
        pr = {f"retr≥0.62": int((X.mcond(d, "retr", 0.62) & w).sum()), "ddath≥0.5": int((X.mcond(d, "ddath", 0.5) & w).sum())}
        print(f"  {X.NAME[k]:8s} " + "; ".join(row))
        print(f"           спуск 2013-01…2015-06 (30 мес.): COT {pre}; цена {pr}; сейчас net {o['net'][-1]:+.2f}, idx {o['idx'][-1]:.2f}, pct {o['pct'][-1]:.2f}")
    print("  доля доньев (±3 мес.): " + ", ".join(f"{s[0]}≤{s[1]} {hit[s]}/{npair}" for s in SIG))

    print("\n=== H4c: «малая серия» по COT ===")
    Bn = X.Bench(D, DD, MM)
    mref = X.mwrap(X.Q2M, DD)
    rows = []
    for nm, thr in SIG:
        for g in (0.1, 0.2):
            for cool in (True, False):
                for rt in (None, 0.5):
                    name = f"COT {nm}≤{thr} g {g:.0%}{'' if cool else ' ′'}{' + откат≥50%' if rt else ''}"
                    fn = small_cot(nm, thr, g, cool, rt)
                    o = X.dcheck3(Bn, fn)
                    ok, why = X.dok3(o)
                    om = X.mcheck3(D, X.mwrap(fn, DD), mref)
                    okm, whym = X.mok3(om)
                    rows.append((name, o, om, ok and okm))
                    print(f"\n{name}\n  дневная: {X.dfmt3(o)} → {'ПРОХОДИТ' if ok else 'нет: ' + why}")
                    print(f"  месячная: {X.mfmt3(om)} → {'да' if okm else 'нет: ' + whym}")
                    print(f"  после решения: {X.dafter(o)}; месячная 2005–2026.10 {om['y26_sum']:+.1f}")
    print("\nСВОДКА (дневная сумма A/B / месячная / втор. 82 / вся история / после решения 2005–26 дневная):")
    for name, o, om, ok in rows:
        print(f"  {name:38s} {o['sum']:+6.1f} (A {o['A']:+.1f} B {o['B']:+.1f}, {o['ok']}/8) | {om['sum']:+6.1f} ({om['ok']}/16) | {om['sec82_sum']:+6.1f} | {om['all_sum']:+6.1f} | {o['f26sum']:+6.1f}{'  ✓' if ok else ''}")


if __name__ == "__main__":
    main()
