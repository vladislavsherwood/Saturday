"""Круг 8 (своя гипотеза, взаимосвязи металлов): «ширина» — дно и вершина как общее событие нескольких металлов.
Ширина считается по плану Q2 восьми металлов отбора в месяц решения (для экзамена — тоже по восьми).
H8a «широкое дно»: в серии докупок уже ≥ B металлов (B = 3/4/5 из 8) → металл начинает серию при маркерах дна ≥ K − r (r = 1/2; K — обычный порог n−3),
     серия держится как обычно (≥ n−4).
H8b «широкая вершина»: в этом месяце продают ≥ B металлов (B = 3/4/5, продажа ≥ 15%) → металл с маркерами вершины ≥ n−3 (но без своей продажи)
     продаёт s (10/20%).
Основа — Q2. Критерий: sel_ok + плато по B и r/s; вето — для лучшего в каждой гипотезе.
Запуск: python3 app/metals_agent3_loop8.py"""
import numpy as np
import pandas as pd

import metals_agent2_lib as A
import metals_agent3_lib as T
from metals_agent3_loop6 import q2

BS = (3, 4, 5)


def breadth(D, base):
    idx = D["_X"].index
    sb = pd.Series(0.0, index=idx)
    st = pd.Series(0.0, index=idx)
    for k in T.SEL:
        p = pd.Series(base(D[k]), index=D[k]["t"]).reindex(idx)
        sb += (p > 1.0).fillna(False).astype(float)
        st += (p <= -0.15 + 1e-9).fillna(False).astype(float)
    for k in A.metals(D):
        D[k]["br_bot"] = sb.reindex(D[k]["t"]).fillna(0).values
        D[k]["br_top"] = st.reindex(D[k]["t"]).fillna(0).values
    return D


def wide_bot(base, B, r):
    def f(d):
        p = base(d).copy()
        bn, nb = d["bn3"], d["nb"]
        K = nb - 3
        ep = np.zeros(len(p), bool)
        for i in range(len(p)):
            own = d["br_bot"][i] - (1 if p[i] > 1.0 and d["key"] in T.SEL else 0)
            ep[i] = bn[i] >= K or (own >= B and bn[i] >= K - r) or (i > 0 and ep[i - 1] and bn[i] >= K - 1)
        return np.where(ep & (p <= 1.0), 1.5, p)
    return f


def wide_top(base, B, s):
    def f(d):
        p = base(d)
        own = d["br_top"] - ((p <= -0.15 + 1e-9) & np.isin(d["key"], T.SEL)).astype(float)
        hit = (own >= B) & (d["tn3"] >= d["nt"] - 3)
        return np.where(hit & (p >= 0) & (p <= 1.0), -s, p)
    return f


def main():
    D = breadth(T.load(), q2)
    R3, Q = T.run(D, A.ver("R3")), T.run(D, q2)
    x = np.concatenate([D[k]["br_bot"][D[k]["h82"]: D[k]["m"]] for k in ["copper"]])
    print(f"месяцев 1982–98, когда в серии ≥ 3/4/5 металлов: {(x >= 3).sum()}/{(x >= 4).sum()}/{(x >= 5).sum()} из {len(x)}")
    for nm_h, C, meta, axes in (("H8a широкое дно", *((lambda: (lambda C, M: (C, M))(
            {f"H8a в серии ≥ {B} металлов → старт при маркерах дна ≥ K−{r}": wide_bot(q2, B, r) for B in BS for r in (1, 2)},
            {f"H8a в серии ≥ {B} металлов → старт при маркерах дна ≥ K−{r}": (B, r) for B in BS for r in (1, 2)}))()), (BS, (1, 2))),
                                ("H8b широкая вершина", *((lambda: (lambda C, M: (C, M))(
            {f"H8b продают ≥ {B} металлов → при вершине ≥ n−3 продать {s:.0%}": wide_top(q2, B, s) for B in BS for s in (0.1, 0.2)},
            {f"H8b продают ≥ {B} металлов → при вершине ≥ n−3 продать {s:.0%}": (B, s) for B in BS for s in (0.1, 0.2)}))()), (BS, (0.1, 0.2)))):
        print(f"\n=== {nm_h} ===")
        rows = T.study(D, C, Q, show=6)
        for r in rows:
            print(f"    {r['name']}: {r['s']['h2']['logsum']:+.1f}; по металлам {T.bym(r['s'], 'h2')}")
        good, by = T.pick(rows, meta, axes)
        print(f"  прошли с плато: {len(good)}")
        if good:
            b = good[0]
            print(f"  ВЫБРАН: {b['name']}\n    {T.fs(b['s'])}\n    1982–98: " + T.fprox(b["a"]))
            T.veto(b, R3, Q)
            print("    экзамен к Q2 (1982–98 / после / вся): " + T.exam(b["R"], Q))


if __name__ == "__main__":
    main()
