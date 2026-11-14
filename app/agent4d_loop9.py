"""Агент 4D, круг 9: устойчивость шорта BTC (жадность > 75 до дна/разворота) по горизонтам и по ставкам займа.
Для каждой даты окончания E: старты не позже E − 180 дней, итог на E (худший из двух сдвигов), изменение итога к портфелю без шорта.
Запуск: python3 app/agent4d_loop9.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, BOT, c, both, fb, IDX, STARTS
import numpy as np, pandas as pd
CUTS = ["2019-07-01", "2020-01-01", "2020-07-01", "2021-01-01", "2021-07-01", "2022-01-01", "2022-07-01", "2023-01-01", "2024-01-01", "2025-01-01", "2026-01-01", None]
for nm, coins in (("портфель 9", P9), ("набор B", PB)):
    B = Book(coins); A, G, _ = B.plan(W25S)
    W = B.hold(B.mask([[c("fng", ">", 75)]]), B.mask(BOT + [[c("btcr30", ">", 20)]])); W[:, 1:] = 0
    print(f"== {nm}: изменение медианы итога к без шорта (лог, %), по дате окончания:", flush=True)
    print("   размер | " + " | ".join(x[:7] if x else "сейчас" for x in CUTS))
    for sz in (0.10, 0.20, 0.30):
        row = []
        for cut in CUTS:
            E = len(IDX) if cut is None else int(np.searchsorted(IDX, pd.Timestamp(cut)))
            st = np.array([s for s in STARTS if s < E - 180])
            m0 = min(B.port(A, G, stress=False, starts=st, end=E, lag=l)["med"] for l in (0, 1))
            m1 = min(B.port(A, G, SHW=W * sz, stress=False, starts=st, end=E, lag=l)["med"] for l in (0, 1))
            row.append(100 * (np.log1p(m1 / 100) - np.log1p(m0 / 100)))
        print(f"   {sz:.0%}    | " + " | ".join(f"{x:+.1f}" for x in row), flush=True)
    print("  ставки (заём стейблов / заём BTC для шорта), худшая из сдвигов:")
    for rate, shr in ((0.06, 0.06), (0.11, 0.15), (0.15, 0.15), (0.15, 0.25)):
        o0 = both(B, A, G, rate=rate / 365, sh_rate=shr / 365)
        out = [f"без шорта {o0['med']:+.0f}% {'OK' if o0['safe'] else 'ЛИКВ'}"]
        for sz in (0.10, 0.20, 0.30):
            o = both(B, A, G, SHW=W * sz, rate=rate / 365, sh_rate=shr / 365)
            out.append(f"{sz:.0%}: {o['med'] - o0['med']:+.0f} п.п. {'OK' if o['safe'] else 'ЛИКВ'} (запас {o['lvl']:.2f})")
        print(f"   {rate:.0%} / {shr:.0%}: " + " | ".join(out), flush=True)
