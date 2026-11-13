"""Разбор вершины августа–октября 2025 года: почему её не поймали маркеры и что её отличает.

1. Какие монеты и когда сделали крупную вершину во второй половине 2025 года.
2. Пять рыночных маркеров вершины по месяцам 2025 года — какие сработали, какие нет.
3. Все рыночные признаки: где они стояли в августе–октябре 2025 (процентиль за всю историю) и где — на прошлых вершинах
   (апрель–май 2021, ноябрь 2021, март 2024, декабрь 2024). Ищутся признаки, которые были крайними и тогда, и в 2025.

Запуск: python3 app/top2025.py <markers.pkl> <markers.json>
"""
import json
import sys

import numpy as np
import pandas as pd

MARK = [("Доля альткоинов, %", ">", 27.7), ("Ширина: доля монет выше средней 200, %", ">", 88.9), ("Транзакции биткоина: месяц к году", "<", 0.978),
        ("BTC.D: изменение за 90 дней, п.п.", "<", -1.35), ("Активные адреса биткоина: месяц к году", "<", 1.1)]
TOPS = {"2021-04/05": ("2021-04-10", "2021-05-15"), "2021-11": ("2021-10-25", "2021-11-20"), "2024-03": ("2024-03-01", "2024-03-31"), "2024-12": ("2024-12-01", "2024-12-20")}
NOW = ("2025-08-10", "2025-10-10")


def main(pkl, js):
    A = pd.read_pickle(pkl)
    piv = json.load(open(js, encoding="utf-8"))["pivots"]
    tops = [(t, d, p) for t, g, d, s, p in piv if s > 0 and "2025-06-01" <= d <= "2025-12-31"]
    by = {}
    for t, d, p in tops:
        by.setdefault(d[:7], []).append(t)
    print("КРУПНЫЕ ВЕРШИНЫ МОНЕТ во второй половине 2025 (после них цена упала минимум вдвое):")
    for m in sorted(by):
        print(f"  {m}: {len(by[m])} монет — " + ", ".join(by[m]))
    allt = [d[:7] for t, g, d, s, p in piv if s > 0]
    cnt = pd.Series(allt).value_counts().sort_index()
    print("  для сравнения, месяцы с наибольшим числом вершин за всю историю: " + ", ".join(f"{k} ({v})" for k, v in cnt.sort_values(ascending=False).head(10).items()))

    B = A[A.coin == "BTC"]                                 # рыночные признаки одинаковы для всех монет, беру строку биткоина
    print("\nПЯТЬ МАРКЕРОВ ВЕРШИНЫ по месяцам (среднее за месяц; ✔ — условие выполнено):")
    print(f"{'месяц':8} " + " | ".join(f"{f[:34]:34} {op}{v}" for f, op, v in MARK) + " | выполнено дней с 4+ / 5")
    for m in ["2021-04", "2021-05", "2021-11", "2024-03", "2024-12", "2025-05", "2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11"]:
        g = B[B.index.strftime("%Y-%m") == m]
        if not len(g):
            continue
        n = sum(((g[f] > v) if op == ">" else (g[f] < v)).astype(int) for f, op, v in MARK)
        cells = []
        for f, op, v in MARK:
            x = g[f].mean()
            ok = (x > v) if op == ">" else (x < v)
            cells.append(f"{x:34.2f} {'✔' if ok else '✘':>6}")
        print(f"{m:8} " + " | ".join(cells) + f" | {int((n >= 4).sum())} / {int((n >= 5).sum())}")

    # цена и состояние биткоина и альтов в 2025
    print("\nЧТО ПРОИСХОДИЛО С ЦЕНОЙ (по строке биткоина и по медиане альткоинов):")
    for m in ["2025-06", "2025-07", "2025-08", "2025-09", "2025-10", "2025-11", "2025-12"]:
        g = B[B.index.strftime("%Y-%m") == m]
        alt = A[(A.coin != "BTC") & (A.index.strftime("%Y-%m") == m)]
        if len(g):
            print(f"  {m}: BTC до максимума {g['До исторического максимума, %'].mean():.0f}%, BTC к средней 200: {g['Цена к средней за 200 дней'].mean():.2f}; альты: медиана к средней 200 {alt['Цена к средней за 200 дней'].median():.2f}, "
                  f"до своего исторического максимума {alt['До исторического максимума, %'].median():.0f}%, монет на 90-дн. максимуме {alt['_hi90'].mean() * 100:.0f}%")

    feats = [k for k in B.columns if not k.startswith("_") and k not in ("top", "bot", "rel", "kind", "grp", "coin") and B[k].notna().mean() > 0.5]
    market = [f for f in feats if f.startswith(("Ширина", "Страх", "USDT", "BTC.D", "ETH.D", "Доля альт", "Биткоин", "Дней ", "MVRV", "Стейбл", "DeFi", "Доход", "Хешрейт", "Активные", "Транзакции", "Синхрон"))]
    P = B[market].rank(pct=True) * 100
    cur = P[(P.index >= NOW[0]) & (P.index <= NOW[1])].mean()
    old = pd.DataFrame({k: P[(P.index >= a) & (P.index <= b)].mean() for k, (a, b) in TOPS.items()})
    print(f"\nРЫНОЧНЫЕ ПРИЗНАКИ: процентиль за всю историю (0 — рекордно низко, 100 — рекордно высоко)\n{'признак':58} " + " ".join(f"{k:>11}" for k in TOPS) + f" {'авг–окт 2025':>13}")
    # общие: в 2025 крайние в ту же сторону, что и минимум на трёх прошлых вершинах
    rows = []
    for f in market:
        o = old.loc[f].values
        c = cur[f]
        if np.isnan(c):
            continue
        hi = (o > 70).sum()
        lo = (o < 30).sum()
        rows.append((f, o, c, hi, lo))
    same = [r for r in rows if (r[3] >= 3 and r[2] > 70) or (r[4] >= 3 and r[2] < 30)]
    diff = [r for r in rows if (r[3] >= 3 and r[2] < 55) or (r[4] >= 3 and r[2] > 45)]
    print("-- как на прошлых вершинах (крайние тогда и крайние в 2025):")
    for f, o, c, hi, lo in sorted(same, key=lambda r: -abs(r[2] - 50)):
        print(f"{f[:58]:58} " + " ".join(f"{x:11.0f}" for x in o) + f" {c:13.0f}")
    print("-- НЕ как на прошлых вершинах (тогда крайние, в 2025 обычные):")
    for f, o, c, hi, lo in sorted(diff, key=lambda r: abs(r[2] - 50)):
        print(f"{f[:58]:58} " + " ".join(f"{x:11.0f}" for x in o) + f" {c:13.0f}")
    print("-- крайние только в 2025 (на прошлых вершинах такого не было):")
    only = [r for r in rows if (r[2] > 88 or r[2] < 12) and not ((r[3] >= 3 and r[2] > 70) or (r[4] >= 3 and r[2] < 30))]
    for f, o, c, hi, lo in sorted(only, key=lambda r: -abs(r[2] - 50)):
        print(f"{f[:58]:58} " + " ".join(f"{x:11.0f}" for x in o) + f" {c:13.0f}")


if __name__ == "__main__":
    main(*sys.argv[1:])
