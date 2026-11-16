"""combo4 для приложения (build_app_artifact.py): план по дням для каждой монеты — правила found/combo4-best.json (= combo3 без tune1)
на индикаторах симулятора маржи (agent4d_margin.Book, те же данные, что у приложения) + отложенная паника (k 0, выдача ×2 на развороте usdt).

Отложенная паника переводится в план «доля резерва» так же, как в pxm_margin.defer (проверено в марже): по каждой монете — модель резерва в долях
(взнос 1/день, план правил); день отложенной паники — только взнос, доля копится в «долг»; на развороте usdt долг × 2, в конце эпизода — без надбавки.
Итог — эффективный план plan[t] (решение по данным дня t, исполнение на следующий день), как у прочих стратегий с резервом."""
import os, json
import numpy as np
import pxm_margin  # noqa: F401  индикатор age для правила «эйфория в стейблах»
import combo2_margin  # noqa: F401  регистрирует индикаторы combo (rel180, corr180, beta180, ago_qt, флаги монет…)
import agent4d_margin as AD

HERE = os.path.dirname(os.path.abspath(__file__))
S4 = json.load(open(os.path.join(HERE, "found", "combo4-best.json")))
A_AGE, T_PK, RV, SU, MULT, GAP = 0, 0.98, 0.965, 1.2, 2.0, 10


def has(r, k):
    return any(q["ind"] == k for q in r["conds"])


def val(r, k):
    return next((q["v"] for q in r["conds"] if q["ind"] == k), None)


# семейства правил — для подписи и панели «Рынок сейчас» (номер семейства = индекс в state)
FAM = ["Капитуляция", "Отложенная покупка после выноса", "Волна ликвидаций", "Паника в стейблах", "Охрана после разворота", "Разворот биткоина",
       "Сильный страх", "Страх", "Перегретый фандинг", "Тихая вершина", "Широкая тихая вершина", "Возврат после вершины", "Памп в медвежьем рынке", "Альтсезон", "Эйфория в стейблах"]


def fam(r):
    if r["act"] > 0 and abs(r["act"] - 1) < 1e-9: return 4
    if r["act"] > 1:
        if has(r, "dly20_100f"): return 1
        if has(r, "usdt"): return 3
        if has(r, "oidd30"): return 2
        if has(r, "fng") and val(r, "fng") <= 10: return 0
        if has(r, "ago_qt"): return 11
        if has(r, "btcr30"): return 5
        return 3
    if has(r, "usdt") and has(r, "beta180"): return 14
    if has(r, "qt"): return 9
    if has(r, "isalt") and has(r, "oth90") and has(r, "fng") and not has(r, "btcath"): return 13
    if has(r, "oth90"): return 10
    if has(r, "up90"): return 12
    if has(r, "fund30"): return 8
    if has(r, "fng"): return 6 if val(r, "fng") <= 40 else 7
    return 7


SPLIT = [1 if g in (1, 2, 5, 7, 4) else 0 for g in range(8)]   # группы, чьи сделки делятся 50/50 на два дня (как combo3_margin.SPLIT)


def defer_plan(Ak, RIk, isP, Ck, u, upk, pend, first, last):
    """Эффективный план монеты с отложенной паникой (доли резерва), флаги откладывания/выдачи и долг в долях резерва."""
    n = len(Ak); plan = Ak.copy(); dflag = np.zeros(n, int); owed_sh = np.zeros(n)
    r = 0.0; units = 0.0; owed = 0.0
    for t in range(first, last + 1):
        p = Ck[t + 1] if t + 1 <= last and np.isfinite(Ck[t + 1]) else Ck[t]
        if not np.isfinite(p) or p <= 0: continue
        before = r; r += 1.0; a = Ak[t]; ri = RIk[t]
        if a < 0:
            amt = -a * units * p; units -= amt / p; r += amt * 0.999
        else:
            extra = (a - 1) * before
            if ri >= 0 and isP[ri] and (t - first) > A_AGE and upk[t] >= T_PK and not (u[t] > SU):
                owed = min(before, owed + extra); extra = 0.0; dflag[t] = 1
            rel = 0.0
            if owed > 0 and (upk[t] < RV or pend[t]):
                rel = owed * (MULT if upk[t] < RV else 1.0); owed = 0.0; dflag[t] = 2
            amt = min(r, 1.0 + extra + rel); units += amt * 0.999 / p; r -= amt
            if before > 1e-9 and a > 0: plan[t] = 1.0 + (amt - 1.0) / before
        if pend[t]: owed = 0.0
        owed_sh[t] = owed / r if r > 1e-9 else 0.0
    return plan, dflag, owed_sh


