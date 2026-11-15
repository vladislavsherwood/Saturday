"""Сколько вкладывать в день в каждую монету портфеля по combo4 ($1–5): устойчивость, стабильность во времени, бета, длина истории, риск.
Основа — coin_check.py (план приложения: app_combo4 на данных engine), симуляция та же: взнос 1/день, план исполняется на следующий день, комиссия 0,1%.

PEPE: на Yahoo цена округлена до 1e-6 (за последние 200 дней 4 разных значения), поэтому в этом скрипте (и только тут) закрытия PEPE заменяются
дневными свечами Binance PEPEUSDT (точность ~1e-8; кэш app/cache/alloc_pepe_1d.json). На Binance PEPE с 2023-05-05; дни раньше — Yahoo.
Флаг --yahoo-pepe — оставить Yahoo (для сравнения).

Балльная система (зафиксирована ДО расчёта распределения, см. research/alloc_report.md):
  Q (насколько хорошо, 0–3) — медиана перевеса над DCA в скользящих годовых окнах (лог(стратегия / DCA)): ≥ 0,20 → 3, ≥ 0,10 → 2, ≥ 0,03 → 1;
      −1, если больше половины стартов за 3 года в минусе.
  S (насколько стабильно, 0–3) — m = min(доля стартов лучше DCA за всю историю, то же за 3 года, доля годовых окон лучше DCA):
      ≥ 0,90 → 3, ≥ 0,75 → 2, ≥ 0,60 → 1; −1, если одна из половин истории не лучше DCA; не выше 1 при медианной корреляции с BTC < 0,3
      или если годовых окон меньше 4.
  C (насколько уверены, 0–3) — длина истории: ≥ 5 лет → 3, ≥ 3 → 2, ≥ 1,5 → 1, иначе 0.
  $: Q+S ≥ 5 → 3, ≥ 3 → 2, иначе 1; C = 0 → не больше $1, C = 1 → не больше $2; худшая «яма» счёта (мин. стоимость/вложено − 1 по стартам за 3 года) < −75% → не больше $2.
  $4 — только Q = 3, S = 3, C ≥ 2, худший старт за 3 года > 0, бета не раздута; $5 — плюс C = 3, m ≥ 0,97, обе половины ≥ 0,20, 0 стартов в минусе.
  Устойчивость самой оценки: всё считается ещё и со сдвигом сетки стартов на 10 и 20 дней; если $ меняется — берём меньшее.

Запуск: python3 app/alloc_combo4.py [--yahoo-pepe] [--json out.json]"""
import os, sys, json
import numpy as np
import pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data  # noqa: E402

COINS = [("BTC-USD", "BTC"), ("ETH-USD", "ETH"), ("SOL-USD", "SOL"), ("HYPE32196-USD", "HYPE"), ("PUMP36507-USD", "PUMP"), ("DOGE-USD", "DOGE"),
         ("PEPE24478-USD", "PEPE"), ("ENA-USD", "ENA"), ("ZEC-USD", "ZEC"), ("USELESS36828-USD", "USELESS"), ("XMR-USD", "XMR"), ("LIT39125-USD", "Lighter")]
PEPE = "PEPE24478-USD"
YAHOO_PEPE = "--yahoo-pepe" in sys.argv

# ---- PEPE: точные закрытия с Binance (только внутри этого скрипта) ----
_hist = data.history


def _pepe_1d():
    def load():
        out, start = [], 0
        while True:
            d = data._get(f"https://data-api.binance.vision/api/v3/klines?symbol=PEPEUSDT&interval=1d&startTime={start}&limit=1000")
            out += [[k[0], float(k[1]), float(k[2]), float(k[3]), float(k[4])] for k in d]
            if len(d) < 1000: return out
            start = d[-1][0] + 1
    d = data._cached("alloc_pepe_1d.json", 6 * 3600, load)
    df = pd.DataFrame(d, columns=["t", "o", "h", "l", "c"]); df.index = pd.to_datetime(df["t"], unit="ms").dt.normalize(); return df


