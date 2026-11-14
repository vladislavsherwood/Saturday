"""Агент 4D: портфель с маржой и шортами для любого набора монет (обобщение agent2_margin.sim2).
Что добавлено к sim2 (при параметрах по умолчанию считает ровно как sim2 с sep=True, negrate=True):
  * LEV — плечо по группам И по монетам (матрица 8 × K): риск через размер/плечо покупки, без лимитов займа;
  * LEVM — необязательная поправка плеча по дню и монете (множитель к плечу − 1; 1 — без поправки): плечо по близости к дну;
  * SHW — желаемый размер шорта по дню и монете (доля капитала счёта при открытии; 0 — без шорта): шорт любой монеты/корзины,
    размер по силе сигнала; позиция в монетах фиксируется при открытии и держится до дня, когда SHW = 0;
  * REP — дни погашения долга по монете: > 0 — продаём монету на эту долю её долга, < 0 — гасим эту долю долга из резерва монеты;
  * rate — ставка займа в день (по умолчанию 0,0003 = ~11% годовых), sh_rate — ставка займа монеты для шорта;
  * сдвиг исполнения — матрицы сдвигаются на lag дней (shift()).
Использование: from agent4d_margin import Book; B = Book(COINS); A, G, RI = B.plan(S); o = B.port(A, G, LEV, ...)"""
import sys, os, json
import numpy as np, pandas as pd
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import engine, data
from agent_margin import indicators, ML, FEE, UNIT

HERE = os.path.dirname(os.path.abspath(__file__))
P9 = [("BTC-USD", "btc"), ("ETH-USD", "alt"), ("SOL-USD", "alt"), ("HYPE32196-USD", "alt"), ("PUMP36507-USD", "alt"),
      ("DOGE-USD", "alt"), ("PEPE24478-USD", "alt"), ("ENA-USD", "alt"), ("ZEC-USD", "alt")]
# второй набор: BTC (для шорта BTC) + 8 монет, которых нет в портфеле (крупные альты и мемы)
PB = [("BTC-USD", "btc"), ("XRP-USD", "alt"), ("BNB-USD", "alt"), ("ADA-USD", "alt"), ("LINK-USD", "alt"),
      ("AVAX-USD", "alt"), ("LTC-USD", "alt"), ("SHIB-USD", "alt"), ("WIF-USD", "alt")]
MEMES = {"DOGE-USD", "PEPE24478-USD", "PUMP36507-USD", "SHIB-USD", "WIF-USD", "BONK-USD", "FLOKI-USD", "FARTCOIN-USD"}
IDX = pd.date_range("2018-01-01", "2026-11-13")
STARTS = np.array([i for i, x in enumerate(IDX) if x.day == 1 and i < len(IDX) - 60])
c = lambda i, o, v: {"ind": i, "op": o, "v": v}                         # noqa: E731
BOT = [[c("usdt", ">", 1.07), c("othd", "<", 25)], [c("fng", "<", 10)], [c("oidd30", "<", -28)]]
W25M = json.load(open(os.path.join(HERE, "found", "agent2-best-margin.json")))
W25S = W25M["rules_with_sizes"]                                         # W25 с размерами схемы круга 2 (группы плеча проставлены)
W25L = (1, 2, 1.25, 2, 1, 1, 1, 1.25)                                   # плечо по группам 0..7


