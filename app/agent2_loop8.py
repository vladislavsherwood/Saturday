"""Агент 2, круг 8: шорт BTC подробно — эпизоды, размер до границы риска, по годам старта.
H8a: доход шорта «жадность > 75, выход на сигнале дна или развороте BTC» держится на многих эпизодах, а не на одном-двух.
H8b: граница размера — где появляются ликвидации в стрессе (максимумы +20/+30%, а также +50% как запас) при W25 с плечом.
H8c: вход на более сильной жадности (> 80) или после N дней жадности меньше «пилит» в бычьем рынке.
Запуск: python3 app/agent2_loop8.py <кандидаты.json>"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent2_margin import grouped, sized, plan_of, port2, fmt2, mask, short_state, stress_ok, safe, c, BOT, sim2, any_liq, NOSH, CC, LO, HI, starts, idx
from agent2_loop2 import su_sized

EXIT = BOT + [[c("btcr30", ">", 20)]]
if __name__ == "__main__":
    CANDS = json.load(open(sys.argv[1])); S0 = CANDS[list(CANDS)[1]]
    print("кандидат:", list(CANDS)[1])
    A0, G0, _ = plan_of(grouped(S0)); A, G, _ = plan_of(su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1")); LEV = (1, 2, 1.25, 2, 1, 1, 1, 1.25)
    E75 = mask([[c("fng", ">", 75)]]); X = mask(EXIT)
    W = short_state(E75, X)
    # --- эпизоды ---
    w = W[:, 0]; p = CC[:, 0]; eps = []; t = 1
    while t < len(w):
        if w[t - 1] > 0 and (t < 2 or w[t - 2] == 0):              # решение вчера — исполнение сегодня
            t0 = t
            while t < len(w) and w[t - 1] > 0:
                t += 1
            t1 = min(t, len(w) - 1)
            hi = np.nanmax(HI[t0:t1 + 1, 0])
            eps.append((idx[t0].date(), p[t0], idx[t1].date(), p[t1], (1 - p[t1] / p[t0]) * 100, (hi / p[t0] - 1) * 100, t1 - t0))
        t += 1
    print(f"\nЭпизоды шорта BTC (вход жадность > 75, выход дно или разворот): {len(eps)}")
    win = [e for e in eps if e[4] > 0]
    print(f"  в плюс {len(win)}, в минус {len(eps) - len(win)}; сумма доходов эпизодов {sum(e[4] for e in eps):+.0f}%, медиана {np.median([e[4] for e in eps]):+.1f}%, "
          f"худший {min(e[4] for e in eps):+.1f}%, лучший {max(e[4] for e in eps):+.1f}%, макс. рост против шорта внутри эпизода {max(e[5] for e in eps):+.0f}%")
    by_year = {}
    for e in eps:
        by_year.setdefault(e[0].year, []).append(e[4])
    print("  по годам (сумма %, число):", " ".join(f"{y}: {sum(v):+.0f} ({len(v)})" for y, v in sorted(by_year.items())))
    big = sorted(eps, key=lambda e: -abs(e[4]))[:8]
    for e in big:
        print(f"    {e[0]} {e[1]:8.0f} → {e[2]} {e[3]:8.0f}: {e[4]:+6.1f}% (макс. против {e[5]:+.0f}%, {e[6]} дн)")
    # --- размер и стресс ---
    print("\nРазмер шорта (W25; без плеча / с плечом): медиана, худшие 10%, стресс −20/−30% (лонги) и +20/+30% (шорт), +50% — запас")
    S0s = np.array(starts, dtype=np.int64)
    for sz in (0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.40):
        line = []
        for AA, GG, lev in ((A0, G0, (1,) * 8), (A, G, LEV)):
            o = port2(AA, GG, lev, W=W, sh=sz, sep=True, stress=False)
            levv = np.array(list(lev) + [1.0] * (8 - len(lev)), float)
            ok = stress_ok(AA, GG, lev, W=W, sh=sz)
            l50 = any_liq(CC, LO, HI, AA, GG, W.astype(float), S0s, levv, 0.5, sz, 0.15 / 365, 0, True, True)
            line.append(f"{o['med']:+5.0f}% / {o['p10']:+4.0f}% / ликв. {o['liq']} / стресс 30% {'ок' if ok else 'ЛИКВ'} / 50% {'ЛИКВ' if l50 else 'ок'} / мин. {o['lvl']:.2f}")
        print(f"  {int(sz * 100):2d}%: {line[0]}  ||  {line[1]}")
    # --- вход сильнее / дольше ---
    print("\nВход (W25 с плечом, шорт 15%):")
    run = lambda m: np.array([np.convolve(m[:, k].astype(int), np.ones(1), "same") for k in range(m.shape[1])]).T   # noqa: E731
    for tag, ent in (("жадность > 75", E75), ("жадность > 80", mask([[c("fng", ">", 80)]])), ("жадность > 70", mask([[c("fng", ">", 70)]])),
                     ("жадность > 75 и BTC у максимума (< 10%)", mask([[c("fng", ">", 75), c("btcath", "<", 10)]])),
                     ("жадность > 75 и BTC за 30 дн < 20% (не в импульсе)", mask([[c("fng", ">", 75), c("btcr30", "<", 20)]]))):
        WW = short_state(ent, X)
        o = port2(A, G, LEV, W=WW, sh=0.15, sep=True, stress=False); ok = stress_ok(A, G, LEV, W=WW, sh=0.15)
        o0 = port2(A0, G0, W=WW, sh=0.15, sep=True, stress=False)
        print(f"  {tag:50s}: с плечом {o['med']:+.0f}% (худшие 10% {o['p10']:+.0f}%), без плеча {o0['med']:+.0f}%, стресс {'ок' if ok else 'ЛИКВ'}")
    # --- по годам старта ---
    print("\nПо годам старта (W25 с плечом): без шорта / шорт 10% / шорт 15% / шорт 20%")
    years = np.array([idx[s].year for s in starts])
    xs = [port2(A, G, LEV, W=W, sh=sz, sep=True, stress=False, xs=True)["_x"] for sz in (0.0, 0.10, 0.15, 0.20)]
    for y in sorted(set(years)):
        m = years == y
        print(f"  {y}: " + " / ".join(f"{np.median(np.array(x)[m]):+.0f}%" for x in xs) + f"  (стартов {m.sum()})")
    print("  худший старт: " + " / ".join(f"{min(x):+.0f}%" for x in xs))
