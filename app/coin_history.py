"""Как основная стратегия (found/main-crypto.json) отработала на одной монете: сделки, итог против DCA, по периодам.
Запуск: python3 app/coin_history.py VVV35509-USD [взнос в день]"""
import sys, os, json
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data

sym = sys.argv[1]; U = float(sys.argv[2]) if len(sys.argv) > 2 else 10.0; FEE = 0.001
c = data.history(sym)[0]; c = c[~c.index.duplicated()]; idx = c.index
here = os.path.dirname(os.path.abspath(__file__))
d = json.load(open(os.path.join(here, "found", "liq_extra.json")))
X = pd.DataFrame({k: d[k] for k in ("boic", "bls", "bfund")}, index=pd.to_datetime(d["t"], unit="D"), dtype=float)
oic = X["boic"].copy(); last = np.nan
for i, v in enumerate(oic.values):
    if v > 0 and not (v < 0.7 * last): last = v
    oic.iloc[i] = last
oic = oic[X["boic"].notna().cumsum() > 0]
oidd = (oic / oic.rolling(30, min_periods=1).max() - 1) * 100
lsr = X["bls"] / X["bls"].rolling(90).mean()
dly = (oidd.rolling(20).min() < -28) & (oidd > -28) & (lsr > 1.0) & (lsr.rolling(20).min() < 0.9)
dly = dly & ~dly.shift(1, fill_value=False)
dom = data.dominances(); btc = data.history("BTC-USD")[0]
I = pd.DataFrame(index=idx)
ff = lambda s: s.reindex(idx, method="ffill", limit=3)                       # noqa: E731
I["fng"] = ff(data.fear_greed()); I["usdtd"] = ff(dom["usdt"]); I["usdt"] = ff(dom["usdt"] / dom["usdt"].rolling(200, min_periods=200).mean())
I["othd"] = ff(dom["oth"]); I["btcr30"] = ff((btc / btc.shift(30) - 1) * 100); I["oidd30"] = ff(oidd); I["fund30"] = ff(X["bfund"].rolling(30, min_periods=30).sum())
ath = (1 - btc / btc.cummax()) * 100; oth90 = dom["oth"] - dom["oth"].shift(90)
I["qt"] = ((ff(ath) < 10) & (ff(oth90) > 1.5)).astype(float); I["dly20_100f"] = dly.reindex(idx).fillna(False).astype(float)
NAMES = ["капитуляция", "отложенная покупка", "волна ликвидаций", "паника+сильный страх (вынос)", "паника+сильный страх", "паника+страх (вынос)", "паника+страх",
         "разворот на страхе", "разворот+фандинг", "паника (вынос)", "паника", "сильный страх", "страх", "разворот BTC", "перегретый фандинг", "тихая вершина"]


def run(S):
    rule = np.full(len(idx), -1)
    for i in range(len(idx)):
        for r, R in enumerate(S["rules"]):
            if all((lambda v: v < cd["v"] if cd["op"] == "<" else v > cd["v"])(I[cd["ind"]].iloc[i]) for cd in R["conds"]):
                rule[i] = r; break
    cash = units = du = inv = 0.0; ev, eq, dq = [], [], []
    for i, p in enumerate(c.values):
        ri = rule[i - 1] if i else -1; a = S["rules"][ri]["act"] if ri >= 0 else 1.0; before = cash
        cash += U; inv += U; du += U * (1 - FEE) / p
        if a < 0:
            v = -a * units * p; units += a * units; cash += v * (1 - FEE)
            if v > 0.01: ev.append((idx[i], ri, -v, p))
        else:
            v = min(cash, U + (a - 1) * before); units += v * (1 - FEE) / p; cash -= v
            if v > U * 1.5: ev.append((idx[i], ri, v, p))
        eq.append(cash + units * p); dq.append(du * p)
    return rule, ev, np.array(eq), np.array(dq), inv, cash, units


S = json.load(open(os.path.join(here, "found", "main-crypto.json")))
SB = json.load(open(os.path.join(here, "found", "main-crypto-B.json")))
rule, ev, eq, dq, inv, cash, units = run(S)
_, _, eqb, _, _, _, _ = run(SB)
p = c.values
print(f"{sym}: {idx[0].date()} … {idx[-1].date()} ({len(c)} дн), цена {p[0]:.3g} → {p[-1]:.3g} ({(p[-1] / p[0] - 1) * 100:+.0f}%), макс. {p.max():.3g} ({idx[p.argmax()].date()}), мин. {p.min():.3g} ({idx[p.argmin()].date()})")
print(f"взнос ${U:g}/день, вложено ${inv:,.0f}")
print(f"  основная (K3+отложенная): ${eq[-1]:,.0f} ({(eq[-1] / inv - 1) * 100:+.0f}% к вложенному, к DCA {(eq[-1] / dq[-1] - 1) * 100:+.0f}%) | в резерве ${cash:,.0f} ({cash / eq[-1] * 100:.0f}%), в монете ${units * p[-1]:,.0f}")
print(f"  прежняя B:               ${eqb[-1]:,.0f} ({(eqb[-1] / inv - 1) * 100:+.0f}%, к DCA {(eqb[-1] / dq[-1] - 1) * 100:+.0f}%)")
print(f"  DCA:                     ${dq[-1]:,.0f} ({(dq[-1] / inv - 1) * 100:+.0f}%)")
r = eq / (np.arange(1, len(eq) + 1) * U) - 1; rd = dq / (np.arange(1, len(dq) + 1) * U) - 1
print(f"  худший момент: стратегия {r.min() * 100:+.0f}% ({idx[r.argmin()].date()}), DCA {rd.min() * 100:+.0f}% ({idx[rd.argmin()].date()}); дней в минусе: {(r < 0).mean() * 100:.0f}% против {(rd < 0).mean() * 100:.0f}%")
cnt = pd.Series([NAMES[x] if x >= 0 else "обычный взнос" for x in rule]).value_counts()
print("\nдни по правилам: " + ", ".join(f"{k} {v}" for k, v in cnt.items()))
print("\nкрупные покупки из резерва и продажи по месяцам (сумма, правило, средняя цена; цена через 90 дней):")
m = {}
for t, ri, v, pr in ev:
    k = (t.strftime("%Y-%m"), "покупка" if v > 0 else "продажа"); o = m.setdefault(k, [0, 0, {}]); o[0] += abs(v); o[1] += abs(v) / pr
    o[2][NAMES[ri]] = o[2].get(NAMES[ri], 0) + 1
for (mo, kind), (s, u, rr) in sorted(m.items()):
    avg = s / u; j = idx.searchsorted(pd.Timestamp(mo + "-15")); f90 = p[min(len(p) - 1, j + 90)] / avg - 1 if j + 90 < len(p) else None
    print(f"  {mo} {kind:7} ${s:7,.0f} по средней {avg:.3g} | {', '.join(f'{a} ×{b}' for a, b in rr.items())}" + (f" | через 90 дн {f90 * 100:+.0f}%" if f90 is not None else ""))
q = pd.Series(eq, idx); qd = pd.Series(dq, idx)
print("\nпо кварталам (стоимость счёта, стратегия / DCA):")
for t in q.resample("QE").last().index:
    a = q[q.index <= t]; b = qd[qd.index <= t]; n = len(a) * U
    print(f"  {t.date()}: ${a.iloc[-1]:,.0f} ({(a.iloc[-1] / n - 1) * 100:+.0f}%) / ${b.iloc[-1]:,.0f} ({(b.iloc[-1] / n - 1) * 100:+.0f}%)")