class Book:
    def __init__(self, coins=P9):
        self.coins = coins; n = len(IDX); K = len(coins)
        self.C = np.full((n, K), np.nan); self.LO = self.C.copy(); self.HI = self.C.copy(); self.I = []
        for k, (sym, kind) in enumerate(coins):
            df = data.history(sym)[0]; close = df[~df.index.duplicated()]
            o = data._ohlc[sym]; o = o[~o.index.duplicated()]
            cc = close.reindex(IDX).values
            lo = o["l"].reindex(IDX).values; hi = o["h"].reindex(IDX).values
            lo = np.where(np.isfinite(lo) & (lo > 0), np.minimum(lo, cc), cc)       # как в cross_lev / agent_margin
            hi = np.where(np.isfinite(hi) & (hi > 0), np.maximum(hi, cc), cc)
            self.C[:, k] = cc; self.LO[:, k] = lo; self.HI[:, k] = hi
            self.I.append((close, kind))
        self.meme = np.array([s in MEMES for s, _ in coins])
        self._ind = {}

    def ind(self, k):
        if k not in self._ind:
            close, kind = self.I[k]; self._ind[k] = indicators(close, kind)
        return self._ind[k]

    def series(self, name):
        """Индикатор по дням × монетам (NaN, где монеты нет)."""
        M = np.full(self.C.shape, np.nan)
        for k in range(len(self.coins)):
            M[:, k] = self.ind(k)[name].reindex(IDX).values
        M[np.isnan(self.C)] = np.nan
        return M

    def mask(self, any_of):
        M = np.zeros(self.C.shape, dtype=bool)
        for k in range(len(self.coins)):
            I = self.ind(k); close = self.I[k][0]; m = pd.Series(False, index=close.index)
            for conds in any_of:
                mm = pd.Series(True, index=close.index)
                for q in conds:
                    s = I[q["ind"]]; mm &= (s < q["v"]) if q["op"] == "<" else (s > q["v"])
                m |= mm.fillna(False)
            M[:, k] = m.reindex(IDX).fillna(False).values
        return M

    def plan(self, S):
        """ACT (доля действия), GRP (группа плеча), RI (номер правила) по дням × монетам; правила должны иметь поле grp."""
        acts = np.array([r["act"] for r in S["rules"]] + [S.get("base", 1)])
        grp = np.array([r["grp"] for r in S["rules"]] + [0])
        ACT = np.ones_like(self.C); GRP = np.zeros(self.C.shape, dtype=np.int64); RI = np.full(self.C.shape, -2, dtype=np.int64)
        for k in range(len(self.coins)):
            I = self.ind(k); close = self.I[k][0]; conds = []
            for r in S["rules"]:
                m = pd.Series(True, index=close.index)
                for q in r["conds"]:
                    s = I[q["ind"]]; m &= (s < q["v"]) if q["op"] == "<" else (s > q["v"])
                conds.append(m.fillna(False).values)
            ri = np.select(conds, list(range(len(S["rules"]))), default=-1)
            ri = pd.Series(ri, index=close.index).reindex(IDX).fillna(-1).astype(int).values
            RI[:, k] = ri; ACT[:, k] = acts[ri]; GRP[:, k] = grp[ri]
        RI[np.isnan(self.C)] = -2
        return ACT, GRP, RI

    def hold(self, entry, exit_, size=None, maxd=0):
        """Состояние шорта: держим с дня входа до дня выхода; size — размер (матрица или число), фиксируется на день входа."""
        W = np.zeros(self.C.shape)
        for k in range(self.C.shape[1]):
            on, d, sz = False, 0, 0.0
            for t in range(self.C.shape[0]):
                if on:
                    d += 1
                    if exit_[t, k] or (maxd and d >= maxd):
                        on = False
                elif entry[t, k] and not exit_[t, k]:
                    on, d = True, 0
                    sz = size[t, k] if isinstance(size, np.ndarray) else (1.0 if size is None else size)
                W[t, k] = sz if on else 0.0
        return W

    def levmat(self, lev, per_coin=None):
        """Матрица плеча 8 × K: lev — по группам; per_coin — {группа: функция(sym) -> плечо} или {группа: массив K}."""
        K = len(self.coins); L = np.ones((8, K))
        for g in range(8):
            L[g, :] = lev[g] if g < len(lev) else 1.0
        for g, f in (per_coin or {}).items():
            L[g, :] = [f(s) for s, _ in self.coins] if callable(f) else f
        return L

    def port(self, A, G, lev=W25L, SHW=None, LEVM=None, REP=None, rate=0.0003, sh_rate=0.15 / 365, stress=True, xs=False, lag=0, starts=None, end=None):
        L = lev if isinstance(lev, np.ndarray) and lev.ndim == 2 else self.levmat(lev)
        SH = np.zeros(self.C.shape) if SHW is None else SHW.astype(float)
        LM = np.ones(self.C.shape) if LEVM is None else LEVM.astype(float)
        RP = np.zeros(self.C.shape) if REP is None else REP.astype(float)
        if lag:
            A, G, SH, LM, RP = shift(A, lag, 1.0), shift(G, lag, 0), shift(SH, lag), shift(LM, lag, 1.0), shift(RP, lag)
        st = STARTS if starts is None else starts
        Cc, Lc, Hc = self.C, self.LO, self.HI
        if end is not None:                    # итог считаем на день end (цикл целиком, без следующих лет)
            Cc, Lc, Hc, A, G, SH, LM, RP = (x[:end] for x in (Cc, Lc, Hc, A, G, SH, LM, RP))
            st = np.array([s for s in st if s < end - 60])
        R = [sim4(Cc, Lc, Hc, A, G, SH, LM, RP, int(s), L, 1.0, sh_rate, rate) for s in st]
        x = np.array([q[1] for q in R]) * 100
        o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)),
             "early": float(np.median(x[:48])), "late": float(np.median(x[48:])), "shpnl": float(np.median([q[3] for q in R]) * 100),
             "int": float(np.median([q[4] for q in R]) * 100)}
        if xs:
            o["_x"] = x.tolist(); o["_sh"] = [q[3] * 100 for q in R]
        if stress and o["liq"] == 0:
            for sv, key in ((0.8, "l20"), (0.7, "l30")):
                o[key] = int(sum(sim4(Cc, Lc, Hc, A, G, SH, LM, RP, int(s), L, sv, sh_rate, rate)[0] > 0 for s in st))
        return o


