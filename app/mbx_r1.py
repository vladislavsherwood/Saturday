"""Круг 1 mbx: диагностика ценовых признаков металла, резерв mb1 на современных доньях, работа остывания. Запуск: python3 app/mbx_r1.py"""
import numpy as np
import pandas as pd

import mbx_lib as X
import mt4_lib as M

GRID = [("dd36", 0.3), ("dd36", 0.4), ("dd36", 0.5), ("dd36", 0.6), ("ddath", 0.4), ("ddath", 0.5), ("ddath", 0.6), ("ddath", 0.7),
        ("ma48", 0.85), ("ma48", 0.75), ("ma48", 0.65), ("rsi", 35), ("rsi", 30), ("rsi", 25), ("retr", 0.5), ("retr", 0.62), ("retr", 0.8),
        ("base", 1.2), ("base", 1.0)]
EPO = [("1965–81", "1965-01-01", "1982-01-01"), ("1982–98", "1982-01-01", "1999-01-01"), ("1999–04", "1999-01-01", "2005-01-01"),
       ("2005–15", "2005-01-01", "2016-01-01"), ("2016–23", "2016-01-01", "2024-01-01")]
BOTS = {"2008": ("2008-07-01", "2009-06-30"), "2015": ("2013-01-01", "2016-06-30"), "2018": ("2018-01-01", "2019-06-30"),
        "2020": ("2020-01-01", "2020-06-30"), "2022": ("2022-01-01", "2022-12-31")}
MOD = ["gold", "silver", "platinum", "palladium", "copper"]


def fwd(c, t, h):
    """Лог-рост за h мес. вперёд; окна, кончающиеся после 12.2025, — NaN (критерий «в»)."""
    n = len(c)
    out = np.full(n, np.nan)
    cut = X.ix(t, X.CUT)
    for i in range(n):
        if i + h < min(n, cut):
            out[i] = np.log(c[i + h] / c[i]) * 100
    return out


