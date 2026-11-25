"""Круг 10 mlt: итог и «что сейчас» для опции HY3 и ядра mb1. Запуск: python3 app/mlt_r10.py"""
import json
import os

import numpy as np

import mlt_lib as L

NM = L.NAME
KEYS = ["gold", "silver", "platinum", "palladium", "copper", "aluminum"]


def mb1_word(a):
    if a < 0:
        return f"продажа {-a:.1%} позиции в день"
    if a == 0:
        return "копить взнос (остывание)"
    if a > 1:
        return "серия докупок из резерва"
    return "обычный взнос"


def main():
    L.tee("r10.txt")
    D, DD, MM, base = L.load()
    h = L.HY3()
    out = {}
    print("Круг 10. «Что сейчас» (решение по закрытию последнего дня, исполнение на следующий торговый день)\n")
    for k in KEYS:
        X = MM[k]
        f = L.F(X)
        c = X.c
        n = X.n
        e = h.e(X)
        up = L.regime(X)
        s20, s50, s200 = L.sma(c, 20)[-1], L.sma(c, 50)[-1], L.sma(c, 200)[-1]
        sd = f["sd250"][-1]
        last = c[-1]
        sw = np.where(np.diff(e) != 0)[0]
        since = str(X.t[sw[-1] + 1].date()) if len(sw) else "—"
        days_out = int(n - 1 - sw[-1]) if len(sw) and e[-1] == 0 else 0
        # уровни
        p_sell_dn = c[n - 20] * np.exp(1.25 * sd * np.sqrt(21))      # рост 21 дн. > 1,25σ к закрытию завтра (база — закрытие 20 дн. назад)
        p_sell_up = s50 * np.exp(2.0 * sd * 5)                        # отрыв > 2σ√25 над SMA50 (SMA50 почти не изменится за день)
        st = {"date": str(X.t[-1].date()), "close": float(last), "regime_strong_up": bool(up[-1]), "in_metal": bool(e[-1] == 1), "since": since,
              "sma20": float(s20), "sma50": float(s50), "sma200": float(s200), "rsi14": float(f["rsi"][-1]), "z21": float(f["z21"][-1]),
              "mb1": mb1_word(base[k][-1]), "from_ath": float(last / np.max(c) - 1)}
        if e[-1] == 1:
            if up[-1]:
                st["action"] = "держать торговую часть (сильный рост; продажа только на перегреве)"
                st["sell_if_close_above"] = float(p_sell_up)
            else:
                st["action"] = "держать торговую часть (вне сильного роста; ждать отскока для продажи)"
                st["sell_if_close_above"] = float(p_sell_dn)
        else:
            st["action"] = "торговая часть продана (в векселях); ждать откупа"
            if up[-1]:
                st["buy_if"] = "RSI14 < 50"
            else:
                st["buy_if_close_at_or_below"] = float(s20)
            st["time_stop_days_left"] = int(126 - days_out)
        st["regime_flip"] = (f"сильный рост начнётся при цене > SMA200 = {s200:.4g} и SMA50 > SMA200 (сейчас SMA50 {'>' if s50 > s200 else '<'} SMA200)"
                             if not up[-1] else f"сильный рост кончится при цене < SMA200 = {s200:.4g} или SMA50 < SMA200")
        # сделки 2025–26
        tr = []
        for i in sw:
            if X.t[i + 1] >= np.datetime64("2025-01-01"):
                tr.append(f"{X.t[i + 1].date()} {'откуп' if e[i + 1] == 1 else 'продажа'} {c[i + 1]:.4g}")
        st["trades_2025_26"] = tr
        out[k] = st
        print(f"{NM[k]} ({st['date']}, цена {last:.4g}, от рекорда {st['from_ath']:+.0%}): ядро mb1 — {st['mb1']}; режим {'СИЛЬНЫЙ РОСТ' if up[-1] else 'не сильный рост'} "
              f"(SMA20 {s20:.4g}, SMA50 {s50:.4g}, SMA200 {s200:.4g}; RSI {st['rsi14']:.0f}; рост 21 дн. {st['z21']:+.2f}σ)")
        print(f"   опция HY3: {st['action']} (состояние с {since})"
              + (f"; продажа, если закрытие > {st['sell_if_close_above']:.4g}" if "sell_if_close_above" in st else "")
              + (f"; откуп при закрытии ≤ {st['buy_if_close_at_or_below']:.4g}" if "buy_if_close_at_or_below" in st else "")
              + (f"; откуп при {st['buy_if']}" if "buy_if" in st else "")
              + (f"; откуп по сроку через {st['time_stop_days_left']} торг. дн." if "time_stop_days_left" in st else ""))
        print(f"   {st['regime_flip']}")
        print(f"   сделки 2025–26: {'; '.join(tr) if tr else 'нет'}")
    json.dump(out, open(os.path.join(L.LOGDIR, "r10.json"), "w"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