def history(symbol):
    s, price, cur = _hist(symbol)
    if symbol != PEPE or YAHOO_PEPE: return s, price, cur
    b = _pepe_1d(); df = data._ohlc[symbol].copy()
    common = df.index.intersection(b.index)
    for k in ("o", "h", "l", "c"): df.loc[common, k] = b.loc[common, k].values
    data._ohlc[symbol] = df
    return df["c"], float(b["c"].iloc[-1]), cur


data.history = history
import engine  # noqa: E402
import app_combo4 as C4  # noqa: E402

YR = 365


def load():
    syms = [s for s, _ in COINS]
    H = {s: dict(engine.series(s, "alt")) for s in syms}
    R = C4.compute([(s, "alt") for s in syms])
    cache, out = {}, {}
    for s, nm in COINS:
        h, r = H[s], R[s]; B, k = r["B"], r["k"]
        def ind(name, i, B=B, k=k):
            if not name or i is None or i < 0: return None
            key = id(B), name
            if key not in cache: cache[key] = B.series(name)
            v = cache[key][i, k]; return None if not np.isfinite(v) else float(v)
        st = C4.strategy(s, h, r, ind)
        pos = {d: i for i, d in enumerate(r["idx"])}
        days = [pd.Timestamp("1970-01-01") + pd.Timedelta(days=int(t)) for t in h["t"]]
        bi = [pos.get(d) for d in days]
        bs = B.series("beta180")[:, k]; cs = B.series("corr180")[:, k]
        beta = np.array([bs[i] if i is not None else np.nan for i in bi]); corr = np.array([cs[i] if i is not None else np.nan for i in bi])
        out[nm] = {"sym": s, "c": np.array(h["c"], float), "plan": np.array(st["plan"], float), "days": pd.DatetimeIndex(days), "beta": beta, "corr": corr}
    return out


def sim(c, plan, a, U=1.0):
    """Взнос U в день с дня a. Возвращает по дням t ≥ a: стоимость счёта, вложено, стоимость DCA."""
    n = len(c); m = n - a
    V, I, D = np.empty(m), np.empty(m), np.empty(m)
    cash = units = du = inv = 0.0
    for j, i in enumerate(range(a, n)):
        p = c[i]; x = plan[i - 1] if i > a else 1.0; before = cash; cash += U; inv += U; du += U * 0.999 / p
        if x < 0: amt = -x * units * p; units -= amt / p; cash += amt * 0.999
        else: amt = min(cash, U + (x - 1) * before); units += amt * 0.999 / p; cash -= amt
        V[j] = cash + units * p; I[j] = inv; D[j] = du * p
    return V, I, D


def q(a, p): return float(np.percentile(a, p)) if len(a) else float("nan")


def starts_stats(c, plan, lo, hi, step=30, horizon=180, off=0):
    """Старты каждые step дней с lo по (последний день − horizon) включительно, итог на последний день."""
    n = len(c); P, E = [], []; pits = []
    for a in range(lo + off, n - horizon, step):
        V, I, D = sim(c, plan, a)
        P.append(V[-1] / I[-1] - 1); E.append(np.log(V[-1] / D[-1])); pits.append(float((V / I).min() - 1))
    P, E = np.array(P), np.array(E)
    if not len(P): return None
    return {"n": len(P), "med": float(np.median(P)), "loss": float(np.mean(P < 0)), "worst": float(P.min()), "beat": float(np.mean(E > 0)),
            "iqr": q(P, 75) - q(P, 25), "edge_med": float(np.median(E)), "edge_iqr": q(E, 75) - q(E, 25), "pit_worst": min(pits), "pit_med": float(np.median(pits))}


