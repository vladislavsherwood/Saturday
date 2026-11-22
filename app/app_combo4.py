"""combo5 для приложения (build_app_artifact.py): план по дням для каждой монеты — правила found/combo5-best.json
(= combo4: combo3 без tune1 + эйфория + эйфория мемов, + 11-е правило «удержание после капитуляции»; ловушка для фитилей — заявками в приложении)
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
SPECS = {code: json.load(open(os.path.join(HERE, "found", f"{code}-best.json"))) for code in ("combo6", "combo5", "combo4")}   # combo6 — основная, combo5 и combo4 — прежние
MAIN = "combo6"
S4 = SPECS[MAIN]
WICK = S4["wick"]
_ind_prev = AD.Book.ind


def _ind_h2(self, k):
    """+ индикаторы правила «удержание после капитуляции»: h2fd15 — дней с последнего дня страха < 15; mvrv — MVRV биткоина (CoinMetrics)."""
    I = _ind_prev(self, k)
    if "h2fd15" not in I:
        import pandas as pd
        import data
        f = I["fng"]; on = (f < 15).fillna(False).values; idx = np.arange(len(f), dtype=float)
        last = pd.Series(np.where(on, idx, np.nan)).ffill().values
        I["h2fd15"] = pd.Series(np.where(np.isnan(last), 1e9, idx - last), index=f.index)
        I["mvrv"] = data.mvrv_history().reindex(f.index, method="ffill")
    if "hvv" not in I:   # combo6: волатильность монеты за 180 дней, пока её нет — за 90 (как hv2_margin.py)
        close = self.I[k][0]; lr = np.log(close).diff()
        v90 = lr.rolling(90, min_periods=72).std(ddof=0) * np.sqrt(365) * 100
        I["hvv"] = I["vol180"].where(np.isfinite(I["vol180"]), v90) if "vol180" in I else v90
    return I


if getattr(AD.Book.ind, "__name__", "") != "_ind_h2":
    AD.Book.ind = _ind_h2
A_AGE, T_PK, RV, SU, MULT, GAP = 0, 0.98, 0.965, 1.2, 2.0, 10


def has(r, k):
    return any(q["ind"] == k for q in r["conds"])


def val(r, k):
    return next((q["v"] for q in r["conds"] if q["ind"] == k), None)


# семейства правил — для подписи и панели «Рынок сейчас» (номер семейства = индекс в state)
FAM = ["Капитуляция", "Отложенная покупка после выноса", "Волна ликвидаций", "Паника в стейблах", "Охрана после разворота", "Разворот биткоина",
       "Сильный страх", "Страх", "Перегретый фандинг", "Тихая вершина", "Широкая тихая вершина", "Возврат после вершины", "Памп в медвежьем рынке", "Альтсезон", "Эйфория в стейблах", "Удержание после капитуляции"]


LET = "abcdefghijklmnoq"   # буква семейства по дням; «p» занята выдачей отложенной паники


def fam(r):
    if r["act"] > 0 and abs(r["act"] - 1) < 1e-9: return 15 if has(r, "mvrv") else 4
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


def compute(coins, code=MAIN, B=None):
    """coins: [(symbol, kind)] → {symbol: {dates, plan, fam, defer, owed_share}} по дням IDX; code — правила combo5 или combo4; B — готовая книга (не считать второй раз)."""
    rules = SPECS[code]["rules"]
    S = {"base": 1, "rules": [dict(r, grp=0) for r in rules]}
    import pandas as pd
    if B is None:
        AD.IDX = pd.date_range("2014-09-01", pd.Timestamp.utcnow().tz_localize(None).normalize())  # в agent4d_margin конец задан датой — для приложения до сегодня
        B = AD.Book(coins)
    A, _, RI = B.plan(S)
    usdt, othd, C = B.series("usdt"), B.series("othd"), B.C
    isP = np.array([r["act"] > 1 and has(r, "usdt") for r in S["rules"]] + [False])
    import combo3_margin as C3M
    SM, LM = C3M.scheme6({"base": 1, "rules": rules}, lp=1.45, lr=1.45, sr=1.0, t1grp="off")   # базовое плечо ×1,45 (решение пользователя), дно ×2
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
        out[sym] = {"idx": AD.IDX, "plan": plan, "fam": fm, "defer": dflag, "owed": owed_sh, "upk": upk, "usdt": u, "B": B, "k": k, "m": m, "code": code}
    return out


def strategy(sym, h, R, ind):
    """Объект стратегии для приложения по дням h['t'] (дни от 1970-01-01)."""
    import pandas as pd
    pos = {int((d - pd.Timestamp("1970-01-01")).days): i for i, d in enumerate(R["idx"])}
    ix = [pos.get(int(t)) for t in h["t"]]
    plan = [float(R["plan"][i]) if i is not None and np.isfinite(R["plan"][i]) else 1.0 for i in ix]
    fams = "".join("." if i is None else "p" if int(R["defer"][i]) == 2 else ("." if int(R["fam"][i]) < 0 else LET[int(R["fam"][i])]) for i in ix)
    li = ix[-1]
    if li is None: raise ValueError(f"{sym}: последнего дня приложения нет в индексе combo4")
    a = plan[-1]; f = int(R["fam"][li]) if li is not None else -1; d = int(R["defer"][li]) if li is not None else 0
    codes = "cba0123"
    acts = "".join(codes[int(x) + 3] for x in np.select([np.array(plan) <= -1, np.array(plan) <= -0.3, np.array(plan) < 0, np.array(plan) >= 2, np.array(plan) > 1], [-3, -2, -1, 3, 2], default=1))
    if d == 1: action = "копим: сегодня только обычный взнос, доля резерва откладывается до разворота USDT"
    elif d == 2: action = "разворот USDT: покупаем отложенное ×2 сверх взноса"
    elif f >= 0: action = FAM[f] + (f" — продать {abs(a) * 100:.0f}%" if a < 0 else f" — взнос и {(a - 1) * 100:.0f}% резерва" if a > 1 else " — только взнос, на страхе не продаём" if f == 15 else " — только взнос")
    else: action = "обычный взнос"
    beta = ind("beta180", li)
    label = (f"бета к BTC {beta:.2f}".replace(".", ",") + (" (ходит с рынком)" if beta >= 0.9 else " (слабо связана с рынком)" if beta < 0.5 else "")) if beta is not None else ""
    if R["owed"][li] > 0: label += f" · отложено {R['owed'][li] * 100:.0f}% резерва"
    code = R.get("code", MAIN)
    st = state(ind, li, R, code) if code != "combo4" else state(ind, li, R, code)[:15]   # у combo4 нет удержания после капитуляции (последняя карточка)
    mm = R["m"]
    if code == "combo4":
        return {"fam": fams, "m": mm, "code": "combo4", "name": "combo4", "about": "Прежняя итоговая стратегия: 57 правил (дно, ликвидации, паника, разворот, продажи на страхе и вершинах, эйфория в стейблах) + отложенная паника. Без удержания после капитуляции и без лимиток на фитиль.",
                "acts": acts, "today": int(codes.index(acts[-1]) - 3), "plan": plan, "plan_today": a, "label": label, "action": action,
                "rule": FAM.index("Паника в стейблах") if d else f, "state": st}
    if code == "combo6":
        return {"fam": fams, "m": mm, "code": "combo6", "name": "combo6", "about": "Итоговая стратегия: combo5 (58 правил, отложенная паника, удержание после капитуляции, лимитки на фитиль) + у волатильных монет (не крупных, волатильность за 180 дней выше 110% / 130%) продажи у вершины рынка ×1,5 / ×2 и памп раньше. Резерв, не занятый лимитками, — в стейблах с доходом.",
                "wick": {"lv": [[-float(k), float(f)] for k, f in zip(WICK["levels"], WICK["fractions_of_reserve"])], "every": int(WICK["every_days"]), "age": int(WICK["coin_age_min_days"])},
                "acts": acts, "today": int(codes.index(acts[-1]) - 3), "plan": plan, "plan_today": a, "label": label, "action": action,
                "rule": FAM.index("Паника в стейблах") if d else f, "state": st}
    return {"fam": fams, "m": mm, "code": "combo5", "name": "combo5", "about": "Стратегия combo5: 58 правил (дно, ликвидации, паника, разворот, продажи на страхе и вершинах, эйфория в стейблах, удержание после капитуляции) + отложенная паника (пока доля USDT растёт, паника копит; на развороте USDT покупает отложенное вдвойне) + ловушка для фитилей: раз в 3 дня три лимитки из резерва на −25 / −40 / −60% от закрытия (15 / 25 / 35% резерва). Резерв, не занятый лимитками, — в стейблах с доходом.",
            "wick": {"lv": [[-float(k), float(f)] for k, f in zip(WICK["levels"], WICK["fractions_of_reserve"])], "every": int(WICK["every_days"]), "age": int(WICK["coin_age_min_days"])},
            "acts": acts, "today": int(codes.index(acts[-1]) - 3), "plan": plan, "plan_today": a, "label": label, "action": action,
            "rule": FAM.index("Паника в стейблах") if d else f, "state": st}


def state(ind, i, R, code=MAIN):
    """Панель «Рынок сейчас»: условия семейств (индекс = номер семейства FAM). В карточке — все условия, общие для правил
    семейства, без пропусков: иначе правило выглядит выполненным, когда оно не сработало (check_state.py это проверяет).
    У «Паники в стейблах» третья строка — не условие правила, а момент выдачи отложенного (разворот USDT)."""
    def c(name, k, op, target, lo, hi, unit="", digits=0, v=None, w=None):
        v = ind(k, i) if v is None else v; w = ind(k, i - 7) if w is None else w
        okk = v is not None and (v < target if op == "<" else v > target)
        return {"name": name, "value": None if v is None else round(v, 3), "op": op, "target": target, "ok": bool(okk), "lo": lo, "hi": hi, "unit": unit, "digits": digits,
                "week": None if w is None else round(w, 3)}
    upk = R["upk"]
    # combo6: у волатильной некрупной монеты продажи у вершины ×1,5 (hvv > 110) / ×2 (> 130), порог пампа +275% / +250% вместо +300%
    hv, big = (ind("hvv", i), ind("isbig", i)) if code == "combo6" else (None, None)
    vm = 1.0 if hv is None or (big is not None and big > 0.5) else 2.0 if hv > 130 else 1.5 if hv > 110 else 1.0
    pt = {2.0: 250, 1.5: 275}.get(vm, 300)
    vx = "" if code != "combo6" else f" (у этой монеты сейчас ×{vm:g} — волатильная)".replace(".", ",") if vm > 1 else ""
    rows = [
        ("Капитуляция", "взнос + 25% резерва", "buy", "Страх и жадность ниже 10 — паника на пике.", [c("Страх и жадность", "fng", "<", 10, 0, 100)]),
        ("Отложенная покупка после выноса", "взнос + 50% резерва", "buy", "После волны ликвидаций OI восстановился, а лонги вернулись — дно позади.", [c("Сигнал отложенной покупки", "dly20_100f", ">", 0.5, 0, 1, "", 1)]),
        ("Волна ликвидаций", "взнос + 50% резерва", "buy", "Открытый интерес биткоина упал на 28% от месячного максимума — вынос плеча.", [c("OI BTC от 30-дн. максимума", "oidd30", "<", -28, -50, 0, "%")]),
        ("Паника в стейблах", "взнос как обычно, доля резерва копится и покупается ×2 на развороте USDT", "buy", "Деньги бегут в стейблы, а альткоины сдулись. Пока доля USDT растёт — копим долю правила; когда USDT развернулся вниз — покупаем отложенное вдвойне.",
         [c("USDT.D к своей средней", "usdt", ">", 1.07, 0.6, 1.6, "×", 2), c("Доля альткоинов", "othd", "<", 25, 15, 40, "%", 1),
          c("USDT от 10-дн. пика (разворот < 0,965)", "", "<", RV, 0.9, 1.0, "×", 3, v=None if not np.isfinite(upk[i]) else float(upk[i]), w=None if i < 7 or not np.isfinite(upk[i - 7]) else float(upk[i - 7]))]),
        ("Охрана после разворота", "только взнос, ничего не продавать", "hold", "Биткоин вырос на 20% за месяц, а страх ещё держится — не продавать на страхе.", [c("Биткоин за 30 дней", "btcr30", ">", 20, -40, 60, "%"), c("Страх и жадность", "fng", "<", 52, 0, 100)]),
        ("Разворот биткоина", "взнос + весь резерв", "buy", "Биткоин резко вырос за месяц — резерв возвращается в рынок.", [c("Биткоин за 30 дней", "btcr30", ">", 20, -40, 60, "%")]),
        ("Сильный страх", "продать 30% монеты (у отстающих и крупных — больше)", "sell", "Страх есть, а в стейблы ещё не убежали — начало падения.", [c("Страх и жадность", "fng", "<", 40, 0, 100), c("Доля USDT на рынке", "usdtd", "<", 7.6, 2, 10, "%", 1)]),
        ("Страх", "продать 16% монеты", "sell", "То же, но слабее.", [c("Страх и жадность", "fng", "<", 52, 0, 100), c("Доля USDT на рынке", "usdtd", "<", 7.6, 2, 10, "%", 1)]),
        ("Перегретый фандинг", "продать 5% монеты", "sell", "Фандинг биткоина за месяц выше 2% — рынок перегрет плечом.", [c("Фандинг BTC за 30 дней", "fund30", ">", 2, -2, 6, "%", 1)]),
        ("Тихая вершина", "продать 40% монеты", "sell", "Биткоин у максимума, а деньги перетекают в альткоины.", [c("Биткоин до максимума", "btcath", "<", 10, 0, 80, "%"), c("Доля альткоинов за 90 дней", "oth90", ">", 1.5, -6, 6, " п.п.", 1)]),
        ("Широкая тихая вершина", "продать 50% монеты" + vx, "sell", "То же, но шире: биткоин ближе 15% к максимуму.", [c("Биткоин до максимума", "btcath", "<", 15, 0, 80, "%"), c("Доля альткоинов за 90 дней", "oth90", ">", 1, -6, 6, " п.п.", 1)]),
        ("Возврат после вершины", "взнос + 10% резерва", "buy", "После тихой вершины монета обновила 90-дн. максимум при жадности — рост продолжается.", [c("Дней после тихой вершины", "ago_qt", "<", 45.5, 0, 90, " дн."), c("Страх и жадность", "fng", ">", 52, 0, 100), c("Обновила 90-дн. максимум за неделю (1 — да)", "hi90", ">", 0.5, 0, 1, "", 1)]),
        ("Памп в медвежьем рынке", "продать 10% монеты" + vx, "sell", "Биткоин глубоко под максимумом, а монета выросла больше чем в 4 раза от минимума" + (f" (у волатильной монеты — в {pt / 100 + 1:g} раза)".replace(".", ",") if pt < 300 else "") + ".",
         [c("Биткоин до максимума", "btcath", ">", 20, 0, 80, "%"), c("Рост от 90-дн. минимума", "up90", ">", pt, 0, 600, "%")]),
        ("Альтсезон", "продать 10% монеты (только альты)", "sell", "Жадность и приток в альткоины.", [c("Страх и жадность", "fng", ">", 65, 0, 100), c("Доля альткоинов за 90 дней", "oth90", ">", 1, -6, 6, " п.п.", 1), c("Альткоин: не крупная и не мем (1 — да)", "isalt", ">", 0.5, 0, 1, "", 1)]),
        ("Эйфория в стейблах", "продать 5% монеты (мемы — 10%), если бета > 0,9" + vx, "sell", "Деньги уходят из стейблов в рынок: доля USDT заметно ниже своей средней. У монет, которые сильно ходят вместе с рынком, понемногу фиксируем.",
         [c("USDT.D к своей средней", "usdt", "<", 0.9, 0.6, 1.6, "×", 2), c("Бета к BTC за 180 дней", "beta180", ">", 0.9, 0, 3, "", 2), c("Возраст монеты", "age", ">", 540, 0, 1500, " дн.")]),
        ("Удержание после капитуляции", "только взнос, на страхе не продавать", "hold", "Недавно была капитуляция (страх ниже 15), а биткоин дешевле средней цены покупки всех держателей (MVRV < 1) — купленное на дне не отдаём на страхе по той же цене. Не для мемов и совсем новых монет.",
         [c("Дней с последнего страха < 15", "h2fd15", "<", 60, 0, 120, " дн."), c("MVRV биткоина", "mvrv", "<", 1, 0.5, 3, "", 2), c("Возраст монеты", "age", ">", 180, 0, 1500, " дн."),
          c("Мем (1 — да)", "meme", "<", 0.5, 0, 1, "", 1), c("Биткоин за 30 дней", "btcr30", "<", 20, -40, 60, "%")]),
    ]
    # order — место карточки в списке «Рынок сейчас» (порядок проверки правил): удержание проверяется сразу после охраны, до продаж на страхе
    return [{"title": t, "what": w, "kind": kd, "why": y, "conds": cs, "order": 4.5 if t == "Удержание после капитуляции" else n} for n, (t, w, kd, y, cs) in enumerate(rows)]


def edge(c, l, plan, wick=None, lag=0, fee=0.001):
    """Доход к DCA, % за всю историю, как в быстром стенде (panicx_sim.edge): взнос 1/день, решение дня t исполняется по закрытию t+1+lag;
    wick — лимитки на фитиль (раз в every дней по номеру дня t % every == 0, размер — доля резерва при выставлении, каждый уровень раз за окно)."""
    t, c, l = wick["t"] if wick else None, list(c), list(l) if l is not None else None
    cash = units = du = 0.0; n = len(c); jj0 = None; amt = []; done = []; ref = 0.0
    for i in range(n):
        p = c[i]
        if not p or p <= 0 or p != p: continue
        j = i - 1 - lag; du += (1 - fee) / p
        a = plan[j] if j >= 0 else 1.0
        before = cash; cash += 1.0
        if a < 0:
            x = -a * units * p; units -= x / p; cash += x * (1 - fee)
        elif a > 0:
            want = a if a < 1 else 1.0 + (a - 1) * before; x = min(cash, want); units += x * (1 - fee) / p; cash -= x
        if wick and j > wick["age"] and l is not None:
            ev = wick["every"]; jj = j - (int(t[j]) % ev)
            if jj != jj0:
                jj0 = jj; ref = c[max(0, jj)]; amt = [fr * before for _, fr in wick["lv"]]; done = [False] * len(amt)
            for q, (k, _) in enumerate(wick["lv"]):
                lim = ref * (1 - k)
                if done[q] or not (l[i] <= lim) or cash <= 0: continue
                x = min(cash, amt[q])
                if x > 0: units += x * (1 - fee) / lim; cash -= x; done[q] = True
    return ((units * c[-1] + cash) / (du * c[-1]) - 1) * 100
