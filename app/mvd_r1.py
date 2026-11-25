"""Круг 1 mvd: диагностика индикаторов дешевизны — будущий рост по квинтилям индикатора (перцентиль за 5 лет) в половинах A / B.
Запуск: python3 app/mvd_r1.py"""
import numpy as np
import pandas as pd

import mvd_lib as V

INDS = ["ma200", "ma50", "z3y", "rsi_d", "rsi_w", "rsi_m", "dd1y", "pct3", "pct5", "dxy", "rr", "gsr"]
HS = (21, 63, 126, 252)


def main():
    V.tee("r1.txt")
    D, DD, MM, base = V.load()
    res = {}
    print("Будущий лог-рост (п.п.) за h дней: квинтиль u ≤ 0,2 («дёшево») минус u ≥ 0,8 («дорого»); u — перцентиль индикатора за прошлые 5 лет.")
    print("Половины A = 2005–15, B = 2016–2025-12 (рост считается только внутри половины). В скобках — доля дней «дёшево» / «дорого», %.\n")
    for nm in INDS:
        rows = []
        good = {h: {"A": 0, "B": 0, "both": 0} for h in HS}
        for k in V.ALL5:
            if nm == "gsr" and k != "silver":
                continue
            X = MM[k]
            u = V.prank(V.ind(X, nm), 1260)
            lc = np.log(X.c)
            sg = V.segs(X)
            cell = []
            for h in HS:
                fr = np.r_[lc[h:] - lc[:-h], np.full(h, np.nan)] * 100
                sp = {}
                for half, (a, b) in sg.items():
                    idx = np.arange(a, b - h)
                    uu, ff = u[idx], fr[idx]
                    ok = np.isfinite(uu) & np.isfinite(ff)
                    lo, hi = ok & (uu <= 0.2), ok & (uu >= 0.8)
                    sp[half] = (ff[lo].mean() - ff[hi].mean()) if lo.sum() > 20 and hi.sum() > 20 else np.nan
                    if h == 126:
                        cell.append(f"{half} {sp[half]:+.1f} ({lo.sum() / max(ok.sum(), 1) * 100:.0f}/{hi.sum() / max(ok.sum(), 1) * 100:.0f})")
                if k in V.DSEL or nm == "gsr":
                    good[h]["A"] += sp["A"] > 0
                    good[h]["B"] += sp["B"] > 0
                    good[h]["both"] += (sp["A"] > 0) and (sp["B"] > 0)
                res.setdefault(nm, {}).setdefault(k, {})[h] = sp
            rows.append(f"{V.NAME[k][:4]} " + ", ".join(cell))
        print(f"{nm}: h=126 → " + "; ".join(rows))
        print("    металлов отбора с плюсом (A / B / обе): " + "  ".join(f"h{h}: {g['A']}/{g['B']}/{g['both']}" for h, g in good.items()))
    # сводная: среднее по 4 металлам отбора
    print("\nСВОДКА: средний разрыв «дёшево − дорого» по 4 металлам отбора, п.п. (A | B):")
    print("индикатор | " + " | ".join(f"h{h}" for h in HS))
    for nm in INDS:
        ks = ["silver"] if nm == "gsr" else V.DSEL
        line = []
        for h in HS:
            a = np.nanmean([res[nm][k][h]["A"] for k in ks])
            b = np.nanmean([res[nm][k][h]["B"] for k in ks])
            line.append(f"{a:+5.1f} | {b:+5.1f}")
        print(f"{nm:6s} | " + " || ".join(line))


if __name__ == "__main__":
    main()
