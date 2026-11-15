"""Как монета ведёт себя на combo4 (план приложения: app_combo4 на данных engine): вся история, старты каждые 30 дней, 1/2/3 года, бета и корреляция.
Запуск: python3 app/coin_check.py XMR-USD LIT39125-USD ..."""
import os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine  # noqa: E402
import app_combo4 as C4  # noqa: E402

syms = sys.argv[1:]
H = {s: dict(engine.series(s, "alt")) for s in syms}
R = C4.compute([(s, "alt") for s in syms])
cache = {}
for s in syms:
    h, r = H[s], R[s]; B, k = r["B"], r["k"]
    def ind(name, i, B=B, k=k):
        if not name or i is None or i < 0: return None
        if name not in cache: cache[name] = B.series(name)
        v = cache[name][i, k]; return None if not np.isfinite(v) else float(v)
    st = C4.strategy(s, h, r, ind)
    c, plan, n = np.array(h["c"]), st["plan"], len(h["c"])
    def sim(a):
        cash = units = du = inv = 0.0
        for i in range(a, n):
            p = c[i]; x = plan[i - 1] if i > a else 1.0; before = cash; cash += 1; inv += 1; du += 0.999 / p
            if x < 0: amt = -x * units * p; units -= amt / p; cash += amt * 0.999
            else: amt = min(cash, 1 + (x - 1) * before); units += amt * 0.999 / p; cash -= amt
        return (cash + units * c[-1]) / inv * 100 - 100, du * c[-1] / inv * 100 - 100, cash / max(cash + units * c[-1], 1e-9) * 100
    li = n - 1
    pos = {int(t): i for i, t in enumerate(h["t"])}
    days = lambda Y: max(0, n - 365 * Y)
    full = sim(0); rs = [sim(a) for a in range(0, n - 90, 30)]
    beta = ind("beta180", C4.AD.IDX.get_loc(C4.AD.IDX[-1]) if False else None)
    print(f"\n== {s}: {n} дней с {np.datetime64(int(h['t'][0]), 'D')}, цена {c[0]:.4g} → {c[-1]:.4g} (макс {c.max():.4g})")
    print(f"   сегодня: {st['action']} | {st['label']}")
    print(f"   вся история: стратегия {full[0]:+.0f}% / DCA {full[1]:+.0f}% (в резерве сейчас {full[2]:.0f}% счёта)")
    for Y in (1, 2, 3):
        if n > 365 * Y: q = sim(days(Y)); print(f"   {Y} г.: стратегия {q[0]:+.0f}% / DCA {q[1]:+.0f}%")
    sp = np.array([x[0] for x in rs]); dp = np.array([x[1] for x in rs])
    print(f"   старты каждые 30 дней ({len(rs)}): медиана {np.median(sp):+.0f}%, в минусе {np.mean(sp < 0) * 100:.0f}%, худший {sp.min():+.0f}%, лучше DCA {np.mean(sp > dp) * 100:.0f}%")
    b = r["B"].series("beta180")[:, k]; cr = r["B"].series("corr180")[:, k]
    fb = b[np.isfinite(b)]; fc = cr[np.isfinite(cr)]
    if len(fb): print(f"   бета 180 дн: сейчас {fb[-1]:.2f}, медиана за историю {np.median(fb):.2f}; корреляция с BTC: сейчас {fc[-1]:.2f}, медиана {np.median(fc):.2f}")
