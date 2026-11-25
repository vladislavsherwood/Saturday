"""Круг 1 mcx: «активность и точность» одинаковыми метриками — combo7 на крипте (BTC, ETH, выборка отбора) и mb1 на металлах. Запуск: python3 app/mcx_r1.py
(сделки combo7 выгружает node app/mcx_c7.js → scratchpad/mcx/c7_trades.json)."""
import json
import os

import numpy as np

import mcx_lib as C


def main():
    C.tee("r1.txt")
    D, DD, MM, base = C.load()
    # проверка: счёт sim2 без слоя = дневной счёт mb1
    for k in C.ALL5:
        X = MM[k]
        sg = C.segs(X)["A"]
        e1 = X.run(base[k], sg)[0]
        e2 = C.run(X, base, C.NULL, sg)[0]
        assert abs(e1 - e2) < 1e-6, (k, e1, e2)
    print("sim2 без слоя = mb1 (проверено на 2005–15)\n")
    T = json.load(open(os.path.join(C.LOGDIR, "c7_trades.json")))
    rows = {}
    print("=== КРИПТА: combo7 (вся история монеты, сдвиг 0; покупки = резерв сверх взноса, включая фитили) ===")
    for nm, r in T.items():
        b = np.array(r["buy"]) + np.array(r["wick"])
        o = C.activity(np.array(r["d"], "datetime64[D]"), r["c"], b, r["sell"], 0, len(r["c"]))
        rows[nm] = o
        if nm in ("BTC", "ETH"):
            print(f"{nm} ({r['d'][0]}…{r['d'][-1]}, к DCA {r['edge']:+.0f}%): {C.afmt(o)}")
            print(f"   доньи: {o['low_dates']}\n   вершины: {o['high_dates']}")
    keys = [k for k in rows if k not in ("BTC", "ETH")]
    print(f"\nВыборка отбора ({len(keys)} монет), медиана:")
    med = {key: float(np.nanmedian([rows[k].get(key, np.nan) for k in keys])) for key, _, _ in C.ACOLS}
    med.update(lows=sum(rows[k]["lows"] for k in keys), lows_caught=sum(rows[k]["lows_caught"] for k in keys),
               highs=sum(rows[k]["highs"] for k in keys), highs_caught=sum(rows[k]["highs_caught"] for k in keys))
    print("  " + C.afmt(med))
    out = {"crypto": {k: {kk: v for kk, v in o.items() if kk not in ("low_dates", "high_dates")} for k, o in rows.items()}, "crypto_med": med, "metals": {}}
    for per, (a0d, a1d) in (("2005–2025", (C.A0, C.CUT)), ("2000-09…2026-11", ("2000-01-01", "2027-01-01"))):
        print(f"\n=== МЕТАЛЛЫ: mb1, {per} (старт с нуля) ===")
        for k in C.ALL5:
            o, r = C.layer_activity(C.NULL, k, a0d, a1d)
            out["metals"][f"{k}|{per}"] = {kk: v for kk, v in o.items() if kk not in ("low_dates", "high_dates")}
            print(f"{C.NAME[k]} (к DCA {o['edge']:+.0f}%): {C.afmt(o)}")
            print(f"   доньи: {o['low_dates']}\n   вершины: {o['high_dates']}")
    # доля резерва в капитале (среднее по дням) — «сколько денег вообще может работать»
    print("\nДоля резерва в капитале (2005–2025), среднее / медиана / доля дней с резервом > 10%:")
    for k in C.ALL5:
        X = MM[k]
        a0, a1 = C.ix(X.t, C.A0), C.ix(X.t, C.CUT)
        r = C.run(X, base, C.NULL, (a0, a1))
        cap = r[7] * X.c + r[6] + r[5]
        sh = (r[6] / np.maximum(cap, 1e-9))[a0:a1]
        print(f"  {C.NAME[k]}: {sh.mean() * 100:.0f}% / {np.median(sh) * 100:.0f}% / {(sh > 0.1).mean() * 100:.0f}%")
    json.dump(out, open(os.path.join(C.LOGDIR, "r1.json"), "w"), ensure_ascii=False, indent=1, default=float)


if __name__ == "__main__":
    main()
