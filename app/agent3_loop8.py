"""Агент 3, круг 8: шорт BTC со стоп-лоссом и фиксацией — чтобы не зависеть от цикла 2024–26.
Агент 2: шорт BTC 10% на «жадность > 75» с выходом на сигнале дна/разворота — 20 эпизодов, 2019–21 в минусе (−33% по сумме), 2024–26 в плюсе.
H8a стоп: закрыть шорт, если BTC выше цены входа на s = 5/10/15/20% (новый вход — только после нового сигнала: жадность сначала ≤ 75);
H8b фиксация: закрыть, если BTC ниже входа на 10/15/20% или жадность упала < 50/60;
H8c размер 10/20/30% счёта. Портфель — схема M6 (C4, плечо паники ×1,5 при бете ≤ 1,5). Безопасно — 0 ликвидаций, стресс минимумов −20/−30%
и максимумов +20/+30%. Запуск: python3 app/agent3_loop8.py <out.json>"""
import sys, os, json, itertools, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent3_margin import C4, plan_of, fmt2, lev_scheme, ind_matrix, beta_split, port3, starts, idx, CC, BOT, c
from agent_margin import mask

LEV16 = [1, 2, 1.5, 2, 1, 1, 1, 1.5] + [1, 2, 1.25, 2, 1, 1, 1, 1.25]


def short_w(entry, exit_, px, stop=None, take=None, soft=None):
    """Состояние шорта BTC по дням (столбец 0): вход по сигналу (если нет выхода), выход по сигналу, стопу (цена > вход·(1+stop)),
    фиксации (цена < вход·(1−take)) или мягкому выходу soft[t]; после стопа/фиксации новый вход — только после того, как сигнал входа пропал."""
    n = len(px); W = np.zeros(CC.shape); on = False; e = 0.0; need_reset = False; ep = []
    for t in range(n):
        if np.isnan(px[t]):
            continue
        if on:
            hit = exit_[t] or (stop and px[t] > e * (1 + stop)) or (take and px[t] < e * (1 - take)) or (soft is not None and soft[t])
            if hit:
                on = False; need_reset = not exit_[t]; ep.append((t0, t, e, px[t]))
        else:
            if not entry[t]:
                need_reset = False
            elif not exit_[t] and not need_reset:
                on = True; e = px[t]; t0 = t
        W[t, 0] = 1.0 if on else 0.0
    if on:
        ep.append((t0, n - 1, e, px[n - 1]))
    return W, ep


if __name__ == "__main__":
    out = sys.argv[1]; t0 = time.time()
    A, G, _ = plan_of(lev_scheme(C4)); B = np.nan_to_num(ind_matrix("beta180"), nan=9.0); Gs = beta_split(G, B > 1.5)
    EN = mask([[c("fng", ">", 75)]])[:, 0]; EX = mask(BOT + [[c("btcr30", ">", 20)]])[:, 0]; FNG = ind_matrix("fng")[:, 0]; px = CC[:, 0]
    o0 = port3(A, Gs, LEV16); print(f"M6 без шорта: {fmt2(o0)}", flush=True); res = []
    V = [("агент 2 (дно/разворот)", None, None, None)]
    for s in (0.05, 0.10, 0.15, 0.20):
        V.append((f"стоп +{int(s * 100)}%", s, None, None))
    for tk in (0.10, 0.15, 0.20):
        V.append((f"фиксация −{int(tk * 100)}%", None, tk, None))
    for f in (50, 60):
        V.append((f"жадность < {f}", None, None, f))
    for s, tk in ((0.10, 0.15), (0.15, 0.20), (0.10, 0.20)):
        V.append((f"стоп +{int(s * 100)}% и фиксация −{int(tk * 100)}%", s, tk, None))
    for tag, s, tk, f in V:
        W, ep = short_w(EN, EX, px, s, tk, (FNG < f) if f else None)
        r = np.array([1 - b / a for _, _, a, b in ep]) * 100; yrs = {}
        for (i0, i1, a, b) in ep:
            yrs.setdefault(idx[i0].year, []).append((1 - b / a) * 100)
        ys = " ".join(f"{y}: {sum(v):+.0f}% ({len(v)})" for y, v in sorted(yrs.items()))
        print(f"\n{tag}: эпизодов {len(ep)}, в плюс {int((r > 0).sum())}, медиана {np.median(r):+.1f}%, сумма {r.sum():+.0f}%, худший {r.min():+.0f}% | по годам входа: {ys}", flush=True)
        for sh in (0.10, 0.20, 0.30):
            o = port3(A, Gs, LEV16, W=W, sh=sh); x = o.pop("_x")
            yr = np.array([idx[q].year for q in starts]); byy = {int(y): float(np.median(x[yr == y])) for y in sorted(set(yr))}
            print(f"  шорт {int(sh * 100)}%: {fmt2(o)} | 2018/2021/2024 старт: {byy[2018]:+.0f}/{byy[2021]:+.0f}/{byy[2024]:+.0f}%", flush=True)
            res.append({"tag": tag, "sh": sh, "eps": len(ep), "sum": float(r.sum()), "worst": float(r.min()), **{k: o[k] for k in ("med", "p10", "liq", "lvl", "l20", "l30") if k in o}})
    print(f"\n{time.time() - t0:.0f} с"); json.dump(res, open(out, "w"))
