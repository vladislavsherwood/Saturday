"""Пересборка страницы memes6 (экзамен: SHIB, PEPE, BONK, WIF, FLOKI, FARTCOIN) на точных ценах Binance (data.BINANCE_PRICES).

Как build_builder.py с набором list:shib,pepe,bonk,wif,floki,fartcoin, но история обрезается по дату CUT включительно,
чтобы новая выгрузка отличалась от старой (Yahoo, по 2026-11-12) только ценами, а не лишними днями.
Запуск: python3 app/pepefix_build.py <куда .html> [CUT=2026-11-12]
Затем:  node app/agent_export.js <папка> <папка>/agent_data memes6
"""
import os
import sys

import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import data  # noqa: E402
import build_builder  # noqa: E402

CUT = pd.Timestamp(sys.argv[2] if len(sys.argv) > 2 else "2026-11-12")
_ohlc = data.ohlc


def ohlc_cut(symbol):
    df = _ohlc(symbol)
    return df[df.index <= CUT]


data.ohlc = ohlc_cut
if __name__ == "__main__":
    build_builder.main(sys.argv[1], "list:shib,pepe,bonk,wif,floki,fartcoin")
