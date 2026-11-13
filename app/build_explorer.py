"""Собирает отдельную страницу с бэктестом по списку тикеров (тот же модуль, что в приложении).

Запуск: python3 app/build_explorer.py <куда сохранить .html>
"""
import json
import os
import sys

import engine

HERE = os.path.dirname(os.path.abspath(__file__))

# (тикер Yahoo, подпись, тип из Yahoo, группа)
TICKERS = [
    ("BTC-USD", "BTC", "CRYPTOCURRENCY", "Крипта"), ("ETH-USD", "ETH", "CRYPTOCURRENCY", "Крипта"),
    ("SOL-USD", "SOL", "CRYPTOCURRENCY", "Крипта"), ("ZEC-USD", "ZEC", "CRYPTOCURRENCY", "Крипта"),
    ("HYPE32196-USD", "HYPE", "CRYPTOCURRENCY", "Крипта"),
    ("DOGE-USD", "DOGE", "CRYPTOCURRENCY", "Мемкоины"), ("PEPE24478-USD", "PEPE", "CRYPTOCURRENCY", "Мемкоины"),
    ("SHIB-USD", "SHIB", "CRYPTOCURRENCY", "Мемкоины"), ("BONK-USD", "BONK", "CRYPTOCURRENCY", "Мемкоины"),
    ("WIF-USD", "WIF", "CRYPTOCURRENCY", "Мемкоины"), ("FARTCOIN-USD", "FARTCOIN", "CRYPTOCURRENCY", "Мемкоины"),
    ("PUMP36507-USD", "PUMP", "CRYPTOCURRENCY", "Мемкоины"), ("USELESS36828-USD", "USELESS", "CRYPTOCURRENCY", "Мемкоины"),
    ("SPY", "SPY", "ETF", "Акции"), ("QQQ", "QQQ", "ETF", "Акции"), ("AAPL", "AAPL", "EQUITY", "Акции"),
    ("NVDA", "NVDA", "EQUITY", "Акции"), ("^TA125.TA", "TA-125", "INDEX", "Акции"),
    ("GC=F", "Золото", "FUTURE", "Металлы"), ("SI=F", "Серебро", "FUTURE", "Металлы"),
]

