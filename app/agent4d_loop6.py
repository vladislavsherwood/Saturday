"""Агент 4D, круг 6: устойчивость шорта корзины мемов — по эпизодам, по монетам, по годам; худший эпизод к капиталу счёта;
другие наборы мемов (портфель 9 + шорт мемов вне портфеля); размер 5/10/15/20%. Запуск: python3 app/agent4d_loop6.py"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, both, fb, BOT, c, cls, IDX
import numpy as np
SETS = (("портфель 9", P9), ("набор B", PB),
        ("набор M (BTC + 8 мемов/спекулятивных)", [("BTC-USD", "btc"), ("DOGE-USD", "alt"), ("SHIB-USD", "alt"), ("PEPE24478-USD", "alt"), ("WIF-USD", "alt"),
                                                   ("BONK-USD", "alt"), ("FLOKI-USD", "alt"), ("FARTCOIN-USD", "alt"), ("ETH-USD", "alt")]))
for nm, coins in SETS:
    B = Book(coins); A, G, _ = B.plan(W25S); K = len(coins); sym = [s for s, _ in coins]
    W = B.hold(B.mask([[c("fng", ">", 75)]]), B.mask(BOT + [[c("btcr30", ">", 20)]]))
    live = ~np.isnan(B.C)
    def basket(sel, tot):
        w = np.zeros(B.C.shape); m = live & sel[None, :]; n = np.maximum(m.sum(1, keepdims=True), 1)
        w[m] = np.broadcast_to(tot / n, w.shape)[m]
        return W * w
    meme = np.array([cls(s) == "meme" for s in sym])
    print(f"== {nm}: мемы {[s for s, m in zip(sym, meme) if m]}", flush=True)
    print(f"  без шорта {fb(both(B, A, G))}")
    for tot in (0.05, 0.10, 0.15, 0.20, 0.30):
        print(f"  мемы {tot:.0%}: {fb(both(B, A, G, SHW=basket(meme, tot)))}", flush=True)
    print(f"  BTC 10%: {fb(both(B, A, G, SHW=basket(np.array([s == 'BTC-USD' for s in sym]), 0.10)))}", flush=True)
    # эпизоды: доход шорта по каждой монете-мему (к цене входа), по годам
    W1 = W[:, 0] > 0; ep = []
    t = 0
    while t < len(IDX):
        if W1[t]:
            t0 = t
            while t < len(IDX) and W1[t]:
                t += 1
            t1 = min(t, len(IDX) - 1)
            # вход: на закрытии дня после сигнала (t0+1), выход на закрытии дня после конца
            for k in np.where(meme)[0]:
                p0, p1 = B.C[min(t0 + 1, len(IDX) - 1), k], B.C[min(t1 + 1, len(IDX) - 1), k]
                if np.isfinite(p0) and np.isfinite(p1):
                    seg = B.HI[t0 + 1:t1 + 2, k]; mx = np.nanmax(seg) / p0 - 1
                    ep.append((IDX[min(t0 + 1, len(IDX) - 1)].date(), IDX[min(t1 + 1, len(IDX) - 1)].date(), sym[k], (1 - p1 / p0) * 100, mx * 100))
        t += 1
    ep.sort()
    yrs = {}
    for e in ep:
        yrs.setdefault(e[0].year, []).append(e[3])
    print("  эпизоды шорта мемов (монета: доход шорта %, макс. рост против):", len(ep), "в плюс", sum(e[3] > 0 for e in ep))
    print("   по годам входа (сумма % / число): " + ", ".join(f"{y}: {sum(v):+.0f}/{len(v)}" for y, v in sorted(yrs.items())))
    worst = sorted(ep, key=lambda e: e[3])[:4]; print("   худшие:", "; ".join(f"{e[2].split('-')[0]} {e[0]}→{e[1]} {e[3]:+.0f}% (макс. против +{e[4]:.0f}%)" for e in worst))
    best = sorted(ep, key=lambda e: -e[3])[:3]; print("   лучшие:", "; ".join(f"{e[2].split('-')[0]} {e[0]}→{e[1]} {e[3]:+.0f}%" for e in best), flush=True)
