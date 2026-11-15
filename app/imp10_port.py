"""imp10: портфель с ВЕСАМИ взноса по монетам и правилами исключения монет (копия agent4d_margin.sim4 с расширениями).
Расширения против sim4:
  * WT[t, k] — множитель взноса монеты в день t (1 — $2, 0 — монета не получает взнос). Взнос считается в inv только при WT > 0.
  * EX[t, k] = 1 — исключение монеты в день t+1: продать все монеты (комиссия), погасить её долг, чистый остаток (резерв + выручка)
    переложить по mode: 0 — резерв остаётся у монеты, но она больше не покупает (заморозка), 1 — в резервы активных монет пропорционально WT,
    2 — сразу купить BTC (колонка 0) по цене дня; после исключения взносов и покупок у монеты нет (стратегия продолжает только продажи).
    EX[t, k] = −1 — возврат исключённой монеты в день t+1 (взносы и покупки снова идут, с нуля).
  * FD[k] — ставка фандинга лонга перпа в день (монеты без спота на Hyperliquid: DOGE, PEPE), списывается со стоимости монет.
Вселенная: монеты Yahoo (как в основе) + монеты CoinMarketCap из кэша (cmcv_*). Индикаторы стратегии — agent_margin.indicators (+ EXTRA).
Использование: from imp10_port import *; U = Uni(coins); A, G = U.plan(S); o = U.port(A, G, L, WT=..., EX=...)"""
import sys, os, json, glob
import numpy as np, pandas as pd
from numba import njit
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import combo_margin  # noqa: F401  регистрирует up90/hi90/ago_qt/rel180/btcdays
from combo_margin import scheme, BOT, c, P9, PB, PM, P2, P3, SETS  # noqa: F401
from agent4d_margin import Book, IDX, STARTS, MEMES, safe  # noqa: F401
from agent_margin import ML, FEE, UNIT
import data

HERE = os.path.dirname(os.path.abspath(__file__))
SP = "/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad"
MCAP_DIR = os.environ.get("IMP10_MCAP", os.path.join(SP, "imp10_mcap"))
BEST = json.load(open(os.path.join(HERE, "found", "combo-best.json")))
S_BEST = {"base": BEST["base"], "rules": BEST["rules"]}
YCID = {"BTC-USD": 1, "ETH-USD": 1027, "SOL-USD": 5426, "HYPE32196-USD": 32196, "PUMP36507-USD": 36507, "DOGE-USD": 74, "PEPE24478-USD": 24478,
        "ENA-USD": 30171, "ZEC-USD": 1437, "XRP-USD": 52, "BNB-USD": 1839, "ADA-USD": 2010, "LINK-USD": 1975, "AVAX-USD": 5805, "LTC-USD": 2,
        "SHIB-USD": 5994, "WIF-USD": 28752, "BONK-USD": 23095, "FLOKI-USD": 10804, "FARTCOIN-USD": 33597, "TRX-USD": 1958, "DOT-USD": 6636,
        "BCH-USD": 1831, "NEAR-USD": 6535, "FIL-USD": 2280, "ATOM-USD": 3794, "MYX36410-USD": 36410, "XMR-USD": 328, "XLM-USD": 512, "ETC-USD": 1321,
        "VET-USD": 3077, "ALGO-USD": 4030, "AAVE-USD": 7278, "VVV35509-USD": 35509}
NOSPOT = {"DOGE-USD", "PEPE24478-USD"}            # на Hyperliquid только перпы: фандинг лонга ~6% годовых (hyperliquid_exec.md)
STABLE = {"USDT", "USDC", "DAI", "FDUSD", "TUSD", "USDE", "ZCHF", "BUSD", "PYUSD", "USDS", "EURC"}


def mcap(cid):
    """Капитализация/объём CMC по дням (DataFrame c, v, m) или None."""
    f = os.path.join(MCAP_DIR, f"{cid}.json")
    if not os.path.exists(f):
        return None
    d = json.load(open(f))
    if not d["t"]:
        return None
    df = pd.DataFrame(d["v"], index=pd.to_datetime(d["t"]), columns=["c", "v", "m"]).astype(float)
    return df[~df.index.duplicated()]


def cmc_series(cid):
    f = os.path.join(HERE, "cache", f"cmcv_{cid}.json")
    d = json.load(open(f))
    df = pd.DataFrame(d["v"], index=pd.to_datetime(d["t"]), columns=["o", "h", "l", "c", "v"]).astype(float)
    df = df[(df["c"] > 0)]
    return df[~df.index.duplicated()]