def margin_today(pm, Gk, LM, t):
    """Сделка по марже на день исполнения после дня t (как combo3_msim.sim6): доля своих денег сверх взноса (es, от резерва накануне),
    заём на взнос (bu, × взнос) и на долю (bs, × резерв накануне), доля продажи (sf, от позиции) — с учётом половины вчерашнего сигнала 50/50."""
    L = lambda g: float(LM[int(g)])  # noqa: E731
    a, g = float(pm[t]), int(Gk[t]); ap, gp = float(pm[t - 1]), int(Gk[t - 1])
    sf = 0.0; es = 0.0; bu = 0.0; bs = 0.0
    if a < 0: sf += -a * (0.5 if SPLIT[g] else 1.0)
    if ap < 0 and SPLIT[gp]: sf += -ap * 0.5                      # вторая половина вчерашней продажи
    if a >= 0:
        bu = max(0.0, L(g) - 1)
        if a > 1:
            part = (a - 1) * (0.5 if SPLIT[g] else 1.0); es += part; bs += max(0.0, L(g) - 1) * part
        if ap > 1 and SPLIT[gp]:                                  # вторая половина вчерашней покупки (в день продажи пропадает)
            part = (ap - 1) * 0.5; es += part; bs += max(0.0, L(gp) - 1) * part
    lev = max([L(g)] + ([L(gp)] if (ap > 1 and SPLIT[gp]) else []))
    return {"es": round(es, 6), "bu": round(bu, 6), "bs": round(bs, 6), "sf": round(min(1.0, sf), 6), "lev": lev, "a": round(a, 6)}


def compute(coins):
    """coins: [(symbol, kind)] → {symbol: {dates, plan, fam, defer, owed_share}} по дням IDX."""
    S = {"base": 1, "rules": [dict(r, grp=0) for r in S4["rules"]]}
    import pandas as pd
    AD.IDX = pd.date_range("2014-09-01", pd.Timestamp.utcnow().tz_localize(None).normalize())  # в agent4d_margin конец задан датой — для приложения до сегодня
    B = AD.Book(coins)
    A, _, RI = B.plan(S)
    usdt, othd, C = B.series("usdt"), B.series("othd"), B.C
    isP = np.array([r["act"] > 1 and has(r, "usdt") for r in S["rules"]] + [False])
    import combo3_margin as C3M
    SM, LM = C3M.scheme6({"base": 1, "rules": S4["rules"]}, lp=1.45, lr=1.45, sr=1.0, t1grp="off")   # базовое плечо ×1,45 (решение пользователя), дно ×2
    AM, GM, RIM = B.plan(SM)
    isPM = np.array([r["act"] > 1 and has(r, "usdt") for r in SM["rules"]] + [False])
    F = np.array([fam(r) for r in S["rules"]] + [-1])
    out = {}
    n = C.shape[0]
    for k, (sym, _) in enumerate(coins):
        ok = np.isfinite(C[:, k])
        if not ok.any(): continue
        first, last = int(np.argmax(ok)), int(np.where(ok)[0][-1])
        u = usdt[:, k]
        upk = np.full(n, np.nan)
        for i in range(n):
            w = u[max(0, i - 9):i + 1]; w = w[np.isfinite(w)]
            if len(w) and np.isfinite(u[i]): upk[i] = u[i] / w.max()
        on = (u > 1.07) & (othd[:, k] < 25); lastp = -10 ** 9; pend = np.zeros(n, bool)
        for i in range(n):
            if on[i]: lastp = i
            elif i - lastp == GAP: pend[i] = True
        plan, dflag, owed_sh = defer_plan(A[:, k], RI[:, k], isP, C[:, k], u, upk, pend, first, last)
        fm = np.where(RI[:, k] >= 0, F[np.maximum(RI[:, k], 0)], -1); fm[dflag == 2] = 3
        # маржа (основная схема combo4: дно 25% ×2, паника доли ×2 с плечом ×1,5, разворот 100% ×1,5, отложенная 50%; сделки дна, паники и продаж 50/50 на два дня)
        pm, dm, _ = defer_plan(AM[:, k], RIM[:, k], isPM, C[:, k], u, upk, pend, first, last)
        m = margin_today(pm, GM[:, k], LM, last)
        out[sym] = {"idx": AD.IDX, "plan": plan, "fam": fm, "defer": dflag, "owed": owed_sh, "upk": upk, "usdt": u, "B": B, "k": k, "m": m}
    return out