def rolling_year(c, plan, step=30, off=0):
    n = len(c); E = []
    for a in range(off, n - YR, step):
        V, I, D = sim(c, plan, a); E.append(np.log(V[YR] / D[YR]))
    E = np.array(E)
    return {"n": len(E), "win": float(np.mean(E > 0)) if len(E) else float("nan"), "med": float(np.median(E)) if len(E) else float("nan"),
            "p10": q(E, 10), "min": float(E.min()) if len(E) else float("nan"), "E": E}


def edge_window(c, plan, a, b):
    V, I, D = sim(c[:b + 1], plan[:b + 1], a)
    return float(np.log(V[-1] / D[-1])), float(V[-1] / I[-1] - 1), float(D[-1] / I[-1] - 1)


def maxdd(x):
    pk = np.maximum.accumulate(x); return float((x / pk - 1).min())


def analyze(X, end=None, off=0):
    """Все метрики монеты по данным до дня end (индекс, включительно) — для честной проверки по половинам."""
    c, plan, days = X["c"], X["plan"], X["days"]
    if end is not None: c, plan, days = c[:end + 1], plan[:end + 1], days[:end + 1]
    n = len(c); o = {"n": n, "years": n / YR, "first": str(days[0].date())}
    if n < 200: return o
    o["all"] = starts_stats(c, plan, 0, n, off=off)
    o["y3"] = starts_stats(c, plan, max(0, n - 3 * YR), n, off=off)
    ry = rolling_year(c, plan, off=off); o["roll"] = {k: v for k, v in ry.items() if k != "E"}
    mid = n // 2
    o["h1"] = edge_window(c, plan, 0, mid); o["h2"] = edge_window(c, plan, mid, n - 1)
    # календарные годы: взнос с 1 января (или с начала истории) до 31 декабря (или конца)
    cy = {}
    for y in sorted(set(days.year)):
        ix = np.where(days.year == y)[0]
        if len(ix) >= 120: cy[int(y)] = edge_window(c, plan, int(ix[0]), int(ix[-1]))[0]
    o["cal"] = cy
    b, r = X["beta"][:n], X["corr"][:n]; fb, fr = b[np.isfinite(b)], r[np.isfinite(r)]
    if len(fb):
        o["beta_now"], o["beta_med"], o["corr_now"], o["corr_med"] = float(fb[-1]), float(np.median(fb)), float(fr[-1]), float(np.median(fr))
        o["beta_max1y"] = float(np.nanmax(b[-YR:])) if np.isfinite(b[-YR:]).any() else float("nan")
        bh = b[:mid][np.isfinite(b[:mid])]; o["beta_h1"] = float(np.median(bh)) if len(bh) else float("nan")
        o["beta_infl"] = bool(fb[-1] > 1.3 * np.median(fb))
    else:
        o.update(beta_now=np.nan, beta_med=np.nan, corr_now=np.nan, corr_med=np.nan, beta_max1y=np.nan, beta_h1=np.nan, beta_infl=False)
    a3 = max(0, n - 3 * YR); V, I, D = sim(c, plan, a3)
    o["dd3"] = maxdd(V / I); o["dd3_dca"] = maxdd(D / I); o["pit3"] = float((V / I).min() - 1)
    V, I, D = sim(c, plan, 0); o["dd_all"] = maxdd(V / I); o["dd_all_dca"] = maxdd(D / I)
    return o


