"""Данные дня для раздела «Металлы» (стратегия mb1 = Q2д + пауза после обвала BTC) в JSON — для бота ShiftMate, как dca-snap у крипты.

Запуск: python3 app/build_metals_snap.py <куда.json> [--no-refresh]
  без --no-refresh месячные данные пересобираются из источников (World Bank Pink Sheet — цены металлов по месяцам; DBnomics/FRED — ставка ФРС,
  CPI, 10 лет, безработица, нефть, индекс доллара; Yahoo — дневные цены и BTC). Ключи не нужны. numba не обязателен (подставляется заглушка).
Обновлять: месячный план — после выхода данных за месяц (World Bank публикует в первые рабочие дни следующего месяца, макро — до середины месяца);
пересборку можно запускать раз в день — план меняется только с новым месяцем, а дневные цены, уровни и пауза BTC — каждый день.

Формат: {"as_of": день дневных цен, "decision_month": месяц решения (YYYY-MM), "execution": {...}, "btc_pause": {...},
 "metals": {ключ: {name, plan, action, f, cooldown_months_left, bottom: {count, need, of, markers: [...]}, top: {count, of, sell_at},
                    price_month, unit_month, price_last, unit_last, price_marker_level, price_marker_level_last, from_ath_pct}}}"""
import json
import os
import sys
import time
import types

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
try:
    import numba  # noqa: F401
except ImportError:   # сервер без numba: заглушка njit — те же вычисления, медленнее
    nb = types.ModuleType("numba")
    nb.njit = lambda *a, **k: (a[0] if a and callable(a[0]) and not k else (lambda f: f))
    sys.modules["numba"] = nb
import numpy as np  # noqa: E402

KEYS = ["gold", "silver", "platinum", "palladium", "copper", "aluminum", "nickel", "lead", "zinc", "tin"]
DAILY = {"gold": ("GC=F", "$/oz"), "silver": ("SI=F", "$/oz"), "platinum": ("PL=F", "$/oz"), "palladium": ("PA=F", "$/oz"),
         "copper": ("HG=F", "$/lb"), "aluminum": ("ALI=F", "$/t")}
UNIT_MONTH = {"gold": "$/oz", "silver": "$/oz", "platinum": "$/oz", "palladium": "$/oz"}   # остальные (World Bank) — $/t
LB_PER_T = 2204.62
EXEC = {
    "note": "план решается раз в месяц по данным закончившегося месяца и исполняется равными долями весь следующий месяц",
    "weekly": "раз в неделю (первый торговый день недели): купить накопленные за неделю взносы; в серии — ещё доля резерва 1 − 0,5^(1/nw), "
              "nw — число недель исполнения в месяце (за месяц уходит 50% резерва); продажа f — доля позиции 1 − (1 − f)^(1/nw); "
              "«копить» — взносы недели в резерв",
    "daily": "каждый день: взнос; в серии — доля резерва 1 − 0,5^(1/nd), nd — торговых дней в месяце; продажа — 1 − (1 − f)^(1/nd)",
    "weekly_vs_daily_check": "app/mt_weekly.py, 2005–2026, к итогу дневного исполнения: золото −1,0%, серебро −1,1%, платина −1,0%, медь +0,9%, "
                             "палладий +6,2%, алюминий −0,3% — недельное исполнение практически не хуже",
    "reserve": "резерв — в 3-месячных векселях / доходном долларе; маржа (по желанию): заём 0,5× суммы докупки только при ставке ФРС < 3%",
    "btc_pause": "в серии докупка резерва откладывается, если за 90 дней был день, когда BTC за 30 дней упал на ≥ 25%; доля копится "
                 "и тратится в первый день серии после окна; обычный взнос не откладывается",
}


