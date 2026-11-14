"""Круг 6: связи между металлами. Основа сравнения — R2.
H6a — кто кого опережает: для каждой пары металлов — на сколько месяцев крупная вершина (дно) одного раньше ближайшей вершины (дна)
      другого (в пределах ±18 мес.), по разворотам до 1999 и после.
H6b — новые маркеры из связей (порог 80/20 по 8 металлам до 1999), добавляются к вершине или ко дну по одному:
      промышленный индекс (медь, алюминий, никель, свинец, цинк, геом. среднее) — к средней за 3 года и рост за год; металл к своей группе
      (расхождение: металл обогнал/отстал от группы) — к средней за 3 года; золото к платине — к средней за 3 года; медь к золоту;
      ширина: доля из 8 металлов, у которых цена к средней за 3 года выше 80-го (ниже 20-го) процентиля.
H6c — опережение как сигнал: металл-лидер уже прошёл вершину (у лидера за последние 6 мес. был сигнал вершины, а цена ушла ниже
      средней за 12 мес.) → продать долю у ведомого, если у него самого маркеров вершины ≥ 4.
Запуск: python3 app/metals_agent_loop6.py"""
import numpy as np
import pandas as pd

import metals_agent_lib as L
import metals_long as ml
from metals_monthly import BOT, TOP
from metals_agent_loop5 import plan_sets

IND = ["copper", "aluminum", "nickel", "lead", "zinc"]
PREC = ["gold", "silver", "platinum"]
GROUP = {**{k: "prec" for k in PREC + ["palladium"]}, **{k: "ind" for k in IND + ["tin"]}}


def ma(s, n):
    return s.rolling(n, min_periods=int(n * 0.7)).mean()


def cross_features(D):
    X = D["_X"]
    lx = np.log(X[IND])
    ind = np.exp((lx - lx.iloc[0]).mean(axis=1))
    pr = X[PREC].copy()
    pr = pr[pr.index >= "1972-01-01"]
    lp = np.log(pr)
    prec = np.exp((lp - lp.iloc[0]).mean(axis=1)).reindex(X.index)
    G = pd.DataFrame(index=X.index)
    G["Пром. индекс к средней за 3 года"] = ind / ma(ind, 36)
    G["Пром. индекс: рост за год, %"] = (ind / ind.shift(12) - 1) * 100
    G["Золото к платине: к средней за 3 года"] = (X["gold"] / X["platinum"]) / ma(X["gold"] / X["platinum"], 36)
    # ширина: доля металлов отбора с ценой высоко/низко к средней за 3 года
    thr_hi, thr_lo = D["_thr"][(L.P3, "hi")], D["_thr"][(L.P3, "lo")]
    p3 = pd.DataFrame({k: X[k] / ma(X[k], 36) for k in L.SEL})
    p3.loc[p3.index < "1975-01-01", ["gold", "silver"]] = np.nan
    G["Ширина: доля металлов дорого к средней 3 г."] = (p3 > thr_hi).sum(1) / p3.notna().sum(1).clip(lower=1)
    G["Ширина: доля металлов дёшево к средней 3 г."] = (p3 < thr_lo).sum(1) / p3.notna().sum(1).clip(lower=1)
    for k in L.metals(D):
        d = D[k]
        grp = ind if GROUP[k] == "ind" else prec
        r = X[k] / grp
        F = G.reindex(d["t"]).copy()
        F["Металл к своей группе: к средней за 3 года"] = (r / ma(r, 36)).reindex(d["t"]).values
        for c in F.columns:
            d["F"][c] = F[c].values
    return list(G.columns) + ["Металл к своей группе: к средней за 3 года", "Медь к золоту: соотношение к средней за 3 года"]


