"""Круг 0 (база, маржа): B без плеча и с лучшей схемой плеча из lev_size.py, портфель 9 монет, 105 дат старта.
Запуск: python3 app/agent_loop0.py"""
import json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from agent_margin import plan_of, portfolio, fmt

B = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "main-crypto.json")))


def lev_sizes(S, sb=0.25, sp=1.5, sr=0.5):
    """Размеры лучшей схемы плеча: дно sb резерва, паника — доли × sp, разворот sr резерва (по группам правил)."""
    from agent_margin import plan_of as _p
    S = json.loads(json.dumps(S))
    bgrp = [1, 1, 2, 2, 0, 3, 2, 4, 4, 3, 4, 4]
    for i, r in enumerate(S["rules"]):
        g = r.get("grp", bgrp[i] if i < len(bgrp) and r["conds"] == B["rules"][i]["conds"] else None)
        if g == 1: r["act"] = 1 + sb
        if g == 2: r["act"] = 1 + min(1.0, (r["act"] - 1) * sp)
        if g == 3: r["act"] = 1 + sr
    return S


if __name__ == "__main__":
    A, G, _ = plan_of(B)
    print("B без плеча:          ", fmt(portfolio(A, G)))
    A2, G2, _ = plan_of(lev_sizes(B))
    print("B, размеры схемы, без плеча:", fmt(portfolio(A2, G2)))
    print("B, лучшая схема плеча (дно ×2, паника ×1,25, разворот ×2):", fmt(portfolio(A2, G2, (1, 2, 1.25, 2, 1))))
