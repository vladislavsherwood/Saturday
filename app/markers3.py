"""Третий проход: складываются ли найденные маркеры. Для дня, когда монета на 90-дневном максимуме (минимуме),
считается, сколько маркеров вершины (дна) выполнено, и что стало с ценой дальше — отдельно на знакомых и случайных монетах.

Запуск: python3 app/markers3.py <markers.pkl>
"""
import sys

import numpy as np
import pandas as pd

TOP = [("Доля альткоинов, %", ">", 27.7), ("Ширина: доля монет выше средней 200, %", ">", 88.9), ("Монета/BTC к своей средней за 200 дней", ">", 1.38),
       ("Транзакции биткоина: месяц к году", "<", 0.978), ("BTC.D: изменение за 90 дней, п.п.", "<", -1.35), ("Активные адреса биткоина: месяц к году", "<", 1.1)]
BOT = [("DeFi: просадка заблокированных средств от максимума, %", ">", 59), ("USDT.D, %", ">", 6.52), ("Биткоин: до исторического максимума, %", ">", 57.5),
       ("MVRV биткоина", "<", 1.3), ("Цена к средней за 200 дней", "<", 0.532)]


def table(D, marks, lab, good):
    n = sum(((D[f] > v) if op == ">" else (D[f] < v)).astype(int) for f, op, v in marks)
    print(f"{'маркеров':>9} {'дней':>7} {'монет':>6} {'в зоне, %':>10} {'через 90 дн., медиана':>22} {'удача, %':>9} {'макс. рост за 90 дн.':>21} {'макс. падение':>14}")
    for k in sorted(n.unique()):
        g = D[n == k]
        if len(g) < 40:
            continue
        print(f"{k:>9} {len(g):>7} {g.coin.nunique():>6} {g[lab].mean() * 100:>10.0f} {g['_f90'].median():>21.0f}% {(g['_f90'] * good > 0).mean() * 100:>9.0f} {g['_fmax90'].median():>20.0f}% {g['_fmin90'].median():>13.0f}%")
    return n


def main(pkl):
    A = pd.read_pickle(pkl)
    for cond, marks, lab, good, title in (("_hi90", TOP, "top", -1, "ВЕРШИНЫ: монета на 90-дневном максимуме"), ("_lo90", BOT, "bot", 1, "ДНО: монета на 90-дневном минимуме")):
        D = A[A[cond].fillna(False).astype(bool) & A["_f90"].notna()]
        print(f"\n=== {title} ===\nмаркеры: " + "; ".join(f"{f} {op} {v}" for f, op, v in marks))
        for grp in ("знакомые", "случайные"):
            print(f"-- {grp} монеты")
            table(D[D.grp == grp], marks, lab, good)
        for name, m in (("до 2022", D.index < "2022-01-01"), ("с 2022", D.index >= "2022-01-01")):
            print(f"-- {name}")
            table(D[m], marks, lab, good)
        # сколько разных эпизодов за этим стоит: месяцы, в которых выполнено 4+ маркеров
        n = sum(((D[f] > v) if op == ">" else (D[f] < v)).astype(int) for f, op, v in marks)
        hot = D[n >= (4 if len(marks) > 5 else 3)]
        months = sorted(set(hot.index.strftime("%Y-%m")))
        print(f"месяцы с {4 if len(marks) > 5 else 3}+ маркерами ({len(months)}): " + ", ".join(months))


if __name__ == "__main__":
    main(sys.argv[1])
