"""Проверка панели «Рынок сейчас» стратегии combo4: карточка правила должна показывать то же, что проверяет само правило.

1. По составу: у каждого семейства в карточке есть все условия, общие для его правил (found/combo4-best.json), —
   тот же индикатор, то же сравнение, тот же порог, и нет чужих. Пропущенное или перевёрнутое условие делает карточку «выполненной»,
   когда правило не сработало.
2. По истории (последние N дней, все монеты приложения): в день, когда правило сработало, все условия его карточки
   выполнены; а если у карточки выполнены все условия, то в этот день что-то сработало (это правило или более раннее).

Запуск: python3 app/check_state.py [дней, по умолчанию 400]. Код выхода 1, если есть расхождения.
"""
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import app_combo4 as C4  # noqa: E402
import build_app_artifact as BA  # noqa: E402

# «Тихая вершина» в правилах — один индикатор qt, в карточке он раскрыт своим определением
SAME = {("qt", ">", 0.5): [("btcath", "<", 10), ("oth90", ">", 1.5)]}
PANIC = C4.FAM.index("Паника в стейблах")


def cards():
    """Для каждой карточки — список (индикатор, сравнение, порог); индикатор "" — строка не из правила (разворот USDT)."""
    keys = []

    def ind(k, i):
        if i == 0:
            keys.append(k)
        return None
    rows, out, n = C4.state(ind, 0, {"upk": np.array([np.nan])}), [], 0
    for r in rows:
        out.append([(keys[n + j], c["op"], c["target"]) for j, c in enumerate(r["conds"])])
        n += len(r["conds"])
    return out


def by_content(cs):
    bad = []
    for f, name in enumerate(C4.FAM):
        rules = [r for r in C4.S4["rules"] if C4.fam(r) == f]
        if not rules:
            bad.append(f"«{name}»: в стратегии нет правил этого семейства"); continue
        # условия, общие для всех правил семейства: без них не срабатывает ни одно (остальные меняют только размер сделки)
        sets = [{(q["ind"], q["op"], q["v"]) for q in r["conds"]} for r in rules]
        need = [w for q in sorted(set.intersection(*sets)) for w in SAME.get(q, [q])]
        for w in need:
            if w not in cs[f]:
                bad.append(f"«{name}»: в карточке нет условия {w[0]} {w[1]} {w[2]}")
        for k, op, v in cs[f]:
            if k and (k, op, v) not in need:
                bad.append(f"«{name}»: в карточке лишнее условие {k} {op} {v}")
    return bad


def by_history(cs, days):
    R = C4.compute([(s, kind) for s, _, kind in BA.COINS])
    bad, seen = [], 0
    for sym, r in R.items():
        B, k, cache = r["B"], r["k"], {}

        def ind(name, i):
            if not name or i is None or i < 0:
                return None
            if name not in cache:
                cache[name] = B.series(name)
            v = cache[name][i, k]
            return None if not np.isfinite(v) else float(v)
        ok = np.where(np.isfinite(B.C[:, k]))[0]
        for i in range(max(int(ok[0]), int(ok[-1]) - days + 1), int(ok[-1]) + 1):
            st, fired, d = C4.state(ind, i, r), int(r["fam"][i]), int(r["defer"][i])
            met = [all(c["ok"] for c, key in zip(row["conds"], cs[f]) if key[0]) for f, row in enumerate(st)]
            day = str(r["idx"][i].date()); seen += 1
            if fired >= 0 and not met[fired] and not (fired == PANIC and d == 2):   # день выдачи отложенного — не условия паники
                bad.append(f"{sym} {day}: сработало «{C4.FAM[fired]}», а в карточке выполнено не всё")
            if fired < 0 and d == 0:
                for f, m in enumerate(met):
                    if m:
                        bad.append(f"{sym} {day}: в карточке «{C4.FAM[f]}» всё выполнено, а не сработало ничего")
    return bad, seen


if __name__ == "__main__":
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 400
    cs = cards()
    a = by_content(cs)
    print("Состав карточек:", "совпадает с правилами" if not a else f"{len(a)} расхождений")
    for x in a:
        print("  ", x)
    b, seen = by_history(cs, n)
    print(f"История ({seen} монето-дней):", "расхождений нет" if not b else f"{len(b)} расхождений")
    kinds = {}
    for x in b:
        kinds.setdefault(x.split(": ", 1)[1], []).append(x.split(": ", 1)[0])
    for what, where in sorted(kinds.items(), key=lambda t: -len(t[1])):
        print(f"   {len(where)} × {what} — например {where[0]}, {where[-1]}")
    sys.exit(1 if a or b else 0)
