"""Где металлы сейчас относительно своих прошлых вершин и дна: процентиль каждого признака сейчас и его типичное значение в месяц разворота.
Запуск: python3 app/metals_now.py <metals_long.json> <metals_long.pkl>"""
import json
import sys

import numpy as np
import pandas as pd

import metals_long as ml

KEYS = ["Цена к средней за 10 лет", "Цена к средней за 3 года", "Изменение за год, %", "Изменение за 3 года, %", "Рост от минимума за 5 лет, раз", "Реальная цена (с поправкой на инфляцию) к средней за 20 лет",
        "Инфляция за год, %", "Инфляция: изменение за год, п.п.", "Реальная ставка ФРС (ставка минус инфляция), %", "Реальная ставка: изменение за год, п.п.", "Отклонение реальной ставки от нейтральной r*, п.п.",
        "Ставка ФРС: изменение за год, п.п.", "Кривая: 10 лет минус ставка ФРС, п.п.", "Безработица выше минимума за 3 года, п.п.", "Нефть: изменение за год, %", "Нефть к средней за 3 года",
        "Доллар к средней за 5 лет", "Доллар: изменение за год, %", "Акции: до максимума, %", "Акции к золоту: соотношение к средней за 10 лет", "Золото к серебру: уровень", "Металл к золоту: соотношение к средней за 3 года"]


def main(js, pkl):
    E = pd.DataFrame(json.load(open(js, encoding="utf-8"))["episodes"])
    A = pd.read_pickle(pkl)
    X = ml.monthly_table()
    for k in ("gold", "silver", "platinum", "copper"):
        name = ml.METALS[k][1]
        F = ml.features(X, k)
        now = F.iloc[-1]
        e = E[E.metal == name]
        print(f"\n=== {name.upper()} сейчас ({F.index[-1]:%Y-%m}, цена {X[k].iloc[-1]:.0f}) против его вершин и дна ===")
        print(f"{'признак':58} {'сейчас':>8} {'процентиль':>11} | {'у вершин (медиана)':>18} {'у дна (медиана)':>16}")
        close_top = close_bot = 0
        for f in KEYS:
            v = now[f]
            if pd.isna(v):
                continue
            p = (A[f].dropna() < v).mean() * 100
            t, b = e[e.kind == "вершина"][f].astype(float).median(), e[e.kind == "дно"][f].astype(float).median()
            if not (np.isnan(t) or np.isnan(b)):
                close_top += abs(v - t) < abs(v - b)
                close_bot += abs(v - b) < abs(v - t)
            print(f"{f[:58]:58} {v:8.2f} {p:10.0f}  | {t:18.2f} {b:16.2f}")
        print(f"ближе к типичной вершине по {close_top} признакам, ближе к типичному дну — по {close_bot}")


if __name__ == "__main__":
    main(*sys.argv[1:])