def score(o):
    """Баллы и $ по зафиксированным правилам (см. шапку)."""
    if "all" not in o or o["all"] is None: return {"Q": 0, "S": 0, "C": 0, "usd": 1, "why": "мало истории"}
    rl, y3, al = o["roll"], o["y3"], o["all"]
    e1 = rl["med"] if rl["n"] >= 1 else al["edge_med"]
    Q = 3 if e1 >= 0.20 else 2 if e1 >= 0.10 else 1 if e1 >= 0.03 else 0
    if y3["loss"] > 0.5: Q = max(0, Q - 1)
    m = min(al["beat"], y3["beat"], rl["win"] if rl["n"] >= 1 else 1.0)
    S = 3 if m >= 0.90 else 2 if m >= 0.75 else 1 if m >= 0.60 else 0
    if min(o["h1"][0], o["h2"][0]) <= 0: S = max(0, S - 1)
    if (np.isfinite(o["corr_med"]) and o["corr_med"] < 0.3) or rl["n"] < 4: S = min(S, 1)
    C = 3 if o["years"] >= 5 else 2 if o["years"] >= 3 else 1 if o["years"] >= 1.5 else 0
    T = Q + S; usd = 3 if T >= 5 else 2 if T >= 3 else 1
    if C == 0: usd = min(usd, 1)
    if C == 1: usd = min(usd, 2)
    if y3["pit_worst"] < -0.75: usd = min(usd, 2)
    four = Q == 3 and S == 3 and C >= 2 and y3["worst"] > 0 and not o["beta_infl"]
    five = four and C == 3 and m >= 0.97 and min(o["h1"][0], o["h2"][0]) >= 0.20 and y3["loss"] == 0
    if five: usd = 5
    elif four: usd = 4
    return {"Q": Q, "S": S, "C": C, "m": m, "e1": e1, "usd": usd}


OFFS = (0, 10, 20)


def robust_usd(X, end=None):
    """$ по формуле при сдвиге сетки стартов на 0 / 10 / 20 дней; если $ меняется — берём меньшее (правило зафиксировано заранее)."""
    u = [score(analyze(X, end, off))["usd"] for off in OFFS]
    return min(u), u


def port(Xs, W, a_date, end_date=None):
    """Портфель с весами W ($/день), старт в дату a_date (монеты без истории — с первого дня), итог на end_date / последний день.
    Возвращает (прибыль портфеля, вклад монет в прибыль $, вложено, стоимость DCA)."""
    tot_v = tot_i = tot_d = 0.0; contrib = {}
    for nm, X in Xs.items():
        w = W.get(nm, 0)
        if not w: continue
        days = X["days"]; e = len(days) - 1 if end_date is None else int(np.searchsorted(days, end_date, side="right")) - 1
        a = int(np.searchsorted(days, a_date))
        if e < 0 or a > e - 30: continue
        V, I, D = sim(X["c"][:e + 1], X["plan"][:e + 1], a, w)
        tot_v += V[-1]; tot_i += I[-1]; tot_d += D[-1]; contrib[nm] = V[-1] - I[-1]
    return (tot_v / tot_i - 1 if tot_i else float("nan")), contrib, tot_i, tot_d


def port_path(Xs, W, a_date):
    """Счёт портфеля по дням от a_date: худшая «яма» (мин. стоимость/вложено − 1) и макс. просадка стоимость/вложено."""
    V = I = None
    for nm, X in Xs.items():
        w = W.get(nm, 0)
        if not w: continue
        a = int(np.searchsorted(X["days"], a_date))
        if a > len(X["c"]) - 30: continue
        v, i, _ = sim(X["c"], X["plan"], a, w)
        sv, si = pd.Series(v, index=X["days"][a:]), pd.Series(i, index=X["days"][a:])
        V = sv if V is None else V.add(sv, fill_value=0); I = si if I is None else I.add(si, fill_value=0)
    V, I = V.ffill(), I.ffill(); r = (V / I).values
    return float(r.min() - 1), maxdd(r)


def rule_v2(X, end=None):
    """Итоговое правило (после проверки v1): база $2; $3 — формула ≥ 3, история ≥ 5 лет, медиана стартов за 3 г. ≥ +40%, 0 стартов в минусе;
    $1 — история < 1,5 года или формула = $1 при доле годовых окон лучше DCA < 60%. $4–5 — никому (ни одна монета не держит оценку во времени)."""
    c = X["c"] if end is None else X["c"][:end + 1]
    if len(c) < 200: return 1
    o = analyze(X, end); u = robust_usd(X, end)[0]
    if o["years"] < 1.5 or (u == 1 and not (o["roll"]["win"] >= 0.6)): return 1
    if u >= 3 and o["years"] >= 5 and o["y3"]["med"] >= 0.40 and o["y3"]["loss"] == 0: return 3
    return 2