def main(out, refresh=True):
    t0 = time.time()
    import pandas as pd
    import data
    import macro
    import metals_agent2_lib as A
    import metals_agent_lib as L
    import mt4_lib as M
    D = A.load(fresh=refresh)
    plan_fn = M.VERS["Q2"]
    thr = D["_thr3"]
    res = {}
    for k in KEYS:
        if k not in D:
            continue
        d = D[k]; p = plan_fn(d); F = d["F"]; last = float(p[-1])
        rows = []
        for f, dr in d["bot"]:
            v = float(F[f].values[-1]); t = thr[(f, dr)]
            rows.append({"marker": f, "value": round(v, 4), "threshold": round(t, 4), "dir": ">" if dr == "hi" else "<",
                         "on": bool((v > t) if dr == "hi" else (v < t))})
        since = L.since(p <= -0.2 + 1e-9)[-1]
        cool = max(0, 24 - int(since)) if since < 10 ** 5 else 0
        plan = "series" if last > 1 else "sell" if last < 0 else "accumulate" if last == 0 else "contribute"
        act = {"series": "серия докупок: взнос + 50% резерва за месяц", "sell": f"продать {-last:.0%} позиции за месяц",
               "accumulate": "копить взносы в резерв (остывание после продажи)", "contribute": "обычный взнос"}[plan]
        p3 = float(F[A.P3].values[-1]); cm = float(d["c"][-1])
        lvl = cm / p3 * thr[(A.P3, "lo")]
        nt = len(d["top"])
        r = {"name": d.get("name", k), "plan": plan, "action": act, "f": round(-last, 4) if last < 0 else 0.0, "cooldown_months_left": cool,
             "bottom": {"count": int(d["bn3"][-1]), "need": 5, "hold": 4, "of": len(d["bot"]), "markers": rows},
             "top": {"count": int(d["tn3"][-1]), "of": nt, "sell_15_at": nt - 2, "sell_50_at": nt - 1},
             "price_month": round(cm, 4), "unit_month": UNIT_MONTH.get(k, "$/t"), "price_marker_level": round(lvl, 4)}
        if k in DAILY:
            sym, unit = DAILY[k]
            try:
                h = macro.long_history(sym)["c"].dropna()
                pl = float(h.iloc[-1])
                conv = (1 / LB_PER_T) if (unit == "$/lb" and r["unit_month"] == "$/t") else 1.0
                r.update({"price_last": round(pl, 4), "unit_last": unit, "price_last_day": str(h.index[-1])[:10],
                          "price_marker_level_last": round(lvl * conv, 4), "from_ath_pct": round((pl / float(h.max()) - 1) * 100, 1)})
            except Exception as e:  # noqa: BLE001
                r["price_last_error"] = str(e)[:200]
        res[k] = r
    btc = data.history("BTC-USD")[0].dropna()
    r30 = btc / btc.shift(1, freq="30D").reindex(btc.index, method="ffill") - 1
    ev = r30[r30 <= -0.25]
    last_ev = ev.index[-1] if len(ev) else None
    until = (last_ev + pd.Timedelta(days=90)) if last_ev is not None else None
    as_of = str(btc.index[-1])[:10]
    pause = {"btc_r30_pct": round(float(r30.iloc[-1]) * 100, 1), "last_stress_day": str(last_ev)[:10] if last_ev is not None else None,
             "active": bool(until is not None and pd.Timestamp(as_of) <= until), "until": str(until)[:10] if until is not None else None}
    snap = {"as_of": as_of, "decision_month": str(D["gold"]["t"][-1])[:7], "strategy": "mb1 (Q2д + пауза после обвала BTC)",
            "execution": EXEC, "btc_pause": pause, "metals": res}
    tmp = out + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(snap, f, ensure_ascii=False, indent=1)
    os.replace(tmp, out)
    print(out, round(os.path.getsize(out) / 1024), "КБ; решение по", snap["decision_month"], "; цены по", as_of, f"[{time.time() - t0:.0f} с]")


if __name__ == "__main__":
    main(sys.argv[1], "--no-refresh" not in sys.argv)