def main():
    X.tee("r1.txt")
    D, DD, MM = X.load()
    print("=== H1a: избыток роста за 24 мес. (12 мес.) после месяцев с признаком, п.п. к среднему металла в эпохе; 8 металлов отбора [месяцев] ===")
    res = {}
    for nm, thr in GRID:
        row = []
        for ep, a, b in EPO:
            ex24, ex12, cnt = [], [], 0
            for k in X.MSEL:
                d = D[k]
                c, t = d["c"], d["t"]
                w = (t >= a) & (t < b)
                m = X.mcond(d, nm, thr) & w
                for h, acc in ((24, ex24), (12, ex12)):
                    f = fwd(c, t, h)
                    base = np.nanmean(f[w])
                    v = f[m]
                    v = v[np.isfinite(v)]
                    acc.extend(list(v - base))
                cnt += int(m.sum())
            e24 = float(np.mean(ex24)) if ex24 else np.nan
            e12 = float(np.mean(ex12)) if ex12 else np.nan
            row.append((ep, e24, e12, cnt))
        res[(nm, thr)] = row
        r = {ep: (e24, e12, n) for ep, e24, e12, n in row}
        ok = (r["2005–15"][0] > 5) and (r["2016–23"][0] > 5) and (r["1982–98"][0] >= 0)
        print(f"  {nm:5s} {thr:<5}: " + " | ".join(f"{ep} {e24:+6.1f} ({e12:+5.1f}) [{n}]" for ep, e24, e12, n in row) + ("  ✓ H1a" if ok else ""))

    print("\n=== H1b: признаки на современных доньях (месяц минимума месячной средней в окне) ===")
    hits = {g: 0 for g in GRID}
    npair = 0
    for k in MOD:
        d = D[k]
        c, t = d["c"], d["t"]
        f = X.pfeat(d)
        for bn, (a, b) in BOTS.items():
            w = np.where((t >= a) & (t <= b))[0]
            if len(w) == 0:
                continue
            j = w[int(np.argmin(c[w]))]
            npair += 1
            fired = []
            for g in GRID:
                m = X.mcond(d, *g)
                if m[max(0, j - 3): j + 4].any():
                    hits[g] += 1
                    fired.append(f"{g[0]}{g[1]}")
            print(f"  {X.NAME[k]:8s} {bn}: дно {str(t[j])[:7]} цена {c[j]:.1f}, макро-маркеров {int(d['bn3'][j])}, dd36 {f['dd36'][j]*100:+.0f}%, "
                  f"от рекорда {f['ddath'][j]*100:+.0f}%, к ср.48 {f['ma48'][j]:.2f}, RSI {f['rsi'][j]:.0f}, откат {f['retr'][j]:.2f}, к основанию {f['base'][j]:.2f}")
    print("  доля пар (из %d), где признак горел ±3 мес.: " % npair + ", ".join(f"{g[0]}{g[1]} {hits[g]}/{npair}" for g in GRID))

    print("\n=== СЕЙЧАС (решение по 2026-10; справочно, не для отбора) ===")
    for k in X.MSEL + ["palladium", "tin"]:
        d = D[k]
        f = X.pfeat(d)
        print(f"  {X.NAME[k]:8s}: цена {d['c'][-1]:.1f}, dd36 {f['dd36'][-1]*100:+.0f}%, от рекорда {f['ddath'][-1]*100:+.0f}%, к ср.48 {f['ma48'][-1]:.2f}, "
              f"RSI {f['rsi'][-1]:.0f}, откат {f['retr'][-1]:.2f}, к основанию {f['base'][-1]:.2f}, макро {int(d['bn3'][-1])}")

    print("\n=== H1c: доля резерва в капитале mb1 (месячный аналог, старт 2005-01) на современных доньях ===")
    fm = X.mwrap(X.Q2M, DD)
    low = 0
    tot = 0
    for k in MOD:
        d = D[k]
        c, t = d["c"], d["t"]
        p = fm(d)
        a0, a1 = X.ix(t, X.A0), X.ix(t, X.CUT)
        U, C, _ = M.msim_state(c, p, a0, a1, 0)
        row = []
        for bn, (a, b) in BOTS.items():
            w = np.where((t >= a) & (t <= b))[0]
            if len(w) == 0:
                continue
            j = w[int(np.argmin(c[w]))]
            sh = C[j] / (C[j] + U[j] * c[j]) * 100 if (C[j] + U[j] * c[j]) > 0 else 0
            tot += 1
            low += sh <= 5
            row.append(f"{bn} {sh:.0f}%")
        print(f"  {X.NAME[k]:8s}: " + ", ".join(row))
    print(f"  пар с резервом ≤ 5%: {low}/{tot} ({low / tot * 100:.0f}%) → H1c {'подтверждена' if low / tot >= 0.7 else 'не подтверждена'}")

    print("\n=== H1d: остывание после продажи ≥ 20% (вся история до 2025-12, 10 металлов, месячный mb1) ===")
    rows = []
    for k in ["gold", "silver", "platinum", "palladium", "copper", "aluminum", "nickel", "lead", "zinc", "tin"]:
        d = D[k]
        c, t = d["c"], d["t"]
        cut = X.ix(t, X.CUT)
        p = fm(d)[:cut]
        n = len(p)
        sale = p <= -0.2 + 1e-9
        idx = list(np.where(sale)[0])
        batches = []
        for q in idx:
            if batches and q - batches[-1][-1] <= 6:
                batches[-1].append(q)
            else:
                batches.append([q])
        for bt in batches:
            i, last = bt[0], bt[-1]
            S = float(np.mean(c[bt]))
            end = min(n - 1, last + 24)
            cm = list(range(last + 1, end + 1))
            # следующая серия после последней продажи
            ser = [q for q in range(last + 1, n) if p[q] > 1.0]
            sp = float(np.mean(c[ser[0]: ser[0] + 3])) if ser else np.nan
            # покупка взносами в остывание (гармоническая средняя) и «досрочный конец» при цене ≤ 0,6 S
            hb = len(cm) / np.sum(1 / c[cm]) if cm else np.nan
            ee = [q for q in cm if c[q] <= 0.6 * S]
            he = len(cm[cm.index(ee[0]):]) / np.sum(1 / c[cm[cm.index(ee[0]):]]) if ee else np.nan
            rows.append((k, str(t[i])[:7], str(t[last])[:7], S, c[end], hb, sp, str(t[ser[0]])[:7] if ser else "—", he))
    for r in rows:
        k, a, b, S, ce, hb, sp, st, he = r
        print(f"  {X.NAME[k]:8s} продажи {a}…{b} по {S:.1f}: конец остывания {ce / S * 100 - 100:+.0f}% к продаже; взносы остывания по {hb:.1f}; "
              f"след. серия {st} по {sp:.1f} ({np.log(sp / hb) * 100 if np.isfinite(sp) else np.nan:+.0f}% к взносам)" +
              (f"; досрочный конец (≤ −40%) покупал бы по {he:.1f} ({np.log(sp / he) * 100 if np.isfinite(sp) else np.nan:+.0f}% серия к нему)" if np.isfinite(he) else ""))
    ce = np.array([np.log(r[4] / r[3]) for r in rows]) * 100
    g = np.array([np.log(r[6] / r[5]) * 100 for r in rows if np.isfinite(r[6])])
    ee = [(r[6], r[8]) for r in rows if np.isfinite(r[8])]
    eew = [np.isfinite(a) and a < b for a, b in ee]
    print(f"  случаев {len(rows)}; цена конца остывания к цене продажи: средняя лог-разница {ce.mean():+.1f}% (медиана {np.median(ce):+.1f}%)")
    print(f"  серия после остывания дешевле взносов остывания: в {np.mean(g < 0) * 100:.0f}% случаев с серией ({len(g)}), средняя лог-разница {g.mean():+.1f}%")
    print(f"  досрочный конец (≤ −40%) — случаев {len(ee)}; серия дешевле досрочных покупок в {np.mean(eew) * 100 if ee else 0:.0f}%")
    post = [r for r in rows if r[1] >= "2005"]
    print("  2005–2025: " + "; ".join(f"{X.NAME[r[0]][:3]} {r[1]}…{r[2]}" for r in post))


if __name__ == "__main__":
    main()