def shift(M, lag, fill=0.0):
    """Исполнение на lag дней позже: решение дня t выполняется на день t + lag."""
    O = np.empty_like(M)
    O[lag:] = M[:-lag]
    O[:lag] = fill
    return O


def safe(o):
    return o["liq"] == 0 and o.get("l20", 1) == 0 and o.get("l30", 1) == 0


def fmt(o):
    return (f"медиана {o['med']:+.0f}% | худшие 10% {o['p10']:+.0f}% | 2018–21 {o['early']:+.0f}%, 2022–26 {o['late']:+.0f}% | ликв. {o['liq']}"
            + (f", −20%: {o['l20']}, −30%: {o['l30']}" if "l20" in o else "") + f" | мин. активы/долг {min(o['lvl'], 99):.2f}"
            + (f" | шорт {o['shpnl']:+.1f}%" if o["shpnl"] else "") + f" | проценты {o['int']:.1f}%")


@njit(cache=True)
def sim4(C, LO, HI, ACT, GRP, SHW, LEVM, REP, s0, LEV, stress, sh_rate, rate):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K); su = np.zeros(K); stg = np.zeros(K)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9; shpnl = 0.0; paid = 0.0; shc = 0.0
    for t in range(s0, n):
        tot = 0.0
        for k in range(K):
            tot += r[k]
        if shc < 0:
            fee = -shc * rate; paid += fee; shc -= fee
        if tot < 0:
            fee = -tot * rate; paid += fee; neg = 0.0
            for k in range(K):
                if r[k] < 0:
                    neg += r[k]
            for k in range(K):
                if r[k] < 0:
                    r[k] -= fee * r[k] / neg
        for k in range(K):
            p = C[t, k]
            if np.isnan(p):
                continue
            inv += UNIT; before = r[k]; r[k] += UNIT
            paid += debt[k] * rate; debt[k] *= 1 + rate
            if su[k] > 0:
                shc -= su[k] * p * sh_rate; shpnl -= su[k] * p * sh_rate
            a = ACT[t - 1, k] if t > s0 else 1.0
            g = GRP[t - 1, k] if t > s0 else 0
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - f; debt[k] *= 1 - f
            else:
                v = min(r[k], UNIT + (a - 1) * before)
                if v > 0:
                    lm = LEVM[t - 1, k] if t > s0 else 1.0
                    b = (LEV[g, k] - 1) * lm * v
                    if b < 0:
                        b = 0.0
                    r[k] -= v; u[k] += (v + b) * (1 - FEE) / p; debt[k] += b
            # погашение долга монеты продажей её же монет на сигнале
            if t > s0 and REP[t - 1, k] < 0 and debt[k] > 0 and r[k] > 0:      # погашение из резерва монеты (без продажи монет)
                q = min(r[k], debt[k] * min(1.0, -REP[t - 1, k]))
                r[k] -= q; debt[k] -= q
            if t > s0 and REP[t - 1, k] > 0 and debt[k] > 0 and u[k] > 0:
                f = min(1.0, REP[t - 1, k])
                need = debt[k] * f; q = min(u[k], need / (p * (1 - FEE)))
                u[k] -= q; debt[k] -= q * p * (1 - FEE)
                if debt[k] < 0:
                    r[k] -= debt[k]; debt[k] = 0.0
            if t > s0:
                want = SHW[t - 1, k]
                if want > stg[k] + 1e-12:              # открыть или добавить к шорту (лесенка по силе перегрева): +(want − текущая цель) капитала
                    eq = side + shc
                    for j in range(K):
                        eq += r[j] - debt[j]
                        if not np.isnan(C[t, j]):
                            eq += u[j] * C[t, j] - su[j] * C[t, j]
                    q = (want - stg[k]) * max(eq, 0.0) / p
                    su[k] += q; shpnl -= q * p * FEE; shc += q * p * (1 - FEE); stg[k] = want
                elif want == 0 and su[k] > 0:
                    shc -= su[k] * p * (1 + FEE); shpnl -= su[k] * p * FEE; su[k] = 0.0; stg[k] = 0.0
        R = shc
        for k in range(K):
            R += r[k]
        assets = side + max(R, 0.0); D = max(-R, 0.0)
        for k in range(K):
            if not np.isnan(C[t, k]):
                assets += u[k] * LO[t, k] * stress
                D += su[k] * HI[t, k] * (2.0 - stress)
            D += debt[k]
        if D > 0:
            lv = assets / D
            if lv < worst:
                worst = lv
            if lv <= ML:
                nl += 1; left = assets - D
                for k in range(K):
                    r[k] = 0.0; u[k] = 0.0; debt[k] = 0.0; su[k] = 0.0; stg[k] = 0.0
                side = max(0.0, left); shc = 0.0
    fin = side + shc
    for k in range(K):
        if not np.isnan(C[n - 1, k]):
            fin += r[k] - debt[k] + (u[k] - su[k]) * C[n - 1, k]
        else:
            fin += r[k] - debt[k]
    return nl, fin / inv - 1, worst, shpnl / inv, paid / inv


