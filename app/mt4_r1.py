"""Круг 1: R3 / R6 / Q2 в пузыре 2025–26 и сейчас (месячная модель, данные агента 2 по 2026-10 + неполный ноябрь 2026).
Запуск: python3 app/mt4_r1.py"""
import numpy as np

import mt4_lib as M

KEYS = ["gold", "silver", "platinum", "palladium", "copper", "aluminum"]
ALLK = ["gold", "silver", "platinum", "palladium", "copper", "aluminum", "nickel", "lead", "zinc", "tin"]


def act(x):
    if x > 1:
        return f"+{(x - 1) * 100:.0f}%рез"
    if x < 0:
        return f"−{-x * 100:.0f}%"
    if x == 0:
        return "копить"
    return "·"


def main():
    M.tee("r1.txt")
    D0 = M.mload()
    D = M.nov_extend(D0)
    print("Цены (месячные средние) и действия по решению месяца (исполнение — в следующем месяце):")
    res = {}
    for k in ALLK:
        d = D[k]
        c, t, n = d["c"], d["t"], len(d["c"])
        i24 = int(np.searchsorted(t.values, np.datetime64("2025-01-01")))
        pk = i24 + int(np.argmax(c[i24:]))
        mx = c[pk]
        res[k] = {}
        print(f"\n== {M.NAME[k]}: максимум 2025–26 (месячный) {mx:.1f} в {str(t[pk])[:7]}, последний месяц {str(t[-1])[:7]} {c[-1]:.1f} ({(c[-1] / mx - 1) * 100:+.0f}%)"
              f"; маркеров вершины {d['tn3'][-1]}/{d['nt']}, дна {d['bn3'][-1]}/{d['nb']} (на 2026-10)")
        i0 = int(np.searchsorted(t.values, np.datetime64("2024-06-01")))
        for nm, fn in M.VERS.items():
            p = M.mplan(d, fn)
            # продано в «верхней зоне» (цена исполнения ≥ 75% максимума)
            keep = 1.0
            for i in range(i24, n):
                if p[i - 1] < 0 and c[i] >= 0.75 * mx:
                    keep *= 1 + p[i - 1]
            sold = (1 - keep) * 100
            buys = [str(t[i])[:7] for i in range(n) if t[i] >= np.datetime64("2026-01-01") and p[i] > 1]
            U, C, DU = M.msim_state(c, p, 0, n, 0)
            e_full = ((U[-1] * c[-1] + C[-1]) / (DU[-1] * c[-1]) - 1) * 100
            res_share = C[-1] / (U[-1] * c[-1] + C[-1]) * 100
            a24 = int(np.searchsorted(t.values, np.datetime64("2024-01-01")))
            e24 = M.msim(c, p, a24, n)[0]
            e99 = M.msim(c, p, d["m"], n)[0]
            i25 = int(np.searchsorted(t.values, np.datetime64("2026-01-01")))
            e99_25 = M.msim(c, p, d["m"], i25)[0]
            e_full_25 = M.msim(c, p, 0, i25)[0]
            res[k][nm] = {"sold": sold, "buys": buys, "e24": e24, "res": res_share, "e99": e99, "e99_25": e99_25, "full": e_full, "full25": e_full_25}
            acts = " ".join(f"{str(t[i])[2:7]}:{act(p[i])}" for i in range(i0, n - (1 if d.get('nov') else 0)) if p[i] != 1.0)
            print(f"  {nm}: продано в зоне ≥75% макс. {sold:.0f}% позиции; докупки резерва (решения 2026): {buys or 'нет'}; резерв сейчас {res_share:.0f}% капитала"
                  f"\n      к DCA: старт 2024-01 → сейчас {e24:+.1f}%; 1999→2025-12 {e99_25:+.1f}% → 1999→сейчас {e99:+.1f}%; вся история до 2025-12 {e_full_25:+.0f}% → сейчас {e_full:+.0f}%"
                  f"\n      действия с 2024-06: {acts or 'только взносы'}")
    print("\nПРОВЕРКА КРИТЕРИЕВ:")
    h1a = all(res[k][v]["sold"] >= 30 for k in ("silver", "platinum") for v in M.VERS)
    print(f"  H1a (серебро и платина, каждая версия продала ≥ 30% в зоне ≥ 75% макс.): {'да' if h1a else 'нет'} — "
          + ", ".join(f"{M.NAME[k][:4]} {v} {res[k][v]['sold']:.0f}%" for k in ("gold", "silver", "platinum", "palladium", "copper") for v in M.VERS))
    five = ["gold", "silver", "platinum", "palladium", "copper"]
    nb = [(k, v) for k in five for v in M.VERS if any(b >= "2026-02" for b in res[k][v]["buys"]) or any(b == "2026-01" for b in res[k][v]["buys"])]
    print(f"  H1b (2026-02…2026-10 ни одной докупки резерва у 5 металлов): {'да' if not nb else 'нет: ' + str(nb)}")
    for v in M.VERS:
        ok = sum(res[k][v]["e24"] >= -0.5 for k in five)
        print(f"  H1c {v}: старт 2024-01 не хуже DCA на {ok}/5 — " + ", ".join(f"{M.NAME[k][:4]} {res[k][v]['e24']:+.1f}" for k in five))


if __name__ == "__main__":
    main()
