"""Круг 2 mb: что изменилось за 20 лет (эпохи 1965–81, 1982–98, 1999–2004, 2005–15, 2016–26): волатильность, корреляции, циклы,
польза маркеров дна, золото и реальная ставка / доллар. Только диагностика. Запуск: python3 app/mb_r2.py"""
import json
import os

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

import mb_lib as B
import metals_agent_lib as L

EP = {"1965–81": ("1965-01-01", "1981-12-31"), "1982–98": ("1982-01-01", "1998-12-31"), "1999–2004": ("1999-01-01", "2004-12-31"),
      "2005–15": ("2005-01-01", "2015-12-31"), "2016–26": ("2016-01-01", "2026-12-31")}
SEL = B.A.SEL
PREC = ["gold", "silver", "platinum"]
IND = ["copper", "aluminum", "nickel", "lead", "zinc"]


def main():
    B.tee("r2.txt")
    D, DD, MM = B.load()
    X = D["_X"]
    out = {}
    px = pd.DataFrame({k: pd.Series(D[k]["c"], index=D[k]["t"]) for k in B.ALLM})
    lr = np.log(px).diff()
    print("=== 1. ВОЛАТИЛЬНОСТЬ (год., по месячным средним, %) И СВЯЗЬ МЕТАЛЛОВ ===")
    for nm, (a, b) in EP.items():
        r = lr.loc[a:b, SEL]
        vol = r.std() * np.sqrt(12) * 100
        cm = r.corr().values
        pair = cm[np.triu_indices(len(SEL), 1)]
        cg = r.corr().loc["gold", "copper"]
        out.setdefault("vol", {})[nm] = {"prec": float(vol[PREC].median()), "ind": float(vol[IND].median()), "pair": float(np.nanmean(pair)), "gold_copper": float(cg)}
        print(f"  {nm}: драгметаллы {vol[PREC].median():.0f}% (золото {vol['gold']:.0f}, серебро {vol['silver']:.0f}), промышленные {vol[IND].median():.0f}%; "
              f"попарная корр. 8 металлов {np.nanmean(pair):+.2f}, золото–медь {cg:+.2f}")

    print("\n=== 2. ЦИКЛЫ: крупные развороты pv (порог металла ×1,5–1,8) ===")
    for nm, (a, b) in EP.items():
        nb, depth, gaps, yrs = [], [], [], 0.0
        for grp, keys in (("драгм.", PREC), ("пром.", IND)):
            nbt, dp = 0, []
            for k in keys:
                d = D[k]
                t, c = d["t"], d["c"]
                pv = d["pv"]
                for j, (i, s) in enumerate(pv):
                    if s < 0 and a <= str(t[i])[:10] <= b:
                        nbt += 1
                        prev = [ii for ii, ss in pv[:j] if ss > 0]
                        if prev:
                            dp.append((c[i] / c[prev[-1]] - 1) * 100)
            y = (min(pd.Timestamp(b), pd.Timestamp("2026-10-31")) - pd.Timestamp(a)).days / 365.25
            out.setdefault("cycles", {}).setdefault(nm, {})[grp] = {"bottoms_per_decade_per_metal": nbt / len(keys) / y * 10, "depth": float(np.median(dp)) if dp else None}
            print(f"  {nm} {grp}: доньев на металл за 10 лет {nbt / len(keys) / y * 10:.1f}, медианная глубина падения от вершины {np.median(dp) if dp else np.nan:+.0f}%")

    print("\n=== 3. МАРКЕРЫ ДНА: частота серии и рост за 12 мес. вперёд ===")
    thr = D["_thr3"]
    rows = []
    for k in SEL:
        d = D[k]
        c = pd.Series(d["c"], index=d["t"])
        f12 = (np.log(c.shift(-12)) - np.log(c)).values * 100
        f12x = np.where(np.isfinite(f12), f12, np.nan)
        df = pd.DataFrame({"t": d["t"], "bn": d["bn3"], "f12": f12x, "k": k})
        for f, dr in d["bot"]:
            x = d["F"][f].values
            df[f] = np.nan_to_num((x > thr[(f, dr)]) if dr == "hi" else (x < thr[(f, dr)]), nan=0).astype(int)
        rows.append(df)
    A_ = pd.concat(rows)
    A_ = A_[np.isfinite(A_["f12"])]
    marks = [f for f, _ in D["gold"]["bot"]]
    for nm, (a, b) in list(EP.items()) + [("до 1999", ("1965-01-01", "1998-12-31")), ("2005–26", ("2005-01-01", "2026-12-31"))]:
        s = A_[(A_["t"] >= a) & (A_["t"] <= b)]
        if len(s) < 24:
            continue
        # рост относительно среднего по металлу в эпохе (убираем тренд эпохи)
        s = s.copy()
        s["ex"] = s["f12"] - s.groupby("k")["f12"].transform("mean")
        rho = spearmanr(s["bn"], s["ex"]).correlation
        ser = s[s["bn"] >= 5]
        lo = s[s["bn"] <= 1]
        o = {"months": len(s), "share_ser": float((s["bn"] >= 5).mean() * 100), "rho": float(rho), "ex_ser": float(ser["ex"].mean()) if len(ser) else None,
             "ex_lo": float(lo["ex"].mean()), "per_marker": {}}
        line = []
        for f in marks:
            on = s[s[f] == 1]
            o["per_marker"][f] = {"share": float(len(on) / len(s) * 100), "ex": float(on["ex"].mean()) if len(on) > 5 else None}
            line.append(f"{f[:22]}: {len(on) / len(s) * 100:.0f}% мес., {on['ex'].mean() if len(on) > 5 else np.nan:+.0f}")
        out.setdefault("markers", {})[nm] = o
        print(f"  {nm}: серия (≥5) в {o['share_ser']:.1f}% мес.; ранговая корр. «маркеров дна → рост 12 мес.» {rho:+.2f}; "
              f"избыток роста за 12 мес.: в серии {o['ex_ser'] if o['ex_ser'] is not None else np.nan:+.1f} п.п., при ≤1 маркере {o['ex_lo']:+.1f} п.п.")
        print("     по маркерам: " + " | ".join(line))
    # по числу маркеров — профиль
    for nm, (a, b) in (("до 1999", ("1965-01-01", "1998-12-31")), ("2005–26", ("2005-01-01", "2026-12-31"))):
        s = A_[(A_["t"] >= a) & (A_["t"] <= b)].copy()
        s["ex"] = s["f12"] - s.groupby("k")["f12"].transform("mean")
        prof = s.groupby(np.minimum(s["bn"], 6))["ex"].agg(["mean", "count"])
        print(f"  профиль {nm} (маркеров дна → избыток роста 12 мес., п.п. [мес.]): " + ", ".join(f"{int(i)}{'+' if i == 6 else ''}: {r['mean']:+.1f} [{int(r['count'])}]" for i, r in prof.iterrows()))
        out.setdefault("profile", {})[nm] = {int(i): [float(r["mean"]), int(r["count"])] for i, r in prof.iterrows()}
    rhos = out["markers"]
    pre = rhos["до 1999"]["rho"]; mod = rhos["2005–26"]["rho"]
    exp, exm = rhos["до 1999"]["ex_ser"], rhos["2005–26"]["ex_ser"]
    h2b = (mod < pre / 2) or (exm is not None and exp is not None and exm < exp / 2)
    print(f"  H2b: ранговая корр. до 1999 {pre:+.2f} → 2005–26 {mod:+.2f}; избыток в серии {exp:+.1f} → {exm:+.1f} → {'подтверждена' if h2b else 'не подтверждена'}")

    print("\n=== 4. ЗОЛОТО, РЕАЛЬНАЯ СТАВКА, ДОЛЛАР ===")
    g = pd.Series(D["gold"]["c"], index=D["gold"]["t"])
    cpi = X["cpi"]
    infl = (cpi / cpi.shift(12) - 1) * 100
    rr = X["y10"] - infl
    usd = X["usd"]
    dg = np.log(g).diff(12) * 100
    drr = rr.diff(12)
    dus = np.log(usd).diff(12) * 100
    per = {"1975–81": ("1975-01-01", "1981-12-31"), "1982–98": ("1982-01-01", "1998-12-31"), "1999–2004": ("1999-01-01", "2004-12-31"),
           "2005–21": ("2005-01-01", "2021-12-31"), "2022–26": ("2022-01-01", "2026-12-31")}
    for nm, (a, b) in per.items():
        j = pd.concat([dg, drr, dus], axis=1).loc[a:b].dropna()
        # неперекрывающиеся годовые точки (каждый 12-й месяц) — честнее; печатаю обе
        jj = j.iloc[::12]
        print(f"  {nm}: корр. годовых изменений золото–реальная ставка 10 лет {j.iloc[:, 0].corr(j.iloc[:, 1]):+.2f} (без перекрытия {jj.iloc[:, 0].corr(jj.iloc[:, 1]):+.2f}, n={len(jj)}), "
              f"золото–доллар {j.iloc[:, 0].corr(j.iloc[:, 2]):+.2f}")
        out.setdefault("gold_macro", {})[nm] = {"rr": float(j.iloc[:, 0].corr(j.iloc[:, 1])), "usd": float(j.iloc[:, 0].corr(j.iloc[:, 2]))}
    gr = np.log(g / cpi * cpi.iloc[-1])
    fit = pd.concat([gr, rr], axis=1).loc["2005-01-01":"2021-12-31"].dropna()
    bcoef = np.polyfit(fit.iloc[:, 1], fit.iloc[:, 0], 1)
    allj = pd.concat([gr, rr], axis=1).dropna()
    resid = allj.iloc[:, 0] - np.polyval(bcoef, allj.iloc[:, 1])
    print(f"  регрессия ln(реальная цена золота) = {bcoef[1]:.2f} {bcoef[0]:+.3f} × реальная ставка 10 лет (2005–21): "
          f"остаток 2021-12 {np.expm1(resid.loc['2021-12-31']) * 100:+.0f}%, 2023-12 {np.expm1(resid.loc['2023-12-31']) * 100:+.0f}%, 2026-10 {np.expm1(resid.iloc[-1]) * 100:+.0f}%")
    out["gold_rr_resid"] = {"2021-12": float(np.expm1(resid.loc["2021-12-31"]) * 100), "2026-10": float(np.expm1(resid.iloc[-1]) * 100), "slope": float(bcoef[0])}
    # реальная ставка сейчас и золото
    print(f"  реальная ставка 10 лет: 2020-12 {rr.loc['2020-12-31']:.2f}, 2026-10 {rr.iloc[-1]:.2f}; золото 2020-12 {g.loc['2020-12-31']:.0f}, 2026-10 {g.iloc[-1]:.0f}")

    print("\n=== 5. КРИПТА (дневные, с 2015): корреляция 63-дневных доходностей BTC и металлов ===")
    btc = DD["x"]["btc"]
    for k in B.DSEL:
        Xd = MM[k]
        s = pd.Series(Xd.c, index=Xd.t)
        j = pd.concat([np.log(s).diff(63), np.log(btc).diff(63)], axis=1).dropna()
        for a, b in (("2015-01-01", "2019-12-31"), ("2020-01-01", "2022-12-31"), ("2023-01-01", "2026-12-31")):
            jj = j.loc[a:b].iloc[::63]
            print(f"  {B.NAME[k]} {a[:4]}–{b[:4]}: {jj.iloc[:, 0].corr(jj.iloc[:, 1]):+.2f} (n={len(jj)})", end=";")
        print()
    json.dump(B.clean(out), open(os.path.join(B.LOGDIR, "r2.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