BIG = {"BTC-USD", "ETH-USD", "BNB-USD", "XRP-USD"}


def cls(sym):
    return "big" if sym in BIG else ("meme" if sym in MEMES else "mid")


def both(B, A, G, lev=W25L, **kw):
    """Оценка при исполнении в срок и на день позже: худшая медиана и худшие 10%, ликвидации/стресс по обоим."""
    o0 = B.port(A, G, lev, **kw); o1 = B.port(A, G, lev, lag=1, **kw)
    return {"med": min(o0["med"], o1["med"]), "p10": min(o0["p10"], o1["p10"]), "m0": o0["med"], "m1": o1["med"],
            "lvl": min(o0["lvl"], o1["lvl"]), "safe": safe(o0) and safe(o1), "sh": o0["shpnl"], "int": o0["int"],
            "liq": (o0["liq"], o0.get("l20"), o0.get("l30"), o1["liq"], o1.get("l20"), o1.get("l30"))}


def fb(o):
    return (f"худш. из сдвигов {o['med']:+.0f}% (в срок {o['m0']:+.0f}, +1 день {o['m1']:+.0f}) | худшие 10% {o['p10']:+.0f}% | запас {min(o['lvl'], 99):.2f}"
            f" | {'OK' if o['safe'] else 'ЛИКВ ' + str(o['liq'])}" + (f" | шорт {o['sh']:+.1f}%" if o["sh"] else ""))


E21 = int(np.searchsorted(IDX, pd.Timestamp("2022-01-01")))          # конец цикла 2019–21
S21 = np.array([s for s in STARTS if IDX[s] < pd.Timestamp("2021-01-01")])
S24 = np.array([s for s in STARTS if IDX[s] >= pd.Timestamp("2022-01-01")])


def cycles(B, A, G, lev=W25L, **kw):
    """Медиана итога (в срок / на день позже, худший) по циклам: старты 2018–20 с итогом на 2021-12-31; старты 2022–26 с итогом сейчас."""
    a = min(B.port(A, G, lev, stress=False, starts=S21, end=E21, lag=l, **kw)["med"] for l in (0, 1))
    b = min(B.port(A, G, lev, stress=False, starts=S24, lag=l, **kw)["med"] for l in (0, 1))
    return a, b
