"""imp6: дневные закрытия Binance (data-api.binance.vision, публичные рыночные данные, полная точность) для монет, у которых цена Yahoo
округлена до 1e-6: SHIB, PEPE, BONK, FLOKI. Пишет found/imp6_prices.json {монета: {дата: закрытие}} и kPEPE Hyperliquid для сверки."""
import json, os, sys, time, urllib.request
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "exec"))
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "found", "imp6_prices.json")
SYM = {"SHIB": "SHIBUSDT", "PEPE": "PEPEUSDT", "BONK": "BONKUSDT", "FLOKI": "FLOKIUSDT"}


def klines(sym):
    out, st = {}, 0
    while True:
        u = f"https://data-api.binance.vision/api/v3/klines?symbol={sym}&interval=1d&limit=1000&startTime={st}"
        rows = json.load(urllib.request.urlopen(u, timeout=30))
        for r in rows:
            if r[6] < time.time() * 1000:
                out[time.strftime("%Y-%m-%d", time.gmtime(r[0] / 1000))] = [float(r[4]), float(r[3]), float(r[2])]
        if len(rows) < 1000: break
        st = rows[-1][0] + 1
    return out


if __name__ == "__main__":
    R = {k: klines(s) for k, s in SYM.items()}
    import hl_info as H
    R["PEPE_HL"] = {d: [c / 1000] for d, c in H.daily_closes("kPEPE", days=1500).items()}
    json.dump(R, open(OUT, "w"))
    for k, v in R.items(): print(k, len(v), min(v), max(v))