class Uni(Book):
    """Book для смешанной вселенной: монета — ("BTC-USD", "btc") (Yahoo) или ("cmc:1234", "alt") (кэш CoinMarketCap)."""
    def __init__(self, coins):
        self.coins = coins; n = len(IDX); K = len(coins)
        self.C = np.full((n, K), np.nan); self.LO = self.C.copy(); self.HI = self.C.copy(); self.I = []
        for k, (sym, kind) in enumerate(coins):
            if sym.startswith("cmc:"):
                df = cmc_series(int(sym[4:])); close = df["c"]; lo0, hi0 = df["l"], df["h"]
            else:
                close = data.history(sym)[0]; close = close[~close.index.duplicated()]
                o = data._ohlc[sym]; o = o[~o.index.duplicated()]; lo0, hi0 = o["l"], o["h"]
            cc = close.reindex(IDX).values
            lo = lo0.reindex(IDX).values; hi = hi0.reindex(IDX).values
            lo = np.where(np.isfinite(lo) & (lo > 0), np.minimum(lo, cc), cc)
            hi = np.where(np.isfinite(hi) & (hi > 0), np.maximum(hi, cc), cc)
            self.C[:, k] = cc; self.LO[:, k] = lo; self.HI[:, k] = hi
            self.I.append((close, kind))
        self.meme = np.array([s in MEMES for s, _ in coins]); self._ind = {}; self._p = {}
        W = self.hold(self.mask([[c("fng", ">", 75)]]), self.mask(BOT + [[c("btcr30", ">", 20)]])); W[:, 1:] = 0; self.SHW = W

    def cid(self, k):
        s = self.coins[k][0]
        return int(s[4:]) if s.startswith("cmc:") else YCID.get(s)

    def plan2(self, S):
        k = json.dumps(S, sort_keys=True)
        if k not in self._p:
            A, G, _ = self.plan(S); self._p[k] = (A, G)
        return self._p[k]

    def portw(self, A, G, L, WT=None, EX=None, mode=0, FD=None, sh=0.0, lag=0, rate=0.0003, sh_rate=0.15 / 365, stress=False, starts=None, xs=False):
        K = len(self.coins)
        Lm = L if isinstance(L, np.ndarray) and L.ndim == 2 else self.levmat(L)
        WT = np.ones(self.C.shape) if WT is None else WT.astype(float)
        EX = np.zeros(self.C.shape) if EX is None else EX.astype(float)
        FDv = np.zeros(K) if FD is None else np.asarray(FD, dtype=float)
        SH = self.SHW * sh if sh else np.zeros(self.C.shape)
        if lag:
            A, G, SH, WT, EX = _shift(A, lag, 1.0), _shift(G, lag, 0), _shift(SH, lag), _shift(WT, lag, 0.0), _shift(EX, lag)
        st = STARTS if starts is None else starts
        R = [simw(self.C, self.LO, self.HI, A, G, SH, WT, EX, FDv, int(s), Lm, 1.0, sh_rate, rate, mode) for s in st]
        x = np.array([q[1] for q in R]) * 100
        o = {"liq": int(sum(q[0] > 0 for q in R)), "med": float(np.median(x)), "p10": float(np.percentile(x, 10)), "lvl": float(min(q[2] for q in R)),
             "early": float(np.median(x[:48])), "late": float(np.median(x[48:])), "fin": float(np.median([q[3] for q in R])), "x": x}
        if stress and o["liq"] == 0:
            for sv, key in ((0.8, "l20"), (0.7, "l30")):
                o[key] = int(sum(simw(self.C, self.LO, self.HI, A, G, SH, WT, EX, FDv, int(s), Lm, sv, sh_rate, rate, mode)[0] > 0 for s in st))
        return o


def _shift(M, lag, fill=0.0):
    O = np.empty_like(M); O[lag:] = M[:-lag]; O[:lag] = fill
    return O


