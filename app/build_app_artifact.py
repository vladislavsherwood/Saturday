"""Собирает приложение одной страницей без сервера — для публикации артефактом.

Интерфейс тот же (web/index.html и web/explorer.js), вместо сервера — web/standalone.js. Цены, история и сигналы
по монетам встраиваются в страницу на момент сборки, поэтому страницу надо пересобирать, чтобы сигналы были свежими.

Запуск: python3 app/build_app_artifact.py <куда.html>
"""
import json
import os
import numpy as np
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import engine  # noqa: E402

COINS = [("BTC-USD", "Bitcoin", "btc"), ("ETH-USD", "Ethereum", "alt"), ("SOL-USD", "Solana", "alt"), ("DOGE-USD", "Dogecoin", "alt"), ("XRP-USD", "XRP", "alt"),
         ("BNB-USD", "BNB", "alt"), ("PEPE24478-USD", "Pepe", "alt"), ("HYPE32196-USD", "Hyperliquid", "alt"), ("ADA-USD", "Cardano", "alt"), ("LINK-USD", "Chainlink", "alt"),
         ("PUMP36507-USD", "Pump.fun", "alt"), ("ENA-USD", "Ethena", "alt"), ("ZEC-USD", "Zcash", "alt"), ("USELESS36828-USD", "Useless", "alt"),
         ("XMR-USD", "Monero", "alt"), ("LIT39125-USD", "Lighter", "alt"), ("PENGU34466-USD", "Pudgy Penguins", "alt"), ("FARTCOIN-USD", "Fartcoin", "alt")]
KEEP = ("dca",)   # старые исследовательские стратегии (main, quiet, merged, sma200, rsi, fng, usdt) из приложения убраны


def build_snap():
    """Данные дня для приложения (SNAP): цены, свечи, планы стратегий по дням и combo4 на сегодня по монетам COINS. Используют build_snap.py и main()."""
    coins = {}
    for symbol, name, kind in COINS:
        try:
            h = dict(engine.series(symbol, kind))
        except Exception as e:  # noqa: BLE001
            print(symbol, "пропущен:", e)
            continue
        h["strategies"] = [s for s in h["strategies"] if s["code"] in KEEP]
        coins[symbol] = {"name": name, "kind": kind, "h": h}
        print(f"{symbol}: {len(h['t'])} дней по {h['as_of']}, стратегий {len(h['strategies'])}")
    # combo4 (итоговая): план с отложенной паникой из app_combo4 — та же логика, что проверена в бэктестах и марже
    import app_combo4 as C4
    lst = [(s, c["kind"]) for s, c in coins.items()]
    R6 = C4.compute(lst, "combo6")
    B0 = next(iter(R6.values()))["B"] if R6 else None
    R = C4.compute(lst, "combo5", B=B0) if R6 else {}
    R4 = C4.compute(lst, "combo4", B=B0) if R6 else {}
    cache = {}
    for s, c in coins.items():
        if s not in R:
            continue
        B, k = R[s]["B"], R[s]["k"]
        def ind(name, i, B=B, k=k):
            if not name or i is None or i < 0: return None
            if name not in cache: cache[name] = B.series(name)
            v = cache[name][i, k]
            return None if not np.isfinite(v) else float(v)
        st = C4.strategy(s, c["h"], R[s], ind)
        st4 = C4.strategy(s, c["h"], R4[s], ind) if s in R4 else None
        # какая лучше на истории монеты (к DCA, худший из сдвигов исполнения 0/1): combo5 с лимитками на фитиль или combo4
        h = c["h"]; lo = h.get("l") or h["c"]; wk = dict(st["wick"], t=h["t"])
        e5 = min(C4.edge(h["c"], lo, st["plan"], wk, lag) for lag in (0, 1))
        e4 = min(C4.edge(h["c"], lo, st4["plan"], None, lag) for lag in (0, 1)) if st4 else None
        st["vs"] = {"combo5": round(e5, 1), "combo4": None if e4 is None else round(e4, 1), "better": e4 is None or e5 > e4}
        st6 = C4.strategy(s, c["h"], R6[s], ind) if s in R6 else None
        c["h"]["strategies"].insert(0, st)
        if st4: c["h"]["strategies"].insert(1, st4)
        if st6:
            c["h"]["strategies"].insert(0, st6)
            print(f"{s}: combo6 сегодня {st6['plan_today']:+.3f} — {st6['action']}")
        print(f"{s}: {st['code']} сегодня {st['plan_today']:+.3f} — {st['action']} | {st['label']} | история к DCA: combo5 {e5:+.0f}% · combo4 {e4:+.0f}% → {'combo5' if st['vs']['better'] else 'combo4'}")
    return {"as_of": max(c["h"]["as_of"] for c in coins.values()), "coins": coins}


def main(out):
    snap = build_snap()
    page = open(os.path.join(HERE, "web", "index.html"), encoding="utf-8").read()
    css = re.search(r"<style>(.*?)</style>", page, re.S).group(1)
    body = re.search(r"<body>(.*?)<script>", page, re.S).group(1)
    js = re.search(r"<body>.*?<script>(.*)</script>\s*</body>", page, re.S).group(1)
    # вместо сервера — локальная логика; вместо системных диалогов — своё окно подтверждения
    js, n = re.subn(r"async function api\(path, opts = \{\}\) \{.*?\n\}\n", "", js, count=1, flags=re.S)
    assert n == 1
    js, n = re.subn(r'if \(tg && tg\.showConfirm && initData\) tg\.showConfirm\((.+?), \(ok\) => ok && go\(\)\); else if \(confirm\(.+?\)\) go\(\);', r"ask(\1, go);", js)
    assert n == 2, n
    assert js.rstrip().endswith("load();")
    js = js.rstrip()[:-len("load();")] + """boot().then(load);
// данные встроены в страницу при сборке: говорим, на какой день сигналы
const _render = render;
render = function () { _render(); const d = new Date(SNAP.as_of + "T00:00:00Z").toLocaleDateString("ru-RU", { day: "numeric", month: "long", timeZone: "UTC" });
  $("list").insertAdjacentHTML("beforeend", `<div class="note" style="text-align:center;margin-top:16px">Цены и сигналы по закрытию ${d}. Сделки хранятся ${col ? "в вашем личном разделе этой страницы" : "только в этом браузере"}.</div>`); };
"""
    extra = """
  /* артефакт: боковые поля с учётом системных панелей телефона */
  body { padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  .dock { right: calc(18px + env(safe-area-inset-right, 0px)); } .toast { top: calc(14px + env(safe-area-inset-top, 0px)); }
"""
    html = ('<title>DCA помощник</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n<style>' + css + extra + "</style>\n" + body
            + "<script>const SNAP = " + json.dumps(snap, ensure_ascii=False, separators=(",", ":")) + ";</script>\n"
            + "<script>" + open(os.path.join(HERE, "web", "explorer.js"), encoding="utf-8").read() + "</script>\n"
            + "<script>" + open(os.path.join(HERE, "web", "standalone.js"), encoding="utf-8").read() + "\n" + js + "</script>\n")
    open(out, "w", encoding="utf-8").write(html)
    print(out, round(len(html.encode()) / 1024), "КБ")


if __name__ == "__main__":
    main(sys.argv[1])