PAGE = r"""<title>Бэктест DCA-стратегий</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
  /* Одна колонка на телефоне; на широком экране слева список стратегий, справа график выбранной. */
  :root {
    --bg: #F3F3EF; --surface: #FFFFFF; --text: #0D0E10; --mute: #7E848C; --faint: #D9DAD6;
    --line: rgba(13, 14, 16, 0.08); --accent: #0D0E10;
    --sans: ui-rounded, "SF Pro Rounded", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) { --bg: #0A0B0D; --surface: #141619; --text: #F5F6F7; --mute: #8A9199; --faint: #2A2E33;
      --line: rgba(255, 255, 255, 0.08); --accent: #F5F6F7; color-scheme: dark; }
  }
  :root[data-theme="dark"] { --bg: #0A0B0D; --surface: #141619; --text: #F5F6F7; --mute: #8A9199; --faint: #2A2E33;
    --line: rgba(255, 255, 255, 0.08); --accent: #F5F6F7; color-scheme: dark; }
  * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
  body { background: var(--bg); color: var(--text); font: 16px/1.35 var(--sans); -webkit-font-smoothing: antialiased;
         padding-block: 24px 48px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); }
  button { font: inherit; color: inherit; background: none; border: 0; padding: 0; cursor: pointer; }
  button:focus-visible, input:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
  .wrap { max-width: 1080px; margin: 0 auto; }
  h1 { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; margin: 0; text-wrap: balance; }
  .lead { color: var(--mute); font-weight: 600; margin: 6px 0 0; max-width: 62ch; }
  .groups { display: flex; flex-direction: column; gap: 10px; margin: 22px 0 6px; }
  .group { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .group span { width: 86px; color: var(--mute); font-size: 12px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; }
  .tk { padding: 8px 14px; border-radius: 999px; background: var(--surface); font-weight: 750; font-size: 15px; }
  .tk.on { background: var(--text); color: var(--bg); }
  .unit { display: inline-flex; align-items: center; gap: 8px; color: var(--mute); font-weight: 700; margin-top: 12px; }
  .unit input { width: 84px; font: inherit; font-weight: 800; color: var(--text); background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 7px 10px; }
  .main { display: grid; grid-template-columns: minmax(0, 1fr); gap: 16px; margin-top: 18px; align-items: start; }
  .card { background: var(--surface); border-radius: 22px; padding: 6px 18px 14px; min-width: 0; }
  .card.detail { padding: 14px 18px 20px; }
  .tname { font-size: 13px; font-weight: 750; letter-spacing: .05em; text-transform: uppercase; color: var(--mute); padding-top: 14px; }
  @media (min-width: 880px) { .main { grid-template-columns: 380px minmax(0, 1fr); } }
</style>
<div class="wrap">
  <h1>Бэктест DCA-стратегий</h1>
  <p class="lead">Выберите актив и стратегию. График показывает, когда стратегия покупала и продавала и сколько она заработала против обычного DCA.</p>
  <div class="groups" id="groups"></div>
  <label class="unit" for="unit">×1 = $ <input id="unit" type="number" min="1" step="1" value="10" inputmode="decimal"></label>
  <div class="main"><div class="card"><div class="tname" id="tname"></div><div id="list"></div></div><div class="card detail" id="detail"></div></div>
</div>
<script>__EXPLORER__</script>
<script>
const DATA = __DATA__;
const state = { sym: DATA[0].symbol, period: "all", code: null, unit: 10 };
const byKey = Object.fromEntries(DATA.map((d) => [d.symbol, d]));
function draw() {
  const h = byKey[state.sym];
  if (!h.strategies.some((s) => s.code === state.code)) state.code = (h.strategies[1] || h.strategies[0]).code;
  const groups = {};
  DATA.forEach((d) => (groups[d.group] = groups[d.group] || []).push(d));
  document.getElementById("groups").innerHTML = Object.entries(groups).map(([g, items]) =>
    `<div class="group"><span>${g}</span>${items.map((d) => `<button class="tk ${d.symbol === state.sym ? "on" : ""}" data-sym="${d.symbol}">${d.title}</button>`).join("")}</div>`).join("");
  document.querySelectorAll("[data-sym]").forEach((b) => b.addEventListener("click", () => { state.sym = b.dataset.sym; draw(); }));
  document.getElementById("tname").textContent = h.title + " · стратегии";
  const opts = { period: state.period, active: state.code, unit: state.unit, onPeriod: (p) => { state.period = p; draw(); } };
  Explorer.list(document.getElementById("list"), h, { ...opts, onOpen: (c) => { state.code = c; draw();
    if (window.innerWidth < 880) document.getElementById("detail").scrollIntoView({ behavior: "smooth", block: "start" }); } });
  Explorer.detail(document.getElementById("detail"), h, state.code, opts);
}
document.getElementById("unit").addEventListener("change", (e) => { const v = Number(e.target.value); if (v > 0) { state.unit = v; draw(); } });
let rt; window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(draw, 150); });
draw();
</script>
"""


def main(out):
    items = []
    for sym, title, qt, group in TICKERS:
        try:
            s = dict(engine.series(sym, engine.kind_of(sym, qt)))
        except Exception as e:  # noqa: BLE001
            print(f"{sym}: пропуск ({e})")
            continue
        s.update({"title": title, "group": group})
        items.append(s)
        print(f"{title}: {len(s['t'])} дней, стратегий {len(s['strategies'])}")
    js = open(os.path.join(HERE, "web", "explorer.js"), encoding="utf-8").read()
    html = PAGE.replace("__EXPLORER__", js).replace("__DATA__", json.dumps(items, ensure_ascii=False, separators=(",", ":")))
    with open(out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"{out}: {os.path.getsize(out) // 1024} КБ")


if __name__ == "__main__":
    main(sys.argv[1])
