"""Круг 3 mcx: ядро combo7 (продажи на страхе → тактический резерв → капитуляция 25% / разворот → весь резерв; охрана и удержание) на металлах.
Запуск: python3 app/mcx_r3.py"""
import numpy as np
import pandas as pd

import mcx_lib as C


def core(DD, s=0.05, k=1.0, cap=10, f1=25, f2=40, guard=52, hold=15, capbuy=0.25, rev=1.0):
    def fn(X):
        f = C.feats(X, DD)
        fg = f["fg"]
        n = X.n
        ts, tb, tk = np.zeros(n), np.zeros(n), np.zeros(n)
        up = f["z21"] > k
        held = pd.Series(fg < hold).rolling(60, min_periods=1).max().values.astype(bool)
        for i in range(n):
            if not np.isfinite(fg[i]):
                continue
            if fg[i] < cap:
                tb[i] = capbuy
            elif up[i] and fg[i] < guard:
                pass
            elif held[i]:
                pass
            elif fg[i] < f1:
                ts[i] = s
            elif fg[i] < f2:
                ts[i] = s / 2
            elif up[i]:
                tb[i] = rev
        return ts, tb, tk
    return fn


def main():
    C.tee("r3.txt")
    D, DD, MM, base = C.load()
    res = {}
    for sa in (False, True):
        print(f"\n=== {'ОТДЕЛЬНАЯ дневная стратегия (DCA + правила)' if sa else 'СЛОЙ поверх mb1'} ===")
        for s in (0.02, 0.05, 0.10):
            for k in (0.75, 1.0, 1.5):
                L = C.Layer(core(DD, s, k), standalone=sa)
                o = C.report(f"s {s:.0%} k {k}", L)
                res[(sa, s, k)] = o
                print("    " + C.fafter(o))
    # без продаж на страхе: только капитуляция и разворот (резерв слоя = 0 → ничего), для контроля — капитуляция из взносов (копить взнос при fg < 40)
    print("\n=== контроль: вместо продаж — копить взнос при страхе (fg < 40), капитуляция 25%, разворот k 1 → весь ===")
    def accum(X, k=1.0):
        f = C.feats(X, DD)
        fg = f["fg"]
        ts = np.zeros(X.n)
        tb = np.where(fg < 10, 0.25, np.where((f["z21"] > k) & (fg >= 52), 1.0, 0.0))
        tk = ((fg < 40) & (tb == 0)).astype(float)
        return ts, tb, tk
    for sa in (False, True):
        o = C.report(f"копить при страхе ({'отд.' if sa else 'слой'})", C.Layer(accum, standalone=sa))
        print("    " + C.fafter(o))


if __name__ == "__main__":
    main()
