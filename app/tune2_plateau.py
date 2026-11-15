"""tune2: разбор перебора — по каждому параметру плато (подряд идущие значения со строгой ✔ во всём и в сегментах и доходом в сегментах ≥ 0),
лучшие значения, у которых оба соседа тоже ✔ и доход не ниже основы. Запуск: python3 app/tune2_plateau.py <json перебора> [P0-параметры]"""
import json, sys
R = json.load(open(sys.argv[1]))
P0 = dict(u=1.07, w=200, o=25, fs=40, fw=52, ud=7.6, oi=8, us=1.2, m=1.5, a1=25, a2=50, a3=50, b1=10, b2=10, b3=10, b=10)
for k, rows in R.items():
    cur = P0.get(k)
    ok = [r["ok"] for r in rows]
    # плато, содержащее текущее значение
    i0 = min(range(len(rows)), key=lambda i: abs(rows[i]["v"] - cur)) if cur is not None else 0
    lo = hi = i0
    while lo > 0 and ok[lo - 1]: lo -= 1
    while hi < len(rows) - 1 and ok[hi + 1]: hi += 1
    pl = f"{rows[lo]['v']}…{rows[hi]['v']}" if ok[i0] else "нет (текущее не ✔?)"
    # кандидаты: ✔, доход > +0.005, оба соседа ✔ и доход ≥ 0
    cand = []
    for i, r in enumerate(rows):
        if not r["ok"] or r["d"]["all"] <= 0.005: continue
        nb = [rows[j] for j in (i - 1, i + 1) if 0 <= j < len(rows)]
        if all(x["ok"] and x["d"]["all"] >= -1e-9 for x in nb):
            cand.append(f"{r['v']}({r['d']['all']:+.3f})")
    best = max(rows, key=lambda r: r["d"]["all"])
    print(f"{k:3s} сейчас {cur}: плато ✔ {pl}; всего ✔ {sum(ok)}/{len(ok)}; макс. доход {best['d']['all']:+.3f} при {best['v']} ({'✔' if best['ok'] else '·'}); "
          f"устойчивые лучше основы: {', '.join(cand) if cand else 'нет'}")
