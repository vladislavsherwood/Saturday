"""«Тихая вершина»: проверка кандидатов в маркер для вершин вроде августа–октября 2025, когда эйфории не было.

Для каждого кандидата: в какие месяцы истории он срабатывал и что стало с монетами через 90 дней —
отдельно по каждому эпизоду, чтобы было видно, сколько за ним независимых случаев.

Запуск: python3 app/quiet_top.py <markers.pkl>
"""
import sys

import numpy as np
import pandas as pd

ATH, BTCD, VOL, MVRV, USDT, ALT90, SYNC, TX = ("Биткоин: до исторического максимума, %", "BTC.D: изменение за 90 дней, п.п.", "Биткоин: волатильность за 30 дней, %", "MVRV биткоина",
                                               "USDT.D к своей средней за 200 дней", "Доля альткоинов: изменение за 90 дней, п.п.", "Синхронность рынка: все монеты ходят вместе (30 дней)",
                                               "Транзакции биткоина: месяц к году")
CAND = {
    "биткоин у максимума (до 10%) и его доля падает быстрее 3 п.п. за 90 дней": lambda B: (B[ATH] < 10) & (B[BTCD] < -3),
    "биткоин у максимума и рекордно спокоен (волатильность ниже 1,6%)": lambda B: (B[ATH] < 10) & (B[VOL] < 1.6),
    "биткоин у максимума, спокоен и его доля падает": lambda B: (B[ATH] < 10) & (B[VOL] < 2.0) & (B[BTCD] < -1.35),
    "биткоин у максимума, MVRV выше 2 и доля биткоина падает быстрее 3 п.п.": lambda B: (B[ATH] < 10) & (B[MVRV] > 2) & (B[BTCD] < -3),
    "биткоин у максимума и доля альткоинов выросла на 1,5+ п.п. за 90 дней": lambda B: (B[ATH] < 10) & (B[ALT90] > 1.5),
    "доля биткоина падает быстрее 5 п.п. за 90 дней (без условия на максимум)": lambda B: B[BTCD] < -5,
    "биткоин у максимума и USDT.D ниже своей средней на 15%": lambda B: (B[ATH] < 10) & (B[USDT] < 0.85),
    "биткоин у максимума (без других условий) — для сравнения": lambda B: B[ATH] < 10,
}


def main(pkl):
    A = pd.read_pickle(pkl)
    B = A[A.coin == "BTC"]
    B = B[~B.index.duplicated()]
    alts = A[A.coin != "BTC"]
    base = alts["_f90"].median()
    print(f"обычный день: альткоин через 90 дней — медиана {base:.0f}%, вырос в {(alts['_f90'] > 0).mean() * 100:.0f}% случаев\n")
    for name, f in CAND.items():
        on = f(B).fillna(False)
        days = B.index[on.values]
        if not len(days):
            print(name, "— не срабатывал\n")
            continue
        # эпизоды: дни сигнала, разделённые паузой больше 45 дней
        eps, cur = [], [days[0]]
        for d in days[1:]:
            if (d - cur[-1]).days > 45:
                eps.append(cur)
                cur = []
            cur.append(d)
        eps.append(cur)
        hit = alts[alts.index.isin(days) & alts["_f90"].notna()]
        print(f"{name}\n  дней {len(days)}, эпизодов {len(eps)}; альткоины через 90 дней: медиана {hit['_f90'].median():.0f}%, ниже в {(hit['_f90'] < 0).mean() * 100:.0f}% случаев; "
              f"биткоин: медиана {B.loc[B.index.isin(days), '_f90'].median():.0f}%")
        for e in eps:
            h = alts[alts.index.isin(e) & alts["_f90"].notna()]
            b = B.loc[B.index.isin(e), "_f90"]
            tail = f"альты {h['_f90'].median():.0f}% (ниже в {(h['_f90'] < 0).mean() * 100:.0f}%), биткоин {b.median():.0f}%" if len(h) else "исход ещё неизвестен"
            print(f"    {e[0].date()} … {e[-1].date()} ({len(e)} дн.): {tail}")
        print()


if __name__ == "__main__":
    main(sys.argv[1])
