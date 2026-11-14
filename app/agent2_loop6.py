"""Агент 2, круг 6: плечо и шорт BTC для кандидата круга 5 (широкая тихая вершина) против основы, уточнённая модель.
H6a: широкая тихая вершина добавляет доход и под плечом (продажи у вершины снижают долг перед падением).
H6b: шорт BTC — размер 5/10/15/20% счёта, вход: жадность > 75 / > 80 / широкая тихая вершина и жадность > 70 / перегретый фандинг у максимума;
выход: сигнал дна или разворот BTC / только сигнал дна / страх. Условие: 0 ликвидаций, в том числе при минимумах −20/−30% и максимумах +20/+30%.
Запуск: python3 app/agent2_loop6.py <кандидаты.json> <out.json>"""
import sys, os, json, itertools, time
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent2_margin import MAIN, grouped, sized, plan_of, port2, fmt2, mask, short_state, stress_ok, safe, c, BOT
from agent2_loop2 import su_sized

ENTRY = {"жадность > 75": [[c("fng", ">", 75)]], "жадность > 80": [[c("fng", ">", 80)]],
         "широкая тихая вершина и жадность > 70": [[c("btcath", "<", 15), c("oth90", ">", 1), c("fng", ">", 70)]],
         "BTC у максимума и фандинг 30д > 2%": [[c("btcath", "<", 10), c("fund30", ">", 2)]]}
EXIT = {"дно или разворот BTC": BOT + [[c("btcr30", ">", 20)]], "только дно": BOT, "страх или дно": [[c("fng", "<", 52), c("usdtd", "<", 7.6)]] + BOT}

if __name__ == "__main__":
    CANDS = json.load(open(sys.argv[1])); out = {}; t0 = time.time()
    for name in list(CANDS)[:2]:
        S0 = CANDS[name]; res = {"grid": []}
        A0, G0, _ = plan_of(grouped(S0)); res["nolev"] = port2(A0, G0)
        print(f"\n=== {name}\n  без плеча: {fmt2(res['nolev'])}", flush=True)
        for sb, sp, su, sr in itertools.product((0.25, 0.5), (1.5, 2.0), (0.1, "K1"), (0.5, 0.75, 1.0)):
            A, G, _ = plan_of(su_sized(sized(S0, sb, sp, sr, 0.5), su))
            for lb, lp, lu, lr in itertools.product((1.5, 2, 2.5), (1, 1.25, 1.5), (1, 1.25), (1.5, 2, 2.5)):
                if su != "K1" and lu != 1:
                    continue
                lev = (1, lb, lp, lr, 1, 1, 1, lu)
                o = port2(A, G, lev, stress=False, sep=True)
                if o["liq"] == 0:
                    ok = stress_ok(A, G, lev); o.update(l20=0 if ok else 1, l30=0 if ok else 1)
                o["cfg"] = [sb, sp, su, sr, lb, lp, lu, lr]; res["grid"].append(o)
        safe_rows = sorted([o for o in res["grid"] if safe(o)], key=lambda o: -o["med"])
        print(f"  схем {len(res['grid'])}, безопасных {len(safe_rows)} ({time.time() - t0:.0f} с)", flush=True)
        for o in safe_rows[:5]:
            print(f"  {fmt2(o)} | {o['cfg']}", flush=True)
        # схема круга 2 (дно 25% ×2, паника 50/100/100% ×1,25 — любая, разворот 50% ×2, отложенная 50% ×1)
        A, G, _ = plan_of(su_sized(sized(S0, 0.25, 2.0, 0.5, 0.5), "K1")); LEV = (1, 2, 1.25, 2, 1, 1, 1, 1.25)
        res["r2"] = port2(A, G, LEV, sep=True); print(f"  схема круга 2: {fmt2(res['r2'])}", flush=True)
        # шорты BTC поверх без плеча и поверх схемы круга 2
        res["short"] = []
        for en, ex in itertools.product(ENTRY, EXIT):
            W = short_state(mask(ENTRY[en]), mask(EXIT[ex]))
            for sz in (0.05, 0.10, 0.15, 0.20):
                for base, (AA, GG, lev) in (("без плеча", (A0, G0, (1,) * 8)), ("с плечом", (A, G, LEV))):
                    o = port2(AA, GG, lev, W=W, sh=sz, sep=True, stress=False)
                    if o["liq"] == 0:
                        ok = stress_ok(AA, GG, lev, W=W, sh=sz); o.update(l20=0 if ok else 1, l30=0 if ok else 1)
                    o.update(tag=f"{base}: шорт BTC {int(sz * 100)}%, вход «{en}», выход «{ex}»", base=base, d=o["med"] - (res["nolev"] if base == "без плеча" else res["r2"])["med"])
                    res["short"].append(o)
        for base in ("без плеча", "с плечом"):
            r = sorted([o for o in res["short"] if o["base"] == base and safe(o)], key=lambda o: -o["med"])
            print(f"  шорты {base}: безопасных {len(r)} из {sum(o['base'] == base for o in res['short'])}", flush=True)
            for o in r[:6]:
                print(f"    {o['d']:+5.0f} п.п. | {fmt2(o)} | {o['tag']}", flush=True)
        out[name] = res
    json.dump(out, open(sys.argv[2], "w"))
