"""Агент 4B, круг 9: портфель 9 монет с маржой для кандидата F (W25 + широкая тихая вершина 50% + возврат при новом 90-дн. максимуме
монеты + продажа пампа альта в медвежьем рынке) против W25: без плеча, шорт BTC 10%, схема плеча круга 2 агента 2 (+ шорт), соседние
схемы, стресс минимумов −20/−30% (и максимумов +20/+30% для шорта), годы старта.
Гипотеза: продажи F сокращают позицию с долгом перед падением и возвращают её при продолжении роста — под плечом выигрыш не меньше,
чем без плеча, ликвидаций нет. Возврат идёт без плеча (группа 0), продажи — группа 4.
Запуск: python3 app/agent4b_loop9.py <кандидаты.json> (W25 и F)"""
import sys, os, json
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import agent_margin
from agent2_margin import grouped, sized, plan_of, port2, fmt2, short_mask, starts, idx
from agent2_loop2 import su_sized


def _since(m):
    m = np.asarray(m, bool); o = np.full(len(m), np.nan); s = np.nan
    for i, x in enumerate(m):
        s = 0.0 if x else s + 1
        o[i] = s
    return o


def _hi90(close, kind, I):
    c = close.values; n = len(c); top = np.zeros(n, bool)
    for j in range(60, n):
        top[j] = c[j] >= c[max(0, j - 89):j].max()
    o = np.zeros(n)
    for i in range(n):
        o[i] = 1.0 if top[max(0, i - 6):i + 1].any() else 0.0
    return pd.Series(o, index=close.index)


agent_margin.EXTRA["up90"] = lambda close, kind, I: (close / close.rolling(90, min_periods=1).min() - 1) * 100
agent_margin.EXTRA["hi90"] = _hi90
agent_margin.EXTRA["ago_qt"] = lambda close, kind, I: pd.Series(_since(((I["qt"] > 0.5) | ((I["btcath"] < 15) & (I["oth90"] > 1))).fillna(False).values), index=close.index)

if __name__ == "__main__":
    CANDS = json.load(open(sys.argv[1])); names = list(CANDS)
    W = short_mask()
    LEV = (1, 2, 1.25, 2, 1, 1, 1, 1.25)
    years = np.array([idx[s].year for s in starts]); res = {}

    def rep(tag, S, lev, sh=0.0):
        A, G, _ = plan_of(S); o = port2(A, G, lev, W=W if sh else None, sh=sh, sep=True, xs=True)
        o["by_year"] = {int(y): float(np.median(np.array(o["_x"])[years == y])) for y in sorted(set(years))}; o["worst_start"] = float(min(o["_x"])); del o["_x"]
        res[tag] = o
        print(f"{tag}:\n    {fmt2(o)} | худший старт {o['worst_start']:+.0f}%", flush=True)
        return o
    lev2 = lambda S0: su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1")                     # noqa: E731
    for nm in names:
        S0 = CANDS[nm]
        rep(f"{nm} | без плеча", grouped(S0), (1,) * 8)
        rep(f"{nm} | без плеча + шорт BTC 10%", grouped(S0), (1,) * 8, 0.10)
        rep(f"{nm} | схема круга 2", lev2(S0), LEV)
        rep(f"{nm} | схема круга 2 + шорт BTC 10%", lev2(S0), LEV, 0.10)
    print("\nпо годам старта (медиана): " + " ".join(str(y) for y in sorted(set(years))))
    for k, o in res.items():
        print(f"  {k}: " + " ".join(f"{v:+.0f}%" for v in o["by_year"].values()))
    # соседние схемы для F (по одному шагу), без шорта и с шортом 10%
    S0 = CANDS[names[-1]]; print(f"\nсоседние схемы {names[-1]}:")
    base_cfg = dict(sb=0.25, sp=2.0, su="K1", sr=0.5, sd=0.5, lb=2, lp=1.25, lr=2, lu=1.25)
    nb = []
    for k, v in [(None, None), ("sb", 0.5), ("sr", 0.75), ("lb", 1.5), ("lb", 2.5), ("lp", 1.5), ("lr", 1.5), ("lr", 2.5)]:
        cfg = dict(base_cfg); tag = "схема круга 2"
        if k:
            cfg[k] = v; tag = f"{k} = {v}"
        A, G, _ = plan_of(su_sized(sized(S0, cfg["sb"], cfg["sp"], cfg["sr"], cfg["sd"]), cfg["su"]))
        lev = (1, cfg["lb"], cfg["lp"], cfg["lr"], 1, 1, 1, cfg["lu"])
        o = port2(A, G, lev, sep=True)
        nb.append({"tag": tag, **{q: o[q] for q in ("med", "p10", "liq", "lvl")}, "l20": o.get("l20"), "l30": o.get("l30")})
        print(f"  {tag:18s}: {fmt2(o)}", flush=True)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app", "found")
    json.dump({"res": res, "neighbors": nb}, open("/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent4b_loop9.json", "w"), ensure_ascii=False)