def port_starts(Xs, W, lo_date, hi_date, end_date=None, step=30):
    res = []
    d = lo_date
    while d <= hi_date:
        res.append((d, *port(Xs, W, d, end_date))); d += pd.Timedelta(days=step)
    P = np.array([r[1] for r in res]); edge = np.array([np.log((1 + r[1]) * r[3] / r[4]) if r[4] else np.nan for r in res])
    ctb = {}
    for r in res:
        tot = sum(r[2].values())
        for k, v in r[2].items(): ctb.setdefault(k, []).append(v)
    return {"n": len(P), "med": float(np.median(P)), "worst": float(P.min()), "loss": float(np.mean(P < 0)), "p25": q(P, 25),
            "edge_med": float(np.nanmedian(edge)), "P": P, "ctb": {k: float(np.median(v)) for k, v in ctb.items()}}


if __name__ == "__main__":
    Xs = load()
    O = {nm: analyze(X) for nm, X in Xs.items()}
    Sc = {nm: score(o) for nm, o in O.items()}
    pct = lambda x: f"{x * 100:+.0f}%"
    print("монета | дней | всё: старт медиана/минус/худший/лучше DCA/IQR | 3г: то же | год. окна: n, лучше DCA, медиана, p10 | половины | бета сейчас/медиана/макс1г/1-я пол. | корр сейчас/мед | яма 3г, DD 3г (DCA) | Q S C → $")
    for nm, o in O.items():
        if "all" not in o: print(nm, o); continue
        a, y, r, s = o["all"], o["y3"], o["roll"], Sc[nm]
        print(f"{nm:8s} {o['n']:5d} | {pct(a['med'])}/{a['loss'] * 100:.0f}%/{pct(a['worst'])}/{a['beat'] * 100:.0f}%/{a['iqr'] * 100:.0f} ({a['n']}) | "
              f"{pct(y['med'])}/{y['loss'] * 100:.0f}%/{pct(y['worst'])}/{y['beat'] * 100:.0f}%/{y['iqr'] * 100:.0f} ({y['n']}) | "
              f"{r['n']}, {r['win'] * 100:.0f}%, {r['med']:+.2f}, {r['p10']:+.2f} | {o['h1'][0]:+.2f} / {o['h2'][0]:+.2f} | "
              f"{o['beta_now']:.2f}/{o['beta_med']:.2f}/{o['beta_max1y']:.2f}/{o['beta_h1']:.2f}{' РАЗДУТА' if o['beta_infl'] else ''} | {o['corr_now']:.2f}/{o['corr_med']:.2f} | "
              f"{pct(y['pit_worst'])}, {pct(o['dd3'])} ({pct(o['dd3_dca'])}) | {s['Q']} {s['S']} {s['C']} m={s.get('m', 0):.2f} → ${s['usd']}")
    print("\nкалендарные годы, перевес над DCA (лог):")
    for nm, o in O.items(): print(f"{nm:8s}", " ".join(f"{y}:{v:+.2f}" for y, v in o.get("cal", {}).items()))
    RU = {nm: robust_usd(X) for nm, X in Xs.items()}
    print("\n$ при сдвиге сетки 0/10/20 дней:", {nm: u for nm, (_, u) in RU.items()})
    W = {nm: u for nm, (u, _) in RU.items()}; E = {nm: 2 for nm in Xs}
    tot = sum(W.values()); E2 = {nm: tot / len(Xs) for nm in Xs}
    end = max(X["days"][-1] for X in Xs.values())
    lo, hi = end - pd.Timedelta(days=3 * YR), end - pd.Timedelta(days=180)
    print(f"\nраспределение: {W} — ${tot}/день; равное $2 × {len(Xs)} = ${2 * len(Xs)}")
    res = {}
    for lab, w in (("равное $2", E), (f"равное ${tot / len(Xs):.2f} (та же сумма)", E2), ("предложенное", W)):
        r = port_starts(Xs, w, lo, hi); res[lab] = r
        print(f"{lab:28s} старты каждые 30 дн за 3 г ({r['n']}): медиана {pct(r['med'])}, p25 {pct(r['p25'])}, худший {pct(r['worst'])}, в минусе {r['loss'] * 100:.0f}%, перевес над DCA (лог, медиана) {r['edge_med']:+.3f}")
    for lab, w in (("равное $2 без ZEC", {k: 2 for k in Xs if k != "ZEC"}), ("предложенное без ZEC", {k: v for k, v in W.items() if k != "ZEC"})):
        r = port_starts(Xs, w, lo, hi)
        print(f"{lab:28s} медиана {pct(r['med'])}, худший {pct(r['worst'])}, в минусе {r['loss'] * 100:.0f}%, перевес над DCA {r['edge_med']:+.3f}")
    rp, re_ = res["предложенное"], res["равное $2"]
    print("  старт за стартом: предложенное лучше равного $2 в", f"{np.mean(rp['P'] > re_['P']) * 100:.0f}% стартов")
    print("  медианный вклад монет в прибыль ($ на старт), предложенное / равное $2:")
    for nm in Xs: print(f"   {nm:8s} {rp['ctb'].get(nm, 0):9.0f} / {re_['ctb'].get(nm, 0):9.0f}")
    # без одной монеты: дать ей $2 как у равного — как меняется медиана
    print("  если монете вернуть $2 (остальное как предложено) — медиана портфеля:")
    for nm in Xs:
        if W[nm] == 2: continue
        w = dict(W); w[nm] = 2; r = port_starts(Xs, w, lo, hi)
        print(f"   {nm:8s} ${W[nm]} → $2: медиана {pct(r['med'])}, худший {pct(r['worst'])}")
    # честная проверка: баллы по данным до среза → распределение → старты после среза
    for back in (int(1.5 * YR), 3 * YR):
        cut = end - pd.Timedelta(days=back)
        Wc = {}
        for nm, X in Xs.items():
            e = int(np.searchsorted(X["days"], cut, side="right")) - 1
            Wc[nm] = robust_usd(X, e)[0] if e >= 200 else 1
        tc = sum(Wc.values()); Ec = {nm: tc / len(Xs) for nm in Xs}
        hi2 = end - pd.Timedelta(days=90)
        print(f"\nчестная проверка: срез {cut.date()} (баллы по данным до него) → {Wc} = ${tc}/день")
        for lab, w in (("равное (та же сумма)", Ec), ("равное $2", E), ("по срезу", Wc), ("сегодняшнее предложенное", W)):
            r = port_starts(Xs, w, cut, hi2); wz = {k: v for k, v in w.items() if k != "ZEC"}; rz = port_starts(Xs, wz, cut, hi2)
            print(f"   {lab:26s} старты после среза ({r['n']}): медиана {pct(r['med'])}, худший {pct(r['worst'])}, в минусе {r['loss'] * 100:.0f}%, перевес над DCA {r['edge_med']:+.3f}"
                  f" | без ZEC: медиана {pct(rz['med'])}, худший {pct(rz['worst'])}")
            if lab == "по срезу": print("      вклад монет (медиана $):", {k: round(v) for k, v in r["ctb"].items()})
    if "--json" in sys.argv:
        f = sys.argv[sys.argv.index("--json") + 1]
        json.dump({"O": O, "S": Sc}, open(f, "w"), default=lambda x: float(x) if isinstance(x, (np.floating, np.bool_)) else str(x), ensure_ascii=False, indent=1)

    # ---- v2: итоговое правило (сформулировано после проверки v1, см. отчёт) ----
    if True:
        V2 = {nm: rule_v2(X) for nm, X in Xs.items()}
        print(f"\nv2 сегодня: {V2} = ${sum(V2.values())}/день")
        def risk(w, lo_, hi_):
            pits, dds = [], []
            d = lo_
            while d <= hi_:
                a, b = port_path(Xs, w, d); pits.append(a); dds.append(b); d += pd.Timedelta(days=30)
            return min(pits), float(np.median(dds)), min(dds)
        for lab, w in (("равное $2", E), ("v1 (формула)", W), ("v2", V2)):
            r = port_starts(Xs, w, lo, hi); pk = risk(w, lo, hi); wz = {k: v for k, v in w.items() if k != "ZEC"}; rz = port_starts(Xs, wz, lo, hi)
            print(f"  3 г. {lab:12s} ${sum(w.values())}: медиана {pct(r['med'])}, худший {pct(r['worst'])}, в минусе {r['loss'] * 100:.0f}%, перевес над DCA {r['edge_med']:+.3f}, "
                  f"худшая яма {pct(pk[0])}, просадка медиана/худшая {pct(pk[1])}/{pct(pk[2])} | без ZEC медиана {pct(rz['med'])}, худший {pct(rz['worst'])}")
        for back in (int(1.5 * YR), 3 * YR):
            cut = end - pd.Timedelta(days=back); hi2 = end - pd.Timedelta(days=90)
            Wv = {}
            for nm, X in Xs.items():
                e = int(np.searchsorted(X["days"], cut, side="right")) - 1
                Wv[nm] = rule_v2(X, e) if e >= 200 else 1
            print(f"  срез {cut.date()}: v2 по данным до среза {Wv} = ${sum(Wv.values())}")
            for lab, w in (("равное $2", E), ("v2 по срезу", Wv)):
                r = port_starts(Xs, w, cut, hi2); pk = risk(w, cut, hi2); wz = {k: v for k, v in w.items() if k != "ZEC"}; rz = port_starts(Xs, wz, cut, hi2)
                print(f"     {lab:12s}: медиана {pct(r['med'])}, худший {pct(r['worst'])}, перевес над DCA {r['edge_med']:+.3f}, худшая яма {pct(pk[0])}, просадка медиана {pct(pk[1])} | без ZEC медиана {pct(rz['med'])}, худший {pct(rz['worst'])}")
    # ---- итоговое предложение: v2 + BTC $2 (якорь: 0% стартов в минусе, худший старт +16%, но перевес над DCA мал — не выше $2) ----
    FIN = dict(V2); FIN["BTC"] = 2
    print(f"\nитог: {FIN} = ${sum(FIN.values())}/день")
    for lo_, hi_, tag in ((lo, hi, "3 г."), (end - pd.Timedelta(days=int(1.5 * YR)), end - pd.Timedelta(days=90), "после 1,5 г. назад"),
                          (end - pd.Timedelta(days=3 * YR), end - pd.Timedelta(days=90), "после 3 г. назад")):
        for lab, w in (("равное $2", E), ("итог", FIN)):
            r = port_starts(Xs, w, lo_, hi_); pk = risk(w, lo_, hi_); wz = {k: v for k, v in w.items() if k != "ZEC"}; rz = port_starts(Xs, wz, lo_, hi_)
            sh = {k: round(v / max(1e-9, sum(r["ctb"].values())) * 100) for k, v in r["ctb"].items()}
            print(f"  {tag:20s} {lab:10s}: медиана {pct(r['med'])}, худший {pct(r['worst'])}, в минусе {r['loss'] * 100:.0f}%, перевес над DCA {r['edge_med']:+.3f}, яма {pct(pk[0])}, "
                  f"просадка мед. {pct(pk[1])} | без ZEC {pct(rz['med'])}/{pct(rz['worst'])} | доля прибыли, %: {sh}")
        rf, re2 = port_starts(Xs, FIN, lo_, hi_), port_starts(Xs, E, lo_, hi_)
        print(f"  {tag:20s} итог лучше равного в {np.mean(rf['P'] > re2['P']) * 100:.0f}% стартов")
