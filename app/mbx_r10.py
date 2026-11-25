"""Круг 10 mbx: «что сейчас» по mb1 и по опции О2; уровни цен. Сохраняет scratchpad/mbx/r10.json. Запуск: python3 app/mbx_r10.py"""
import json
import os

import numpy as np

import mbx_lib as X
import metals_agent2_lib as A
import metals_agent_lib as L
from mbx_r7 import hot

KEYS = ["gold", "silver", "platinum", "palladium", "copper"]
LB = 2204.62


def main():
    X.tee("r10.txt")
    D, DD, MM = X.load()
    thr = D["_thr3"]
    out = {}
    for k in KEYS:
        d = D[k]
        t, c = d["t"], d["c"]
        p = X.Q2M(d)
        since, sp = X.sale_info(p, c)
        cool_left = max(0, 24 - int(since[-1])) if since[-1] < 10 ** 5 else 0
        plan = "серия" if p[-1] > 1 else "продажа" if p[-1] < 0 else "копить (остывание)" if p[-1] == 0 else "обычный взнос"
        f = X.pfeat(d)
        mx36 = X.rolling_max(c, 36)[-1]
        ath = np.maximum.accumulate(c)[-1]
        j = len(c) - 36 + int(np.argmax(c[-36:]))
        base = c[max(0, j - 60): j + 1].min()
        lv_retr = mx36 - 0.62 * (mx36 - base)
        lv_ath = 0.5 * ath
        p3 = float(A.feat(d, A.P3)[-1])
        lv_p3 = c[-1] / p3 * thr[(A.P3, "lo")]
        h = hot(d)
        last_hot = str(t[np.where(h)[0][-1]])[:7] if h.any() else None
        hot_block = int(L.since(h)[-1]) <= 60
        blk_until = None
        if hot_block:
            i = np.where(h)[0][-1]
            yy, mm = t[i].year, t[i].month + 61
            blk_until = f"{yy + (mm - 1) // 12}-{(mm - 1) % 12 + 1:02d}"
        o2 = (f["ddath"][-1] <= -0.5) and not hot_block and p[-1] in (0.0, 1.0)
        o2_plan = ("малая серия: взнос + 10% резерва в месяц" if (o2 and p[-1] == 1.0) else
                   "копить (остывание; малая серия в остывание не действует)" if p[-1] == 0.0 else
                   "обычный взнос" if p[-1] == 1.0 else plan)
        if hot_block and p[-1] == 1.0:
            o2_plan = "обычный взнос (опция заблокирована перегревом)"
        daily = None
        if k in MM:
            Xk = MM[k]
            daily = {"price": round(float(Xk.c[-1]), 2), "day": str(Xk.t[-1])[:10], "from_ath_daily_pct": round(float(Xk.c[-1] / Xk.c.max() - 1) * 100, 1)}
        unit = "$/oz" if k != "copper" else "$/т (World Bank)"
        r = {"plan_mb1": plan, "bottom_markers": int(d["bn3"][-1]), "need": 5, "cooldown_left_months": cool_left, "month": str(t[-1])[:7],
             "price_month": round(float(c[-1]), 2), "unit": unit, "price_marker_level_mb1": round(float(lv_p3), 1),
             "dd36_pct": round(float(f["dd36"][-1]) * 100, 1), "from_ath_month_pct": round(float(f["ddath"][-1]) * 100, 1), "retr": round(float(f["retr"][-1]), 2),
             "level_O2_half_ath": round(float(lv_ath), 1), "level_O1_retr62": round(float(lv_retr), 1), "last_overheat": last_hot,
             "O2_blocked_until": blk_until, "plan_O2": o2_plan, "daily": daily}
        out[k] = r
        print(f"{X.NAME[k]:8s}: mb1 — {plan}{f' (ещё {cool_left} мес.)' if cool_left and p[-1] == 0 else ''}; маркеров дна {r['bottom_markers']}/8 (нужно 5); "
              f"месячная средняя {t[-1].strftime('%Y-%m')} {c[-1]:.1f}, от рекорда (мес.) {r['from_ath_month_pct']:+.0f}%, откат {r['retr']:.2f}; "
              f"ценовой маркер mb1 (1 из 8) при средней ≤ {lv_p3:.0f}; О2: «≤ 50% рекорда» ≤ {lv_ath:.0f}, перегрев {last_hot or '—'}"
              f"{f', блок до {blk_until}' if blk_until else ''} → {o2_plan}" + (f"; дневная {daily['price']} ({daily['day']}, от дневного рекорда {daily['from_ath_daily_pct']:+.0f}%)" if daily else ""))
    json.dump(out, open(os.path.join(X.LOGDIR, "r10.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