def strategy(sym, h, R, ind):
    """Объект стратегии для приложения по дням h['t'] (дни от 1970-01-01)."""
    import pandas as pd
    pos = {int((d - pd.Timestamp("1970-01-01")).days): i for i, d in enumerate(R["idx"])}
    ix = [pos.get(int(t)) for t in h["t"]]
    plan = [float(R["plan"][i]) if i is not None and np.isfinite(R["plan"][i]) else 1.0 for i in ix]
    fams = "".join("." if i is None else "p" if int(R["defer"][i]) == 2 else ("." if int(R["fam"][i]) < 0 else chr(97 + int(R["fam"][i]))) for i in ix)
    li = ix[-1]
    if li is None: raise ValueError(f"{sym}: последнего дня приложения нет в индексе combo4")
    a = plan[-1]; f = int(R["fam"][li]) if li is not None else -1; d = int(R["defer"][li]) if li is not None else 0
    codes = "cba0123"
    acts = "".join(codes[int(x) + 3] for x in np.select([np.array(plan) <= -1, np.array(plan) <= -0.3, np.array(plan) < 0, np.array(plan) >= 2, np.array(plan) > 1], [-3, -2, -1, 3, 2], default=1))
    if d == 1: action = "копим: сегодня только обычный взнос, доля резерва откладывается до разворота USDT"
    elif d == 2: action = "разворот USDT: покупаем отложенное ×2 сверх взноса"
    elif f >= 0: action = FAM[f] + (f" — продать {abs(a) * 100:.0f}%" if a < 0 else f" — взнос и {(a - 1) * 100:.0f}% резерва" if a > 1 else " — только взнос")
    else: action = "обычный взнос"
    beta = ind("beta180", li); light = "⚪" if beta is None else "🟢" if beta >= 0.9 else "🟡" if beta >= 0.5 else "🔴"
    label = f"{light} бета к BTC {beta:.2f}".replace(".", ",") if beta is not None else ""
    if R["owed"][li] > 0: label += f" · отложено {R['owed'][li] * 100:.0f}% резерва"
    st = state(ind, li, R)
    mm = R["m"]
    return {"fam": fams, "m": mm, "code": "combo4", "name": "combo4 (итоговая)", "about": "Итоговая стратегия: 55 правил combo3 (дно, ликвидации, паника, разворот, продажи на страхе и вершинах) + отложенная паника: пока доля USDT растёт, паника не покупает, а копит; на развороте USDT покупает отложенное вдвойне.",
            "acts": acts, "today": int(codes.index(acts[-1]) - 3), "plan": plan, "plan_today": a, "label": label, "action": action,
            "rule": FAM.index("Паника в стейблах") if d else f, "state": st}


