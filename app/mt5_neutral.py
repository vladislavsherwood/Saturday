"""mt5: плечо на металлах по отклонению ставки ФРС от нейтральной (идея пользователя) вместо «ФРС < 3%».
Нейтральная номинальная = r* Лаубаха–Уильямса (односторонняя оценка, NY Fed, cache/lw_rstar.xlsx) + ожидаемая инфляция из той же модели;
квартальные данные берутся с лагом в один квартал (публикуются позже). Разрыв = ФРС − нейтральная: < 0 — политика мягкая, > 0 — жёсткая.
Модель и критерий — как в круге 12 агента 2 (metals_agent2_loop12.py): основа R5 без плеча, 0 ликвидаций во всех прогонах, до 1999 не хуже ≥ 7/8,
сумма ≥ 0, обе половины ≥ 0, худшие 10% стартов ≥ −1%; вето после 1999 — не хуже ≥ 6/8. Запуск: python3 app/mt5_neutral.py"""
import os
import numpy as np
import pandas as pd
import metals_agent2_lib as A

HERE = os.path.dirname(os.path.abspath(__file__))
d0 = pd.read_excel(os.path.join(HERE, "cache", "lw_rstar.xlsx"), "data", header=None).iloc[6:, [0, 2]].dropna()
d0.columns = ["q", "rstar"]; d0["q"] = pd.to_datetime(d0["q"])
inp = pd.read_excel(os.path.join(HERE, "cache", "lw_rstar.xlsx"), "input data")[["Date", "inflation.expectations"]]
inp["Date"] = pd.to_datetime(inp["Date"])
Q = d0.merge(inp, left_on="q", right_on="Date").set_index("q")
NEU = (Q["rstar"].astype(float) + Q["inflation.expectations"].astype(float))
NEU.index = NEU.index + pd.offsets.QuarterEnd(0) + pd.offsets.QuarterEnd(1)   # доступно только после конца следующего квартала


def gap(d):
    n = NEU.reindex(NEU.index.union(d["t"])).sort_index().ffill().reindex(d["t"]).values
    return np.where(np.isfinite(n), d["ff"] - n, np.nan)


def main():
    D = A.load(); plan = A.ver("R5")
    g = gap(D["gold"]); t = D["gold"]["t"]
    for y in (1975, 1980, 1985, 1995, 2003, 2009, 2015, 2020, 2022, 2024, 2026):
        k = np.where(t.year == y)[0]
        if len(k): print(f"  {y}: ФРС {D['gold']['ff'][k[-1]]:.2f}, нейтральная {D['gold']['ff'][k[-1]] - g[k[-1]]:.2f}, разрыв {g[k[-1]]:+.2f}")
    C = {"основа: ФРС < 3% → 0,5×": lambda d, p: np.where((p > 1) & (d["ff"] < 3), 0.5, 0.0)}
    for g0 in (-2.0, -1.0, 0.0, 1.0):
        for b in (0.25, 0.5):
            C[f"разрыв < {g0:+g} → {b}×"] = (lambda g0, b: lambda d, p: np.where((p > 1) & (np.nan_to_num(gap(d), nan=9) < g0), b, 0.0))(g0, b)
    C["разрыв < −1 И ФРС < 3% → 0,5×"] = lambda d, p: np.where((p > 1) & (np.nan_to_num(gap(d), nan=9) < -1) & (d["ff"] < 3), 0.5, 0.0)
    C["разрыв < 0 И ФРС снижают (ниже, чем 6 мес назад) → 0,5×"] = lambda d, p: np.where((p > 1) & (np.nan_to_num(gap(d), nan=9) < 0) & (d["ff"] < np.r_[np.full(6, 99), d["ff"][:-6]]), 0.5, 0.0)
    for nm, fn in C.items():
        o = A.margin_eval(D, plan, fn)
        nb = sum(int(((plan(D[k]) > 1) & (fn(D[k], plan(D[k])) > 0))[: D[k]["m"]].sum()) for k in A.SEL)
        na = sum(int(((plan(D[k]) > 1) & (fn(D[k], plan(D[k])) > 0))[D[k]["m"]:].sum()) for k in A.SEL)
        sb, s1, s2, sa = A.mstat(o, "before"), A.mstat(o, "h1"), A.mstat(o, "h2"), A.mstat(o, "after")
        st = np.array(o["starts"])
        ok = o["liq"] == 0 and sb["ok"] >= 7 and sb["logsum"] >= 0 and s1["logsum"] >= 0 and s2["logsum"] >= 0 and np.percentile(st, 10) >= -1
        print(f"{'✓' if ok else '·'} {nm}: мес. займа до/после 1999 {nb}/{na}; ликвидаций {o['liq']}/{o['runs']}, мин. обесп. {o['worst']:.2f} | до 1999 не хуже {sb['ok']}/8, сумма {sb['logsum']:+.1f} "
              f"(пол. {s1['logsum']:+.1f}/{s2['logsum']:+.1f}) | после 1999 не хуже {sa['ok']}/8, мед. {sa['med']:+.1f}, худш. {sa['worst']:+.1f}, сумма {sa['logsum']:+.1f} | старты мед. {np.median(st):+.1f}, худш.10% {np.percentile(st, 10):+.1f}", flush=True)


if __name__ == "__main__":
    main()
