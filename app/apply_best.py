"""Превращает результат optimize.js в настройки конструктора (best_<страница>.json).

Запуск: python3 app/apply_best.py <результат optimize.js> <страница: crypto | gold>
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))


def main(path, page):
    res = json.load(open(path))["res"]
    full = max((r for r in res if r["mode"] == "full"), key=lambda r: r["score"]["score"])
    rules = []
    for n, r in enumerate(full["best"]["rules"], 1):
        conds = r["conds"] + [None, None]
        rules.append({"id": n, "on": True, "a": conds[0], "b": conds[1], "c": conds[2], "act": r["act"]})
    state = {"mode": "w", "base": full["best"]["base"], "pbase": 1, "period": "all", "unit": 10, "balance": 1000,
             "focus": 1, "rules": rules}
    json.dump(state, open(os.path.join(HERE, f"best_{page}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print("лучший на всей истории:", round(full["score"]["score"], 1), "%, правил", len(rules), "| по активам:", full["score"]["per"])
    for r in res:
        if r["mode"] == "train":
            print("поиск на первой половине:", round(r["score"]["score"], 1), "% → вторая половина", round(r["test"]["score"], 1),
                  "% | по активам на второй:", r["test"]["per"])


if __name__ == "__main__":
    main(*sys.argv[1:])