@njit(cache=True)
def simw(C, LO, HI, ACT, GRP, SHW, WT, EX, FD, s0, LEV, stress, sh_rate, rate, mode):
    n, K = C.shape
    r = np.zeros(K); u = np.zeros(K); debt = np.zeros(K); su = np.zeros(K); stg = np.zeros(K); out = np.zeros(K)
    inv = 0.0; nl = 0; side = 0.0; worst = 1e9; shc = 0.0
    for t in range(s0, n):
        tot = 0.0
        for k in range(K):
            tot += r[k]
        if shc < 0:
            shc -= -shc * rate
        if tot < 0:
            fee = -tot * rate; neg = 0.0
            for k in range(K):
                if r[k] < 0:
                    neg += r[k]
            for k in range(K):
                if r[k] < 0:
                    r[k] -= fee * r[k] / neg
        # исключение (решение вчера): продать всё, погасить долг, переложить
        if t > s0:
            for k in range(K):
                if EX[t - 1, k] < 0 and out[k] > 0:          # возврат монеты (круг 5): взнос и покупки снова идут
                    out[k] = 0.0
                    continue
                if EX[t - 1, k] > 0 and out[k] == 0 and not np.isnan(C[t, k]):
                    out[k] = 1.0
                    net = r[k] + u[k] * C[t, k] * (1 - FEE) - debt[k]
                    if mode == 0:
                        continue                      # заморозка: держим монеты, не покупаем
                    u[k] = 0.0; debt[k] = 0.0; r[k] = 0.0
                    if mode == 2 and not np.isnan(C[t, 0]) and out[0] == 0:
                        if net > 0:
                            u[0] += net * (1 - FEE) / C[t, 0]
                        else:
                            r[0] += net
                    else:
                        wsum = 0.0
                        for j in range(K):
                            if out[j] == 0 and not np.isnan(C[t, j]):
                                wsum += WT[t - 1, j]
                        if wsum > 0:
                            for j in range(K):
                                if out[j] == 0 and not np.isnan(C[t, j]):
                                    r[j] += net * WT[t - 1, j] / wsum
                        else:
                            side += net
        for k in range(K):
            p = C[t, k]
            if np.isnan(p):
                continue
            w = WT[t - 1, k] if t > s0 else WT[t, k]
            if out[k] > 0:
                w = 0.0
            if FD[k] > 0:
                u[k] *= 1 - FD[k]
            if w > 0:
                inv += UNIT * w
            before = r[k]; r[k] += UNIT * w
            debt[k] *= 1 + rate
            if su[k] > 0:
                shc -= su[k] * p * sh_rate
            a = ACT[t - 1, k] if t > s0 else 1.0
            g = GRP[t - 1, k] if t > s0 else 0
            if a < 0:
                f = -a
                r[k] += f * (u[k] * p * (1 - FEE) - debt[k]); u[k] *= 1 - f; debt[k] *= 1 - f
            elif out[k] == 0:
                v = min(r[k], UNIT * w + (a - 1) * before)
                if v > 0:
                    b = (LEV[g, k] - 1) * v
                    if b < 0:
                        b = 0.0
                    r[k] -= v; u[k] += (v + b) * (1 - FEE) / p; debt[k] += b
            if t > s0:
                want = SHW[t - 1, k]
                if want > stg[k] + 1e-12:
                    eq = side + shc
                    for j in range(K):
                        eq += r[j] - debt[j]
                        if not np.isnan(C[t, j]):
                            eq += u[j] * C[t, j] - su[j] * C[t, j]
                    q = (want - stg[k]) * max(eq, 0.0) / p
                    su[k] += q; shc += q * p * (1 - FEE); stg[k] = want
                elif want == 0 and su[k] > 0:
                    shc -= su[k] * p * (1 + FEE); su[k] = 0.0; stg[k] = 0.0
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
        last = C[n - 1, k]
        if np.isnan(last):                      # монета пропала из данных: последняя известная цена
            for t in range(n - 1, -1, -1):
                if not np.isnan(C[t, k]):
                    last = C[t, k]; break
        fin += r[k] - debt[k] + (u[k] - su[k]) * (0.0 if np.isnan(last) else last)
    if inv <= 0:
        return nl, 0.0, worst, 0.0
    return nl, fin / inv - 1, worst, fin


DCA = {"base": 1, "rules": [{"act": 1, "conds": [{"ind": "fng", "op": "<", "v": -1}]}]}   # правило, которое никогда не срабатывает


def nolev(S):
    return scheme(S, lev=False)


def best_margin(S):
    return scheme(S, D=60, lp=1.4, lr=1.5)


def summ(o):
    return f"мед {o['med']:+.0f}% | p10 {o['p10']:+.0f}% | 2018–21 {o['early']:+.0f}% | 2022–26 {o['late']:+.0f}%"