def state(ind, i, R):
    """Панель «Рынок сейчас»: ключевые условия семейств (индекс = номер семейства FAM)."""
    def c(name, k, op, target, lo, hi, unit="", digits=0, v=None, w=None):
        v = ind(k, i) if v is None else v; w = ind(k, i - 7) if w is None else w
        okk = v is not None and (v < target if op == "<" else v > target)
        return {"name": name, "value": None if v is None else round(v, 3), "op": op, "target": target, "ok": bool(okk), "lo": lo, "hi": hi, "unit": unit, "digits": digits,
                "week": None if w is None else round(w, 3)}
    upk = R["upk"]
    rows = [
        ("Капитуляция", "взнос + 25% резерва", "buy", "Страх и жадность ниже 10 — паника на пике.", [c("Страх и жадность", "fng", "<", 10, 0, 100)]),
        ("Отложенная покупка после выноса", "взнос + 50% резерва", "buy", "После волны ликвидаций OI восстановился, а лонги вернулись — дно позади.", [c("Сигнал отложенной покупки", "dly20_100f", ">", 0.5, 0, 1, "", 1)]),
        ("Волна ликвидаций", "взнос + 50% резерва", "buy", "Открытый интерес биткоина упал на 28% от месячного максимума — вынос плеча.", [c("OI BTC от 30-дн. максимума", "oidd30", "<", -28, -50, 0, "%")]),
        ("Паника в стейблах", "взнос как обычно, доля резерва копится → на развороте USDT купить её ×2", "buy", "Деньги бегут в стейблы, а альткоины сдулись. Пока доля USDT растёт — копим долю правила; когда USDT развернулся вниз — покупаем отложенное вдвойне.",
         [c("USDT.D к своей средней", "usdt", ">", 1.07, 0.6, 1.6, "×", 2), c("Доля альткоинов", "othd", "<", 25, 15, 40, "%", 1),
          c("USDT от 10-дн. пика (разворот < 0,965)", "", "<", RV, 0.9, 1.0, "×", 3, v=None if not np.isfinite(upk[i]) else float(upk[i]), w=None if i < 7 or not np.isfinite(upk[i - 7]) else float(upk[i - 7]))]),
        ("Охрана после разворота", "только взнос, ничего не продавать", "hold", "Биткоин вырос на 20% за месяц, а страх ещё держится — не продавать на страхе.", [c("Биткоин за 30 дней", "btcr30", ">", 20, -40, 60, "%")]),
        ("Разворот биткоина", "взнос + весь резерв", "buy", "Биткоин резко вырос за месяц — резерв возвращается в рынок.", [c("Биткоин за 30 дней", "btcr30", ">", 20, -40, 60, "%")]),
        ("Сильный страх", "продать 30% монеты (у отстающих и крупных — больше)", "sell", "Страх есть, а в стейблы ещё не убежали — начало падения.", [c("Страх и жадность", "fng", "<", 40, 0, 100), c("Доля USDT на рынке", "usdtd", "<", 7.6, 2, 10, "%", 1)]),
        ("Страх", "продать 16% монеты", "sell", "То же, но слабее.", [c("Страх и жадность", "fng", "<", 52, 0, 100), c("Доля USDT на рынке", "usdtd", "<", 7.6, 2, 10, "%", 1)]),
        ("Перегретый фандинг", "продать 5% монеты", "sell", "Фандинг биткоина за месяц выше 2% — рынок перегрет плечом.", [c("Фандинг BTC за 30 дней", "fund30", ">", 2, -2, 6, "%", 1)]),
        ("Тихая вершина", "продать 40% монеты", "sell", "Биткоин у максимума, а деньги перетекают в альткоины.", [c("Биткоин до максимума", "btcath", "<", 10, 0, 80, "%"), c("Доля альткоинов за 90 дней", "oth90", ">", 1.5, -6, 6, " п.п.", 1)]),
        ("Широкая тихая вершина", "продать 50% монеты", "sell", "То же, но шире: биткоин ближе 15% к максимуму.", [c("Биткоин до максимума", "btcath", "<", 15, 0, 80, "%"), c("Доля альткоинов за 90 дней", "oth90", ">", 1, -6, 6, " п.п.", 1)]),
        ("Возврат после вершины", "взнос + 10% резерва", "buy", "После тихой вершины монета обновила 90-дн. максимум при жадности — рост продолжается.", [c("Недавно была тихая вершина", "ago_qt", ">", 0.5, 0, 1, "", 1)]),
        ("Памп в медвежьем рынке", "продать 10% монеты", "sell", "Биткоин глубоко под максимумом, а монета выросла больше чем в 4 раза от минимума.", [c("Рост от 90-дн. минимума", "up90", ">", 300, 0, 600, "%")]),
        ("Альтсезон", "продать 10% монеты (только альты)", "sell", "Жадность и приток в альткоины.", [c("Страх и жадность", "fng", ">", 65, 0, 100), c("Доля альткоинов за 90 дней", "oth90", ">", 1, -6, 6, " п.п.", 1)]),
        ("Эйфория в стейблах", "продать 5% монеты (мемы — 10%), если бета > 0,9", "sell", "Деньги уходят из стейблов в рынок: доля USDT заметно ниже своей средней. У монет, которые сильно ходят вместе с рынком, понемногу фиксируем.",
         [c("USDT.D к своей средней", "usdt", "<", 0.9, 0.6, 1.6, "×", 2), c("Бета к BTC за 180 дней", "beta180", ">", 0.9, 0, 3, "", 2)]),
    ]
    return [{"title": t, "what": w, "kind": kd, "why": y, "conds": cs} for t, w, kd, y, cs in rows]
