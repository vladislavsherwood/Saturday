"""Объединение: портфель с маржой для вариантов по монетам (W25, F, F + C6, F + C1.25 (+ C6) …) на стенде агента 4D (agent4d_margin.Book/sim4:
сдвиг исполнения, ставки, наборы монет). Схема плеча агента 2 (дно 25% ×2, паника 50/100/100% ×1,25, разворот 50% ×2, отложенная 50% ×1),
защита A4 (агент 4A: паника без плеча, пока с максимума BTC < D дней, иначе плечо паники ×lp), шорт BTC (агент 4D: жадность > 75 до дна или разворота).
Индикаторы: up90/hi90/ago_qt (agent4b_loop9), rel90/rel180 (agent4c_loop7), btcdays (agent4a_loop7) — регистрируются в agent_margin.EXTRA при импорте.
Использование: from combo_margin import *; B = Book(P9); r = evalp(B, S0, D=60, lp=1.5, sh=0.2)"""
import sys, os, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import agent4b_loop9  # noqa: F401  up90, hi90, ago_qt
import agent4c_loop7  # noqa: F401  rel90, rel180
from agent4a_loop7 import base_scheme, split  # noqa: F401  btcdays
from agent4d_margin import Book, P9, PB, BOT, c, safe, IDX, STARTS, HERE, shift  # noqa: F401
from agent2_margin import grouped

PM = [("BTC-USD", "btc"), ("DOGE-USD", "alt"), ("SHIB-USD", "alt"), ("PEPE24478-USD", "alt"), ("WIF-USD", "alt"), ("BONK-USD", "alt"), ("FLOKI-USD", "alt"),
      ("FARTCOIN-USD", "alt"), ("ETH-USD", "alt")]
SETS = {"P9": P9, "B": PB, "M": PM}
LEV2 = [1, 2, 1.25, 2, 1, 1, 1, 1.25]          # плечо по группам 0..7, схема агента 2
YEARS = np.array([IDX[s].year for s in STARTS])


def scheme(S0, D=None, lp=1.25, lb=2, lr=2, lev=True):
    """Правила с размерами и группами + плечо по группам. lev=False — без плеча (размеры W25 как есть). D — защита A4 (дней с максимума BTC)."""
    if not lev:
        return grouped(S0), [1.0] * 8
    S = base_scheme(S0); L = list(LEV2); L[1] = lb; L[3] = lr
    if D:
        S = split(S, c("btcdays", "<", D), 5, 1.0); L[2] = lp; L[7] = lp; L[5] = 1.0
    else:
        L[2] = lp; L[7] = lp
    return S, L


class Port:
    """Набор монет с кэшем планов и маской шорта BTC."""
    def __init__(self, coins):
        self.B = Book(coins); self._p = {}
        W = self.B.hold(self.B.mask([[c("fng", ">", 75)]]), self.B.mask(BOT + [[c("btcr30", ">", 20)]])); W[:, 1:] = 0; self.W = W

    def plan(self, S):
        k = json.dumps(S, sort_keys=True)
        if k not in self._p:
            A, G, _ = self.B.plan(S); self._p[k] = (A, G)
        return self._p[k]

    def run(self, S, L, sh=0.0, lag=0, rate=0.0003, stress=True, xs=False):
        A, G = self.plan(S)
        return self.B.port(A, G, self.B.levmat(L), SHW=self.W * sh if sh else None, lag=lag, rate=rate, stress=stress, xs=xs)


def full(P, S, L, sh=0.0, rate=0.0003):
    """В срок и на день позже, стресс −20/−30% (и +20/+30% для шорта); итог по годам старта (в срок)."""
    o0 = P.run(S, L, sh, 0, rate, xs=True); o1 = P.run(S, L, sh, 1, rate)
    x = np.array(o0.pop("_x")); o0.pop("_sh", None)
    by = {int(y): float(np.median(x[YEARS == y])) for y in sorted(set(YEARS))}
    return {"m0": o0["med"], "m1": o1["med"], "p10": o0["p10"], "p10_1": o1["p10"], "lvl": min(o0["lvl"], o1["lvl"]), "lvl0": o0["lvl"],
            "liq": [o0["liq"], o0.get("l20"), o0.get("l30"), o1["liq"], o1.get("l20"), o1.get("l30")], "safe": safe(o0) and safe(o1),
            "worst_start": float(x.min()), "by_year": by, "shpnl": o0["shpnl"]}


def fmt(o):
    return (f"в срок {o['m0']:+.0f}% | +1 день {o['m1']:+.0f}% | худшие 10% {o['p10']:+.0f}/{o['p10_1']:+.0f}% | запас {min(o['lvl'], 99):.2f}"
            f" | {'0 ликв.' if o['safe'] else 'ЛИКВ ' + str(o['liq'])} | худший старт {o['worst_start']:+.0f}%")
