"""Агент 3, круг 0 (портфель): пересчёт W25 в портфеле 9 монет (agent2_margin.sim2): без плеча, + шорт BTC 10%, схема плеча круга 2 агента 2,
+ шорт BTC 10%; стресс минимумов −20/−30% и максимумов +20/+30%. Запуск: python3 app/agent3_loop0.py"""
import sys, os, json, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent2_margin import grouped, sized, plan_of, port2, fmt2, short_mask, HERE
from agent2_loop2 import su_sized

LEV = (1, 2, 1.25, 2, 1, 1, 1, 1.25)
W25 = json.load(open(os.path.join(HERE, "found", "agent2-best.json")))
if __name__ == "__main__":
    t0 = time.time(); W = short_mask()
    for tag, S, lev, sh in [("без плеча", grouped(W25), (1,) * 8, 0.0), ("без плеча + шорт 10%", grouped(W25), (1,) * 8, 0.10),
                            ("плечо", su_sized(sized(W25, 0.25, 2.0, 0.5, 0.5), "K1"), LEV, 0.0), ("плечо + шорт 10%", su_sized(sized(W25, 0.25, 2.0, 0.5, 0.5), "K1"), LEV, 0.10)]:
        A, G, _ = plan_of(S); o = port2(A, G, lev, W=W if sh else None, sh=sh, sep=True)
        print(f"W25 {tag}: {fmt2(o)}  [{time.time() - t0:.0f} с]", flush=True)
