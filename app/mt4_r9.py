"""Круг 9: режим металлов → BTC (макро-вершина / макро-дно / пузырь металлов). Запуск: python3 app/mt4_r9.py"""
import numpy as np
import pandas as pd

import mt4_lib as M

KEYS = ["gold", "silver", "platinum", "palladium", "copper", "aluminum", "nickel", "lead", "zinc", "tin"]


def main():
    M.tee("r9.txt")
    D = M.mload()
    DD = M.dload()
    idx = D["gold"]["t"]
    sell = pd.Series(0, index=idx); buy = pd.Series(0, index=idx); hot = pd.Series(False, index=idx)
    for k in KEYS:
        d = D[k]
        p = pd.Series(M.VERS["Q2"](d), index=d["t"]).reindex(idx)
        sell += (p < 0).astype(int)
        buy += (p > 1).astype(int)
        if k in ("silver", "platinum"):
            h = M.T.heat(d, 1.81, 86.0)
            hot |= pd.Series(h, index=d["t"]).reindex(idx).fillna(False)
    b = DD["x"]["btc"].resample("ME").last()
    fwd = (b.shift(-3) / b - 1) * 100
    base = fwd.loc["2014-10-31":"2026-10-31"]
    print("Месяцы событий (решение по месяцу M; BTC — от конца M на 3 мес.):")
    ev = {"макро-вершина металлов (продают ≥ 3 из 10)": sell >= 3, "макро-дно (серия у ≥ 3)": buy >= 3, "пузырь серебра/платины": hot,
          "продаёт ≥ 5 из 10": sell >= 5}
    for nm, e in ev.items():
        e = e.reindex(base.index).fillna(False)
        mo = list(e[e].index)
        keep = []
        for t in mo:
            if not keep or (t - keep[-1]).days >= 85:
                keep.append(t)
        parts = []
        for a, z in (("2014-10-31", "2026-10-31"), ("2014-10-31", "2020-09-30"), ("2020-10-31", "2026-10-31")):
            w = base.loc[a:z].dropna()
            kk = [t for t in keep if a <= str(t)[:10] <= z and t in w.index]
            parts.append((np.mean([w[t] for t in kk]) - w.mean() if kk else np.nan, len(kk)))
        print(f"  {nm}: избыток BTC за 3 мес. {parts[0][0]:+.1f} (n{parts[0][1]}) [{parts[1][0]:+.1f} n{parts[1][1]} / {parts[2][0]:+.1f} n{parts[2][1]}]; месяцы: "
              + ", ".join(f"{str(t)[:7]} ({base.get(t, np.nan):+.0f}%)" for t in keep))
    print(f"  обычный рост BTC за 3 мес.: {base.mean():+.1f}% (медиана {base.median():+.1f}%)")


if __name__ == "__main__":
    main()
