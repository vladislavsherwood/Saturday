"""Агент 2, круг 2: схема маржи для новой основы (K3 + отложенная) и «почему K1 с плечом лучше K3».
Модель уточнена (agent2_margin.sim2): отрицательный общий остаток стейблов — это долг (проценты 11% годовых и учёт при ликвидации),
выручка шорта лежит отдельно и не увеличивает покупки резерва (иначе шорт незаметно работает как плечо).
H2a: K1 выигрывает под плечом за счёт неподтверждённой паники: в схеме плеча паника покупается долями ×2 (50/100/100%) с плечом ×1,25 —
у K3 неподтверждённая паника остаётся 10% без плеча. Проверка: размер и плечо неподтверждённой паники в схеме плеча.
H2b: отложенная покупка под плечом — размер и плечо (×2 в круге 0 давало 18 ликвидаций при −30%).
Сетка: дно 25/50%, паника ×1/1,5/2, неподтверждённая 10/25/50%/как подтверждённая, разворот 50/75/100%, отложенная 25/50/100%;
плечо дно ×1,5/2/2,5, паника ×1/1,25/1,5, неподтверждённая ×1/1,25, разворот ×1,5/2/2,5, отложенная ×1/1,5/2.
Условие: 0 ликвидаций на 105 стартах и при минимумах −20% и −30%. Запуск: python3 app/agent2_loop2.py <out.json>"""
import sys, os, json, itertools, time
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent2_margin import MAIN, grouped, sized, plan_of, port2, fmt2, short_mask, safe, CC, idx
from agent_margin import indicators, COINS
import data


def su_sized(S, su):
    """Размер неподтверждённой паники (группа 5): число — доля резерва; 'K1' — как подтверждённая (те же доли, группа 2 → плечо паники)."""
    S = json.loads(json.dumps(S))
    conf = {json.dumps([c for c in r["conds"] if c["ind"] != "oidd30"]): r["act"] for r in S["rules"] if r["grp"] == 2}
    for r in S["rules"]:
        if r["grp"] == 5:
            if su == "K1":
                r["act"] = conf[json.dumps(r["conds"])]; r["grp"] = 7          # группа 7 — неподтверждённая с размером подтверждённой
            else:
                r["act"] = 1 + su
    return S


if __name__ == "__main__":
    out = sys.argv[1]
    # --- событийный разбор: подтверждённая и неподтверждённая паника, доход за 90/180 дней (по монетам портфеля) ---
    print("Паника в стейблах (usdt > 1,07 и othd < 25): доход монеты через 90/180 дней, медиана по дням; подтверждена — OI < −8% от 30-дн. максимума")
    for k, (sym, kind, t) in enumerate(COINS):
        close = data.history(sym)[0]; close = close[~close.index.duplicated()]
        I = indicators(close, kind)
        p = ((I["usdt"] > 1.07) & (I["othd"] < 25)).fillna(False)
        conf = p & (I["oidd30"] < -8).fillna(False)
        f90 = close.shift(-90) / close - 1; f180 = close.shift(-180) / close - 1
        row = []
        for nm, m in (("подтв.", conf), ("неподтв.", p & ~conf)):
            m = m & (close.index >= "2020-09-01")
            row.append(f"{nm} дней {int(m.sum()):4d}: 90д {np.nanmedian(f90[m]) * 100:+5.0f}%, 180д {np.nanmedian(f180[m]) * 100:+5.0f}%")
        print(f"  {t:5s} " + " | ".join(row))
    # --- сетка ---
    t0 = time.time(); rows = []
    W = short_mask()
    for sb, sp, su, sr, sd in itertools.product((0.25, 0.5), (1.0, 1.5, 2.0), (0.1, 0.25, 0.5, "K1"), (0.5, 0.75, 1.0), (0.25, 0.5, 1.0)):
        S = su_sized(sized(MAIN, sb, sp, sr, sd), su); A, G, _ = plan_of(S)
        for lb, lp, lu, lr, ld in itertools.product((1.5, 2, 2.5), (1, 1.25, 1.5), (1, 1.25), (1.5, 2, 2.5), (1, 1.5, 2)):
            if su != "K1" and lu != 1:
                continue
            lev = (1, lb, lp, lr, 1, lu, ld, lp if su == "K1" else 1)         # группа 7 (неподтверждённая как K1) — с плечом паники
            if su == "K1" and lu != 1:
                lev = (1, lb, lp, lr, 1, 1, ld, lu)
            o = port2(A, G, lev, stress=False, sep=True)
            o["cfg"] = [sb, sp, su, sr, sd, lb, lp, lu, lr, ld]; rows.append(o)
    print(f"\nсхем {len(rows)}, {time.time() - t0:.0f} с", flush=True)
    rows.sort(key=lambda o: -o["med"]); nsafe = 0
    for o in rows:
        if o["liq"] == 0 and nsafe < 400:
            sb, sp, su, sr, sd, lb, lp, lu, lr, ld = o["cfg"]
            S = su_sized(sized(MAIN, sb, sp, sr, sd), su); A, G, _ = plan_of(S)
            lev = (1, lb, lp, lr, 1, 1, ld, lu) if su == "K1" else (1, lb, lp, lr, 1, 1, ld, 1)
            o2 = port2(A, G, lev, sep=True); o.update(l20=o2["l20"], l30=o2["l30"])
            if safe(o):
                nsafe += 1
    print(f"проверено в стрессе, безопасных {nsafe}, {time.time() - t0:.0f} с", flush=True)
    json.dump(rows, open(out, "w"))
