"""Собирает приложение одной страницей без сервера — для публикации артефактом.

Интерфейс тот же (web/index.html и web/explorer.js), вместо сервера — web/standalone.js. Цены, история и сигналы
по монетам встраиваются в страницу на момент сборки, поэтому страницу надо пересобирать, чтобы сигналы были свежими.

Запуск: python3 app/build_app_artifact.py <куда.html>
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import engine  # noqa: E402

COINS = [("BTC-USD", "Bitcoin", "btc"), ("ETH-USD", "Ethereum", "alt"), ("SOL-USD", "Solana", "alt"), ("DOGE-USD", "Dogecoin", "alt"), ("XRP-USD", "XRP", "alt"),
         ("BNB-USD", "BNB", "alt"), ("PEPE24478-USD", "Pepe", "alt"), ("HYPE32196-USD", "Hyperliquid", "alt"), ("ADA-USD", "Cardano", "alt"), ("LINK-USD", "Chainlink", "alt"),
         ("PUMP36507-USD", "Pump.fun", "alt"), ("ENA-USD", "Ethena", "alt"), ("ZEC-USD", "Zcash", "alt")]
KEEP = ("dca", "quiet", "merged", "sma200", "rsi", "fng", "usdt")


def main(out):
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
    snap = {"as_of": max(c["h"]["as_of"] for c in coins.values()), "coins": coins}
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
