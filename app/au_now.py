"""au: что металлы говорят сейчас — индикаторы кандидата found/au-best.json по свежим данным Yahoo (образец расчёта в Python).
au_r30 = рост золота (GC=F) за 30 календарных дней, %: закрытия переносятся вперёд на календарные дни (выходные/праздники — последнее закрытие);
ag_r30 — то же для серебра (SI=F); agau30 = ag_r30 − au_r30 (серебро к золоту, п.п.); au_c90 — корреляция доходностей BTC и золота за 90 дней
на торговых днях золота (BTC за тот же отрезок); btc200 — BTC / 200-дн. средняя. Решение — по вчерашнему закрытому дню.
Запуск: python3 au_now.py"""
import numpy as np
import pandas as pd

import data


def cal(sym):
    s = data.history(sym)[0].dropna()
    s = s[s > 0]
    idx = pd.date_range(s.index[0], pd.Timestamp.utcnow().tz_localize(None).normalize() - pd.Timedelta(days=1), freq="D")
    return s.reindex(idx.union(s.index)).ffill().reindex(idx), s


au, au_raw = cal("GC=F")
ag, _ = cal("SI=F")
btc, _ = cal("BTC-USD")
r30 = lambda x: (x / x.shift(30) - 1) * 100  # noqa: E731
I = pd.DataFrame({"au": au, "ag": ag, "btc": btc})
I["au_r30"], I["ag_r30"] = r30(I["au"]), r30(I["ag"])
I["agau30"] = I["ag_r30"] - I["au_r30"]
I["btc200"] = I["btc"] / I["btc"].rolling(200).mean()
td = au_raw.index[au_raw.index.isin(I.index)]
rg, rb = np.log(I["au"].reindex(td)).diff(), np.log(I["btc"].reindex(td)).diff()
I["au_c90"] = pd.Series([rg[(td > d - pd.Timedelta(days=90)) & (td <= d)].corr(rb[(td > d - pd.Timedelta(days=90)) & (td <= d)]) for d in I.index], index=I.index)
I["au_ath"] = (1 - I["au"] / I["au"].cummax()) * 100
I["ag_ath"] = (1 - I["ag"] / I["ag"].cummax()) * 100
I["bg"] = I["btc"] / I["au"]
I["bg_s200"] = I["bg"] / I["bg"].rolling(200).mean()
fg = data.fear_greed()
I["fng"] = fg.reindex(I.index).ffill()
print(I[["au", "ag", "btc", "au_r30", "ag_r30", "agau30", "au_c90", "au_ath", "ag_ath", "btc200", "bg_s200", "fng"]].tail(12).round(2).to_string())
x = I.iloc[-1]
print(f"\nпоследний день {I.index[-1].date()}: золото {x.au:.0f} ({x.au_r30:+.1f}% за 30 дн, −{x.au_ath:.0f}% от рекорда), серебро {x.ag:.2f} ({x.ag_r30:+.1f}%, −{x.ag_ath:.0f}%), "
      f"серебро к золоту {x.agau30:+.1f} п.п., корреляция BTC–золото 90 дн {x.au_c90:+.2f}, BTC/200д {x.btc200:.3f}, страх {x.fng:.0f}")
print(f"К1 (паника ×1,5 при серебро хуже золота на 6 п.п.): условие металла {'ВЕРНО' if x.agau30 < -6 else 'нет'}")
print(f"К4 (страх ×1,5 при золоте +3% за 30 дн): условие металла {'ВЕРНО' if x.au_r30 > 3 else 'нет'}")
print(f"К2 (необязательный: страх не продаёт при серебро хуже золота на 6 п.п. и BTC < 200д): {'ВЕРНО' if x.agau30 < -6 and x.btc200 < 1 else 'нет'}")
