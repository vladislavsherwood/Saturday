"""Лонги/шорты, раунд 2: (1) отложенная покупка после выноса — когда толпа выходит из шортов; (2) паника в стейблах при толпе в шортах;
(3) толпа в шортах вообще — медвежий признак? Запуск: python3 app/ls_study2.py"""
import sys, os
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data
from ls_study import F, show, P

dom = data.dominances()
ur = (dom["usdt"] / dom["usdt"].rolling(200, min_periods=200).mean()).reindex(F.index, method="ffill")
oth = dom["oth"].reindex(F.index, method="ffill")
fng = data.fear_greed().reindex(F.index, method="ffill")
panic = (ur > 1.07) & (oth < 25)
F["oimin20"] = F["oidd"].rolling(20).min(); F["oimin40"] = F["oidd"].rolling(40).min()
F["lsrmin20"] = F["lsr"].rolling(20).min()
print("\n=== 1. отложенная покупка: был вынос (OI −28%) с толпой в шортах, потом толпа вышла из шортов ===")
for w in (20, 40):
    for x in (0.95, 1.0):
        m = (F[f"oimin{w}"] < -28) & (F["oidd"] > -28) & (F["lsr"] > x) & (F["lsr"].rolling(w).min() < 0.9)
        show(f"за {w} дн был вынос и толпа в шортах, теперь лонги/шорты к средней > {x}", m)
        # только первый день такого состояния
        show(f"   то же, только первый день", m & ~m.shift(1, fill_value=False))
print("\n=== 2. паника в стейблах и толпа ===")
show("паника в стейблах (любая)", panic)
show("паника и толпа в шортах (< 0,9)", panic & (F["lsr"] < 0.9))
show("паника и толпа НЕ в шортах", panic & (F["lsr"] >= 0.9))
show("паника, страх < 40 и толпа в шортах", panic & (fng < 40) & (F["lsr"] < 0.9))
show("паника, страх < 40 и толпа НЕ в шортах", panic & (fng < 40) & (F["lsr"] >= 0.9))
show("паника и доля лонгов упала на 10%+ за 7 дн", panic & (F["ls7"] < -10))
print("\n=== 3. толпа в шортах сама по себе ===")
for x in (0.8, 0.85, 0.9):
    show(f"лонги/шорты к средней < {x}", F["lsr"] < x)
show("страх < 30 и толпа в шортах", (fng < 30) & (F["lsr"] < 0.9))
show("страх < 30 и толпа НЕ в шортах", (fng < 30) & (F["lsr"] >= 0.9))
