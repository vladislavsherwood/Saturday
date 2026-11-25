"""Круг 10 mcx: «что сейчас» — mb1 и дневные индикаторы (справочно) на последний день данных; итоговая таблица точности. Запуск: python3 app/mcx_r10.py"""
import json
import os

import numpy as np

import mcx_lib as C
from mcx_r5 import oi_daily
from mcx_r7 import heat


def act(a):
    if a > 1:
        return f"серия: взнос + {a - 1:.1%} резерва в день"
    if a < 0:
        return f"продажа {-a:.1%} монет в день"
    if a == 0:
        return "копить взнос (остывание после продажи)"
    return "обычный взнос"


def main():
    C.tee("r10.txt")
    D, DD, MM, base = C.load()
    out = {"now": {}}
    x = DD["x"]
    vix, dxy, btc = x["vix"].dropna(), x["dxy"].dropna(), x["btc"].dropna()
    print(f"Рынок на {str(vix.index[-1])[:10]}: VIX {vix.iloc[-1]:.1f} (макс. 30 дн. {vix.iloc[-21:].max():.1f}); DXY {dxy.iloc[-1]:.2f}, за 21 день "
          f"{(dxy.iloc[-1] / dxy.iloc[-22] - 1) * 100:+.1f}%, к 10-дн. максимуму {dxy.iloc[-1] / dxy.iloc[-10:].max():.3f}; BTC за 30 дн. "
          f"{(btc.iloc[-1] / btc.asof(btc.index[-1] - np.timedelta64(30, 'D')) - 1) * 100:+.1f}%")
    for k in C.ALL5:
        X = MM[k]
        f = C.feats(X, DD)
        i = X.n - 1
        a0 = C.ix(X.t, C.A0)
        r = C.run(X, base, C.NULL, (a0, X.n))
        cap = r[7][i] * X.c[i] + r[6][i] + r[5][i]
        sd = f["sd250"][i]
        zheat = np.log(f["ma200"][i]) / (sd * np.sqrt(50))
        oi = oi_daily(X)[i]
        L = C.Layer(heat(DD, 3.5, 0.05, "B3"))
        ts, tb, tk, tm = L.arrays(X)
        o = {"date": str(X.t[i])[:10], "close": float(X.c[i]), "mb1_plan_today": act(base[k][i]), "mb1_reserve_share": float(r[6][i] / cap),
             "ath_dd": float(f["ddath"][i]), "fg": float(f["fg"][i]), "z21_sigma": float(f["z21"][i]), "heat_sigma": float(zheat),
             "hv_year": float(f["hv"][i]), "oi_dd": float(oi), "S1_sell": bool(ts[i] > 0), "S1_buyback": bool(tb[i] > 0)}
        out["now"][k] = o
        print(f"\n{C.NAME[k]} ({o['date']}, {X.c[i]:.4g}): mb1 — {o['mb1_plan_today']}; резерв mb1 (старт 2005) {o['mb1_reserve_share']:.0%} капитала; "
              f"от рекорда {o['ath_dd']:+.0%}; вол года {o['hv_year']:.0f}%")
        print(f"   дневные индикаторы: индекс страха металла {o['fg']:.0f} (< 10 — «капитуляция», < 25/40 — «страх»); рост за 21 день {o['z21_sigma']:+.1f}σ; "
              f"отрыв от SMA200 {o['heat_sigma']:+.1f}σ (порог перегрева 3,5σ); открытый интерес CFTC к максимуму 5 отчётов {oi:+.0%}")
        print(f"   отвергнутый S1 (перегрев → продажа / откуп под SMA50): {'продавал бы' if o['S1_sell'] else 'нет продажи'}; "
              f"{'откупал бы (если есть тактический резерв)' if o['S1_buyback'] else 'откупа нет'}")
    # итоговая точность: combo7 / mb1 / лучший отвергнутый слой
    r1 = json.load(open(os.path.join(C.LOGDIR, "r1.json")))
    p0 = C.prec_agg(C.NULL)
    p1 = C.prec_agg(L)
    print("\nТОЧНОСТЬ 2005–25 (4 металла): mb1 — " + C.pfmt(p0))
    print("  лучший отвергнутый слой S1-B3 — " + C.pfmt(p1))
    m = r1["crypto_med"]
    print(f"  combo7 (медиана выборки): эпиз./год пок. {m['buy_eps']:.1f} прод. {m['sell_eps']:.1f}; доньев {m['lows_caught']}/{m['lows']}, вершин {m['highs_caught']}/{m['highs']}; "
          f"место пок. {m['buy_pos180']:.2f}, прод. {m['sell_pos180']:.2f}")
    json.dump(out, open(os.path.join(C.LOGDIR, "r10.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
