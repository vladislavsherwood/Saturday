"""Теоретический потолок: лучшая возможная торговля с полным знанием будущего при тех же ограничениях.

Ограничения те же, что у правил в режиме весов: начальный баланс, в день купить или продать не больше чем на 3 единицы,
нельзя уйти в минус ни по деньгам, ни по позиции. Задача линейная, решается точно.
Ни один набор правил не может дать больше — правила не видят будущего и торгуют кратно единице.

Запуск: python3 app/ceiling.py <файл с ценами от optimize.js> [баланс] [единица]
"""
import json
import sys

import numpy as np
from scipy.optimize import linprog
from scipy.sparse import lil_matrix


def best_wealth(c, balance, unit):
    m = len(c)
    # переменные: покупка b[t], продажа s[t] (в долларах), позиция U[t], деньги C[t]
    nb, ns, nu, nc = 0, m, 2 * m, 3 * m
    A = lil_matrix((2 * m, 4 * m))
    rhs = np.zeros(2 * m)
    for t in range(m):
        # U[t] = U[t-1] + (b[t] - s[t]) / c[t]
        A[t, nu + t] = 1
        A[t, nb + t] = -1 / c[t]
        A[t, ns + t] = 1 / c[t]
        if t:
            A[t, nu + t - 1] = -1
        # C[t] = C[t-1] - b[t] + s[t]
        A[m + t, nc + t] = 1
        A[m + t, nb + t] = 1
        A[m + t, ns + t] = -1
        if t:
            A[m + t, nc + t - 1] = -1
        else:
            rhs[m + t] = balance
    cost = np.zeros(4 * m)
    cost[nu + m - 1] = -c[-1]          # максимум итога = позиция по последней цене + деньги
    cost[nc + m - 1] = -1
    bounds = [(0, 3 * unit)] * (2 * m) + [(0, None)] * (2 * m)
    r = linprog(cost, A_eq=A.tocsr(), b_eq=rhs, bounds=bounds, method="highs")
    assert r.success, r.message
    return -r.fun


def dca_wealth(c, balance, unit):
    cash, units = balance, 0.0
    for p in c:
        amt = min(unit, cash)
        if amt <= 0:
            break
        units += amt / p
        cash -= amt
    return units * c[-1] + cash


def main(path, balance=1000, unit=10):
    balance, unit = float(balance), float(unit)
    prices = json.load(open(path))["prices"]
    tot_w = tot = 0
    rows = []
    for a in prices:
        c = np.array(a["c"], dtype=float)
        w, d = best_wealth(c, balance, unit), dca_wealth(c, balance, unit)
        edge = (w / d - 1) * 100
        rows.append((a["name"], len(c), d, w, edge))
        tot_w += len(c)
        tot += edge * len(c)
    print(f"{'актив':6s} {'дней':>5s} {'итог DCA':>12s} {'потолок':>14s} {'к DCA':>10s}")
    for name, n, d, w, e in rows:
        print(f"{name:6s} {n:5d} {d:12,.0f} {w:14,.0f} {e:9,.0f}%")
    print(f"средневзвешенный потолок: {tot / tot_w:,.0f}% к DCA")
    json.dump({"rows": rows, "avg": tot / tot_w}, open(path + ".ceiling.json", "w"))


if __name__ == "__main__":
    main(*sys.argv[1:])
