"""imp10, круг 4: правила кругов 1–3 на портфеле пользователя с маржой.
(а) фандинг лонга перпа у DOGE и PEPE (на Hyperliquid нет спота): 6% и 11% годовых — сколько стоит держать их перпом;
(б) исключение lag365_liq (отставание от BTC > 50% за год и объём < 25% своего максимума) с продажей в резервы остальных — без плеча и с
лучшей маржой (R16 + A4 ×1,4 + шорт BTC 20%), пять портфелей, стресс −20/−30% (+20/+30% для шорта), в срок и на день позже;
(в) состояние 9 монет сейчас: место по капитализации во вселенной, сила к BTC за год, объём к максимуму, возраст, волатильность;
что выбрали бы правила круга 2 сегодня. Запуск: python3 app/imp10_r4.py"""
import sys, json, time, os
import numpy as np
from imp10_port import Uni, SETS, S_BEST, nolev, best_margin, IDX, safe, SP, NOSPOT
from imp10_r2 import universe, features, pick
from imp10_r3 import extra, exmask

t0 = time.time(); OUT = {}


def both(U, A, G, L, sh, **kw):
    o0 = U.portw(A, G, L, sh=sh, stress=True, **kw); o1 = U.portw(A, G, L, sh=sh, stress=True, lag=1, **kw)
    return {"m0": o0["med"], "m1": o1["med"], "p10": o0["p10"], "early": o0["early"], "late": o0["late"], "lvl": min(o0["lvl"], o1["lvl"]),
            "safe": safe(o0) and safe(o1), "liq": [o0["liq"], o0.get("l20"), o0.get("l30"), o1["liq"], o1.get("l20"), o1.get("l30")]}


def fm(o):
    return (f"мед {o['m0']:+6.0f}% (+1 д {o['m1']:+6.0f}) p10 {o['p10']:+4.0f}% 22–26 {o['late']:+4.0f}% запас {min(o['lvl'], 99):5.2f} "
            f"{'0 ликв.' if o['safe'] else 'ЛИКВ ' + str(o['liq'])}")


for nm, coins in SETS.items():
    U = Uni(coins); F = extra(features(U), U)
    EXr = exmask(F, "lag365_liq").astype(float); age = np.isfinite(U.C).cumsum(axis=0); EXr[age < 365] = 0
    for tag, (S, L), sh in (("без плеча", nolev(S_BEST), 0.0), ("лучшая маржа", best_margin(S_BEST), 0.2)):
        A, G = U.plan2(S)
        for vn, kw in (("основа", {}), ("фандинг DOGE/PEPE 6%", {"FD": [0.06 / 365 if s in NOSPOT else 0 for s, _ in coins]}),
                       ("фандинг DOGE/PEPE 11%", {"FD": [0.11 / 365 if s in NOSPOT else 0 for s, _ in coins]}),
                       ("исключение lag365_liq → резервы", {"EX": EXr, "mode": 1}), ("исключение lag365 → резервы", {"EX": None, "mode": 1})):
            if vn.startswith("фандинг") and not any(s in NOSPOT for s, _ in coins):
                continue
            if vn == "исключение lag365 → резервы":
                E2 = exmask(F, "lag365").astype(float); E2[age < 365] = 0; kw = {"EX": E2, "mode": 1}
            o = both(U, A, G, L, sh, **kw); OUT[f"{nm}|{tag}|{vn}"] = o
            print(f"{nm:7s} {tag:13s} {vn:32s} {fm(o)}", flush=True)

# (в) состояние сейчас
U = Uni(universe("A")); F = features(U); F["C"] = U.C; F = extra(F, U)
t = len(IDX) - 1
while not np.isfinite(U.C[t, 0]):
    t -= 1
def symname(k):
    q = U.coins[k][0]
    return json.load(open(os.path.join(SP, "imp10_mcap", f"{q[4:]}.json")))["sym"] if q.startswith("cmc:") else q


names = {k: symname(k) for k in range(len(U.coins))}
p9 = [s for s, _ in SETS["P9"]]
print(f"\nсостояние на {IDX[t].date()} (место по капитализации среди {int(np.isfinite(F['CAP'][t]).sum())} монет вселенной A, без стейблов)")
NOW = {}
for s in p9:
    k = [i for i, (q, _) in enumerate(U.coins) if q == s][0]
    row = {"rank": None if not np.isfinite(F["RANK"][t, k]) else int(F["RANK"][t, k]), "cap_bn": float(F["CAP"][t, k] / 1e9) if np.isfinite(F["CAP"][t, k]) else None,
           "rel365": None if not np.isfinite(F["REL"][t, k]) else float(F["REL"][t, k]), "liq": None if not np.isfinite(F["LIQ"][t, k]) else float(F["LIQ"][t, k]),
           "age": int(F["AGE"][t, k]), "sig": None if not np.isfinite(F["SIG"][t, k]) else float(F["SIG"][t, k])}
    NOW[s] = row
    print(f"  {s:15s} место {row['rank']} кап. ${row['cap_bn'] or 0:.1f} млрд | к BTC за год {row['rel365'] if row['rel365'] is None else round(row['rel365'])}% | "
          f"объём/макс {row['liq'] if row['liq'] is None else round(row['liq'], 2)} | возраст {row['age']} дн. | волатильность {row['sig'] if row['sig'] is None else round(row['sig'])}%")
rng = np.random.default_rng(0)
for rule in ("CAP", "MOM_ALL", "TOP30_MOM"):
    ch = pick(F, t + 1, rule, rng) if t + 1 < len(IDX) else pick(F, t, rule, rng)
    print(f"  правило {rule}: " + ", ".join(names[i].replace('-USD', '') for i in ch))
    NOW[f"rule:{rule}"] = [names[i] for i in ch]
top30 = np.argsort(-np.nan_to_num(F["CAP"][t], nan=0))[:31]
print("  30 крупнейших (вселенная A): " + ", ".join(names[i].replace('-USD', '') for i in top30 if i != 0))
NOW["top30"] = [names[i] for i in top30 if i != 0]
json.dump({"res": OUT, "now": NOW}, open(os.path.join(SP, "imp10_r4.json"), "w"), indent=1, default=float)
print(f"[{time.time() - t0:.0f} с]")