def leadlag(D):
    print("=== H6a: кто кого опережает (медиана месяцев: + — металл строки раньше металла столбца; в скобках число пар разворотов) ===")
    pv = {}
    for k in L.SEL:
        d = D[k]
        pv[k] = [(d["t"][i], s) for i, s in ml.pivots(d["c"], d["factor"])]
    for kind, lab in ((1, "ВЕРШИНЫ"), (-1, "ДНО")):
        for per, cond in (("до 1999", lambda t: t.year < 1999), ("после 1999", lambda t: t.year >= 1999)):
            print(f"\n{lab}, {per}:{'':4}" + "".join(f"{L.NAME[k][:7]:>11}" for k in L.SEL))
            for a in L.SEL:
                row = []
                for b in L.SEL:
                    if a == b:
                        row.append(f"{'—':>11}"); continue
                    diffs = []
                    for ta, sa in pv[a]:
                        if sa != kind or not cond(ta):
                            continue
                        near = [(tb - ta).days / 30.4 for tb, sb in pv[b] if sb == kind and abs((tb - ta).days) <= 18 * 30.4]
                        if near:
                            diffs.append(min(near, key=abs))
                    row.append(f"{np.median(diffs):+5.1f} ({len(diffs)})".rjust(11) if diffs else f"{'':>11}")
                print(f"  {L.NAME[a]:9}" + "".join(row))


def leader_rule(lead, frac, k_min=4):
    """Лидер прошёл вершину: у лидера за 6 мес. был сигнал вершины (≥5 маркеров), а цена ниже средней за 12 мес. → ведомый продаёт frac при своих ≥ k_min."""
    def f(d, D=None):
        p = L.r2_plan(d)
        if d["key"] == lead:
            return p
        dl = D[lead]
        c = pd.Series(dl["c"], index=dl["t"])
        sig = pd.Series(dl["tn"] >= 5, index=dl["t"]).astype(int).rolling(6, min_periods=1).max() > 0
        below = c < c.rolling(12, min_periods=9).mean()
        past = (sig & below).reindex(d["t"]).fillna(False).values
        hit = past & (d["tn"] >= k_min) & (p >= 1.0) & (p <= 1.0)
        return np.where(hit, -frac, p)
    return f


def main():
    D = L.load()
    for k in L.metals(D):
        D[k]["key"] = k
    R2 = L.run(D, L.r2_plan)
    leadlag(D)
    newf = cross_features(D)
    thr = dict(D["_thr"])
    C = {}
    for f in newf:
        for dr in ("hi", "lo"):
            for q in (0.8,):
                t = dict(thr)
                t[(f, dr)] = L.pooled(D, f, q if dr == "hi" else 1 - q)
                if (f, dr) not in TOP:
                    C[f"H6b вершина + «{f}» {'высоко' if dr == 'hi' else 'низко'}"] = plan_sets(TOP + [(f, dr)], BOT, t)
                if (f, dr) not in BOT:
                    C[f"H6b дно + «{f}» {'высоко' if dr == 'hi' else 'низко'}"] = plan_sets(TOP, BOT + [(f, dr)], t)
    print(f"\n=== H6b: {len(C)} вариантов, к R2 (выбор по 8 металлам до 1999; разница по группам — справочно) ===")
    rows = L.study(D, C, R2, L.SEL, show=6)
    print("\nВСЕ (к R2: сумма до / после; не хуже до / после; драгоценные до/после; промышленные до/после):")
    for r in sorted(rows, key=lambda r: -r["s"]["before"]["logsum"]):
        s = r["s"]
        pg = lambda ks, p: np.log1p(np.array([L.rel(r["R"][k][p], R2[k][p]) for k in ks]) / 100).sum() * 100      # noqa: E731
        print(f"  {r['name']}: {s['before']['logsum']:+5.0f} / {s['after']['logsum']:+5.0f}; {s['before']['ok']}/{s['after']['ok']}; драг {pg(PREC, 'before'):+4.0f}/{pg(PREC, 'after'):+4.0f}; "
              f"пром {pg(IND, 'before'):+4.0f}/{pg(IND, 'after'):+4.0f}")
    # H6c — лидер
    print("\n=== H6c: металл-лидер прошёл вершину → ведомый продаёт (к R2) ===")
    C2 = {}
    for lead in ("copper", "gold", "silver", "lead", "zinc"):
        for frac in (0.1, 0.2):
            for km in (3, 4):
                fn = leader_rule(lead, frac, km)
                C2[f"H6c лидер {L.NAME[lead]}: продать {frac:.0%} при своих вершины ≥ {km}"] = (lambda fn: lambda d: fn(d, D))(fn)
    rows2 = L.study(D, C2, R2, L.SEL, show=4)
    print("  все: " + "; ".join(f"{r['name'][9:]}: {r['s']['before']['logsum']:+.0f}/{r['s']['after']['logsum']:+.0f}" for r in rows2))


if __name__ == "__main__":
    main()
