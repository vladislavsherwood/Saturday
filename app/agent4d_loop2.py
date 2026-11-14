"""Агент 4D, круг 2: откуда потеря на сдвиге исполнения и плечо по классам монет (BTC/ETH — крупные, мемы — мелкие).
Запуск: python3 app/agent4d_loop2.py"""
import sys, os, json, itertools
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent4d_margin import Book, P9, PB, W25S, W25L, HERE, both, fb, cls, fmt
import numpy as np
W25 = json.load(open(os.path.join(HERE, "found", "agent2-best.json")))
OUT = {}
for nm, coins in (("портфель 9", P9), ("набор B", PB)):
    B = Book(coins); A, G, _ = B.plan(W25S)
    from agent2_margin import grouped
    A0, G0, _ = B.plan(grouped(W25))
    print(f"== {nm}", flush=True)
    for tag, AA, GG, lev in (("W25 без плеча (свои размеры)", A0, G0, (1,) * 8), ("размеры схемы без плеча", A, G, (1,) * 8), ("схема W25", A, G, W25L)):
        print(f"  {tag:32s} {fb(both(B, AA, GG, lev))}", flush=True)
    # разбор сдвига: сдвигаем только одну группу плеча (остальные в срок)
    from agent4d_margin import shift
    for g, gn in ((1, "дно"), (2, "паника подтв."), (7, "паника неподтв."), (3, "разворот"), (4, "продажи"), (6, "отложенная")):
        m = (G == g); m1 = shift(m.astype(float), 1) > 0
        A2 = A.copy(); G2 = G.copy(); A2[m] = 1; G2[m] = 0; A2[m1] = shift(A, 1, 1.0)[m1]; G2[m1] = shift(G, 1, 0)[m1]
        o = B.port(A2, G2, W25L, stress=False); print(f"  сдвиг только «{gn}»: медиана {o['med']:+.0f}%", flush=True)
    # плечо по классам: Lb — дно и разворот, Lp — паника (обе)
    res = []
    for bb, bm, be, pb, pe in itertools.product((2, 2.5, 3), (1.5, 2, 2.5), (1, 1.5, 2), (1.25, 1.5, 2), (1, 1.25)):
        Lb = {"big": bb, "mid": bm, "meme": be}; Lp = {"big": pb, "mid": 1.25, "meme": pe}
        L = B.levmat(W25L, {1: lambda s: Lb[cls(s)], 3: lambda s: Lb[cls(s)], 2: lambda s: Lp[cls(s)], 7: lambda s: Lp[cls(s)]})
        o = both(B, A, G, L); res.append(((bb, bm, be, pb, pe), o))
    ok = sorted([x for x in res if x[1]["safe"]], key=lambda x: -x[1]["med"])
    print(f"  безопасных {len(ok)} из {len(res)}; лучшие (дно/разворот: крупные, средние, мемы; паника: крупные, мемы):")
    for k, o in ok[:12]:
        print(f"    {k}: {fb(o)}", flush=True)
    OUT[nm] = [[list(k), o["med"], o["p10"], o["lvl"], o["safe"]] for k, o in res]
json.dump(OUT, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent4d_loop2.json", "w"))
