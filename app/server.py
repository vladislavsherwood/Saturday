"""DCA-помощник: API и мини-приложение Telegram.

Запуск:  uvicorn server:app --host 0.0.0.0 --port 8000   (из папки app)

Переменные окружения:
  BOT_TOKEN — токен бота Telegram. Если задан, приложение открывается только из Telegram.
  OWNER_ID  — Telegram ID владельца. Если не задан, владельцем становится первый вошедший.
  DCA_DB    — путь к файлу базы (по умолчанию app/dca.db).
  SETUP_CODE — одноразовый код первой настройки на сервере. Пока он задан, а токена бота нет, приложение закрыто,
               и открывается только страница /setup?code=…, где владелец сам вводит токен бота и ключ Claude.
  DCA_SECRETS — файл, куда страница настройки сохраняет эти ключи (по умолчанию app/secrets.env, права 600).
  PUBLIC_URL — адрес приложения в интернете; нужен, чтобы после настройки прописать кнопку приложения в боте.
  DCA_REFRESH — 0, чтобы не обновлять рыночные ряды для объединённой стратегии в фоне (по умолчанию 1).
"""
import hashlib
import hmac
import json
import os
import sqlite3
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from urllib.parse import parse_qsl

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse
from pydantic import BaseModel

import data
import engine

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get("DCA_DB", os.path.join(HERE, "dca.db"))
SECRETS = os.environ.get("DCA_SECRETS", os.path.join(HERE, "secrets.env"))
SETUP_CODE = os.environ.get("SETUP_CODE", "")
PUBLIC_URL = os.environ.get("PUBLIC_URL", "").rstrip("/")
if os.path.exists(SECRETS):                       # ключи, введённые владельцем на странице настройки
    for line in open(SECRETS):
        k, _, v = line.strip().partition("=")
        if k and v and not os.environ.get(k):
            os.environ[k] = v
BOT_TOKEN = os.environ.get("BOT_TOKEN", "")
OWNER_ID = os.environ.get("OWNER_ID", "")

app = FastAPI(title="DCA", docs_url=None, redoc_url=None)
pool = ThreadPoolExecutor(8)


def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    with db() as con:
        con.executescript("""
        create table if not exists tickers(
            symbol text primary key, name text, kind text, strategy text, unit real, pos integer);
        create table if not exists settings(key text primary key, value text);
        create table if not exists purchases(
            id integer primary key autoincrement, day text, symbol text, amount real, price real, mult real);
        create index if not exists purchases_day on purchases(day);
        """)
        cols = [r[1] for r in con.execute("pragma table_info(purchases)")]          # журнал сделок: покупки и продажи с количеством
        for name, kind in (("side", "text default 'buy'"), ("qty", "real"), ("fee", "real default 0"), ("source", "text default 'plan'")):
            if name not in cols:
                con.execute(f"alter table purchases add column {name} {kind}")
        con.execute("update purchases set qty = amount / price where qty is null and price > 0")
        con.execute("insert or ignore into settings values('unit', '10')")
        if not con.execute("select 1 from settings where key='main_quiet'").fetchone():      # «Тихая вершина» — основная стратегия для всей крипты
            if "strategy" in [r[1] for r in con.execute("pragma table_info(tickers)")]:
                con.execute("update tickers set strategy='quiet' where kind in ('btc', 'alt')")
            con.execute("insert into settings values('main_quiet', '1')")
        if "since" not in [r[1] for r in con.execute("pragma table_info(tickers)")]:      # с какого дня ведётся резерв объединённой стратегии
            con.execute("alter table tickers add column since text")
            con.execute("update tickers set since=?", (datetime.now(timezone.utc).strftime("%Y-%m-%d"),))
            # прежние стратегии по умолчанию у криптовалют заменяются объединённой; выбранные вручную не трогаются
            con.execute("update tickers set strategy='merged' where (kind='btc' and strategy='mvrv') or (kind='alt' and strategy='coin_btc')")


init_db()


def refresh_market():
    """Раз в сутки обновляет рыночные ряды для маркеров вершин и дна: без них объединённая стратегия считает по вчерашним данным."""
    import market_extra
    while True:
        try:
            if not os.path.exists(engine.EXTRA) or time.time() - os.path.getmtime(engine.EXTRA) > 20 * 3600:
                market_extra.main(engine.EXTRA)
                engine._cache.clear()
        except Exception as e:  # noqa: BLE001
            print("обновление рыночных рядов:", e)
        time.sleep(3600)


if os.environ.get("DCA_REFRESH", "1") == "1":
    threading.Thread(target=refresh_market, daemon=True).start()


def setting(key, default=None):
    with db() as con:
        row = con.execute("select value from settings where key=?", (key,)).fetchone()
    return row["value"] if row else default


def auth(x_tg_init_data: str = Header(default="")):
    """Проверка подписи Telegram. Без BOT_TOKEN и без SETUP_CODE — режим разработки, вход открыт."""
    if not BOT_TOKEN:
        if SETUP_CODE:
            raise HTTPException(503, "Приложение ещё не настроено: откройте страницу настройки")
        return 0
    pairs = dict(parse_qsl(x_tg_init_data, keep_blank_values=True))
    given = pairs.pop("hash", "")
    check = "\n".join(f"{k}={v}" for k, v in sorted(pairs.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    want = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    if not given or not hmac.compare_digest(given, want):
        raise HTTPException(401, "Откройте приложение из Telegram")
    if time.time() - int(pairs.get("auth_date", "0")) > 86400:
        raise HTTPException(401, "Сессия устарела, откройте приложение заново")
    uid = str(json.loads(pairs.get("user", "{}")).get("id", ""))
    owner = OWNER_ID or setting("owner")
    if not owner:
        with db() as con:
            con.execute("insert or replace into settings values('owner', ?)", (uid,))
        owner = uid
    if uid != owner:
        raise HTTPException(403, "Это личное приложение")
    return uid


def today():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@app.get("/healthz")
def healthz():
    return {"ok": True, "configured": bool(BOT_TOKEN), "scan": bool(os.environ.get("ANTHROPIC_API_KEY"))}


SETUP_PAGE = """<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Настройка DCA</title><style>body{font:16px/1.45 system-ui,sans-serif;max-width:520px;margin:0 auto;padding:28px 18px;background:#F3F3EF;color:#0D0E10}
h1{font-size:26px;margin:0 0 6px}p{color:#5b616b;margin:6px 0 14px}label{display:block;font-weight:650;margin:18px 0 6px}
input{width:100%;box-sizing:border-box;font:inherit;padding:13px 14px;border-radius:14px;border:1px solid #d9dad6;background:#fff}
button{margin-top:22px;width:100%;font:inherit;font-weight:700;padding:15px;border:0;border-radius:16px;background:#0D0E10;color:#fff}
.msg{padding:13px 14px;border-radius:14px;background:#fff;margin:14px 0}.bad{color:#b3261e}.ok{color:#0a7d42}small{color:#5b616b}</style>
<h1>Настройка приложения</h1>__BODY__</html>"""
SETUP_FORM = """<p>Ключи вводятся один раз и хранятся только на этом сервере.</p>__MSG__
<form method="post"><input type="hidden" name="code" value="__CODE__">
<label for="bot">Токен бота Telegram</label><input id="bot" name="bot" autocomplete="off" required placeholder="123456789:AA…">
<small>Создайте бота у @BotFather командой /newbot и вставьте токен, который он пришлёт.</small>
<label for="key">Ключ Claude для чтения скриншотов — необязательно</label><input id="key" name="key" autocomplete="off" placeholder="sk-ant-…">
<small>Без него сделки вводятся вручную. Ключ берётся в console.anthropic.com.</small>
<button>Сохранить</button></form>"""


def setup_page(body):
    return HTMLResponse(SETUP_PAGE.replace("__BODY__", body), headers={"Cache-Control": "no-store"})


@app.get("/setup")
def setup_form(code: str = ""):
    if BOT_TOKEN:
        return setup_page('<div class="msg ok">Приложение уже настроено. Откройте его из своего бота в Telegram.</div>')
    if not SETUP_CODE or not hmac.compare_digest(code, SETUP_CODE):
        return setup_page('<div class="msg bad">Неверный код настройки.</div>')
    return setup_page(SETUP_FORM.replace("__MSG__", "").replace("__CODE__", code))


@app.post("/setup")
async def setup_save(request: Request):
    """Первая настройка: владелец сам вводит токен бота и ключ Claude. Токен проверяется у Telegram, боту ставится кнопка приложения."""
    global BOT_TOKEN
    form = dict(parse_qsl((await request.body()).decode(), keep_blank_values=True))
    code, bot, key = form.get("code", ""), form.get("bot", "").strip(), form.get("key", "").strip()
    if BOT_TOKEN:
        return setup_page('<div class="msg ok">Приложение уже настроено.</div>')
    if not SETUP_CODE or not hmac.compare_digest(code, SETUP_CODE):
        return setup_page('<div class="msg bad">Неверный код настройки.</div>')
    back = lambda text: setup_page(SETUP_FORM.replace("__MSG__", f'<div class="msg bad">{text}</div>').replace("__CODE__", code))  # noqa: E731
    import re
    import urllib.request
    if not re.fullmatch(r"\d{5,}:[\w-]{30,}", bot):
        return back("Это не похоже на токен бота. Он выглядит как 123456789:AA… и приходит от @BotFather.")

    def tg(method, payload=None):
        req = urllib.request.Request(f"https://api.telegram.org/bot{bot}/{method}", data=json.dumps(payload or {}).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return json.load(r)
    try:
        me = tg("getMe")["result"]
    except Exception:  # noqa: BLE001
        return back("Telegram не принял этот токен. Проверьте, что он скопирован целиком.")
    button = ""
    if PUBLIC_URL:
        try:
            tg("setChatMenuButton", {"menu_button": {"type": "web_app", "text": "DCA", "web_app": {"url": PUBLIC_URL + "/"}}})
            button = " Кнопка «DCA» в меню бота уже настроена."
        except Exception:  # noqa: BLE001
            button = f" Кнопку приложения поставить не удалось — задайте её у @BotFather: /setmenubutton, адрес {PUBLIC_URL}/"
    os.makedirs(os.path.dirname(SECRETS) or ".", exist_ok=True)
    with open(os.open(SECRETS, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600), "w") as f:
        f.write(f"BOT_TOKEN={bot}\n" + (f"ANTHROPIC_API_KEY={key}\n" if key else ""))
    BOT_TOKEN = bot
    if key:
        os.environ["ANTHROPIC_API_KEY"] = key
    return setup_page(f'<div class="msg ok">Готово. Бот @{me.get("username", "")} подключён.{button}</div>'
                      '<p>Откройте бота в Telegram и нажмите кнопку «DCA». Владельцем станет тот, кто войдёт первым, — войдите сразу.</p>')


@app.get("/")
def index():
    return FileResponse(os.path.join(HERE, "web", "index.html"), headers={"Cache-Control": "no-cache"})


def ledger(con):
    """Итоги журнала сделок по тикерам: куплено и продано в долларах, количество монет, себестоимость остатка, сделки за сегодня."""
    day, out = today(), {}
    for r in con.execute("select symbol, side, amount, qty, day from purchases order by day, id"):
        o = out.setdefault(r["symbol"], {"bought": 0.0, "sold": 0.0, "qty": 0.0, "cost": 0.0, "today": 0.0, "n": 0})
        amount, qty = abs(r["amount"] or 0), r["qty"] or 0
        if r["side"] == "sell":
            o["sold"] += amount
            if o["qty"] > 0:                      # продажа уменьшает себестоимость в той же доле, что и остаток
                o["cost"] *= max(0.0, 1 - qty / o["qty"])
            o["qty"] = max(0.0, o["qty"] - qty)
        else:
            o["bought"] += amount
            o["cost"] += amount
            o["qty"] += qty
        o["n"] += 1
        if r["day"] == day:
            o["today"] += -amount if r["side"] == "sell" else amount
    return out


@app.get("/api/today")
def api_today(_=Depends(auth)):
    unit = float(setting("unit", "10"))
    day = today()
    with db() as con:
        tickers = [dict(r) for r in con.execute("select * from tickers order by pos, symbol")]
        books = ledger(con)

    def one(t):
        bk = books.get(t["symbol"], {"bought": 0.0, "sold": 0.0, "qty": 0.0, "cost": 0.0, "today": 0.0, "n": 0})
        item = {"symbol": t["symbol"], "name": t["name"], "kind": t["kind"], "strategy": t["strategy"],
                "strategy_name": engine.STRATEGIES.get(t["strategy"], ("?",))[0],
                "unit": t["unit"] or unit, "custom_unit": t["unit"], "allowed": engine.allowed(t["kind"]),
                "done": abs(bk["today"]) if bk["today"] else 0, "done_side": "sell" if bk["today"] < 0 else "buy", "invested": bk["bought"] - bk["sold"], "trades": bk["n"]}
        try:
            d = engine.decide(t["symbol"], t["kind"], t["strategy"])
            item.update(d)
            price, qty = d["price"], max(0.0, bk["qty"])
            item.update({"qty": qty, "holding": round(qty * price, 2), "avg_price": round(bk["cost"] / qty, 8) if qty > 1e-12 else None, "cost": round(bk["cost"], 2),
                         "profit": round(qty * price + bk["sold"] - bk["bought"], 2)})
            item["amount"] = round(item["unit"] * d["mult"], 2)
            if d.get("reserve_mode"):
                # резерв — это взносы с дня добавления тикера, которые ещё не потрачены, плюс всё вырученное с продаж; считается по реальным сделкам
                days = (datetime.strptime(day, "%Y-%m-%d") - datetime.strptime(t["since"] or day, "%Y-%m-%d")).days + 1
                reserve = max(0.0, item["unit"] * days - bk["bought"] + bk["sold"])
                a, before = d["plan_today"], max(0.0, reserve - item["unit"])
                if a < 0:
                    amount = a * qty * price
                else:
                    amount = min(reserve, item["unit"] + (a - 1) * before) if a > 0 else 0.0
                item.update({"reserve": round(reserve, 2), "amount": round(amount, 2), "share": -a if a < 0 else (a - 1 if a > 1 else 0)})
                if a < 0 and abs(amount) < 0.005:
                    item.update({"mult": 0, "amount": 0, "nothing_to_sell": True})
        except Exception as e:  # noqa: BLE001
            item.update({"mult": None, "amount": 0, "error": f"нет данных: {e}"})
        return item

    items = list(pool.map(one, tickers))
    todo = [i for i in items if not i["done"]]
    return {"day": day, "unit": unit, "items": items,
            "total": round(sum(i["amount"] for i in items if i["amount"] > 0), 2),
            "left": round(sum(i["amount"] for i in todo if i["amount"] > 0), 2),
            "sell_left": round(-sum(i["amount"] for i in todo if i["amount"] < 0), 2),
            "reserve": round(sum(i.get("reserve") or 0 for i in items), 2), "holding": round(sum(i.get("holding") or 0 for i in items), 2),
            "scan": bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")),
            "strategies": {k: {"name": v[0], "about": v[1]} for k, v in engine.STRATEGIES.items()}}


@app.get("/api/history/{symbol}")
def api_history(symbol: str, _=Depends(auth)):
    """Цены и решения всех стратегий по тикеру — бэктест считается на экране."""
    with db() as con:
        row = con.execute("select * from tickers where symbol=?", (symbol,)).fetchone()
    if not row:
        raise HTTPException(404, "Нет такого тикера")
    try:
        return engine.series(symbol, row["kind"])
    except Exception as e:  # noqa: BLE001
        raise HTTPException(502, f"Нет данных: {e}")


@app.get("/explorer.js")
def explorer_js():
    return FileResponse(os.path.join(HERE, "web", "explorer.js"), media_type="application/javascript",
                        headers={"Cache-Control": "no-cache"})


@app.get("/api/search")
def api_search(q: str, _=Depends(auth)):
    q = q.strip()
    if len(q) < 1:
        return []
    return data.search(q)


class NewTicker(BaseModel):
    symbol: str
    name: str = ""
    kind: str = ""


@app.post("/api/tickers")
def add_ticker(t: NewTicker, _=Depends(auth)):
    symbol = t.symbol.strip().upper()
    try:
        close, _, _ = data.history(symbol)
    except Exception:  # noqa: BLE001
        raise HTTPException(404, f"Не нашёл цены для {symbol}")
    if len(close) < 30:
        raise HTTPException(400, f"У {symbol} слишком мало истории цен")
    kind = engine.kind_of(symbol, t.kind)
    with db() as con:
        pos = con.execute("select coalesce(max(pos), 0) + 1 from tickers").fetchone()[0]
        con.execute("insert or ignore into tickers(symbol, name, kind, strategy, unit, pos, since) values(?,?,?,?,?,?,?)",
                    (symbol, t.name or symbol, kind, engine.default_strategy(kind), None, pos, today()))
    return {"ok": True}


class Patch(BaseModel):
    strategy: str | None = None
    unit: float | None = None
    reset_unit: bool = False


@app.patch("/api/tickers/{symbol}")
def patch_ticker(symbol: str, p: Patch, _=Depends(auth)):
    with db() as con:
        row = con.execute("select * from tickers where symbol=?", (symbol,)).fetchone()
        if not row:
            raise HTTPException(404, "Нет такого тикера")
        if p.strategy:
            if p.strategy not in engine.allowed(row["kind"]):
                raise HTTPException(400, "Эта стратегия не подходит для этого актива")
            con.execute("update tickers set strategy=? where symbol=?", (p.strategy, symbol))
        if p.reset_unit:
            con.execute("update tickers set unit=null where symbol=?", (symbol,))
        elif p.unit is not None:
            if not 0 < p.unit <= 100000:
                raise HTTPException(400, "Сумма должна быть больше нуля")
            con.execute("update tickers set unit=? where symbol=?", (p.unit, symbol))
    return {"ok": True}


@app.delete("/api/tickers/{symbol}")
def delete_ticker(symbol: str, _=Depends(auth)):
    with db() as con:
        con.execute("delete from tickers where symbol=?", (symbol,))
    return {"ok": True}


class Unit(BaseModel):
    unit: float


@app.post("/api/unit")
def set_unit(u: Unit, _=Depends(auth)):
    if not 0 < u.unit <= 100000:
        raise HTTPException(400, "Сумма должна быть больше нуля")
    with db() as con:
        con.execute("insert or replace into settings values('unit', ?)", (str(u.unit),))
    return {"ok": True}


class Trade(BaseModel):
    symbol: str
    side: str = "buy"                 # buy | sell
    amount: float                     # сумма сделки в долларах, всегда положительная
    qty: float | None = None          # сколько монет; если не задано — считается из суммы и цены
    price: float | None = None
    fee: float = 0
    day: str | None = None            # ГГГГ-ММ-ДД, по умолчанию сегодня
    source: str = "manual"            # plan — отмечено по плану, scan — со скриншота, manual — введено руками


@app.post("/api/trades")
def add_trade(t: Trade, _=Depends(auth)):
    if t.side not in ("buy", "sell") or not t.amount > 0:
        raise HTTPException(400, "Нужна сторона сделки и сумма больше нуля")
    day = t.day or today()
    try:
        datetime.strptime(day, "%Y-%m-%d")
    except ValueError:
        raise HTTPException(400, "Дата должна быть в виде ГГГГ-ММ-ДД")
    with db() as con:
        if not con.execute("select 1 from tickers where symbol=?", (t.symbol,)).fetchone():
            raise HTTPException(404, "Сначала добавьте этот тикер")
        qty = t.qty if t.qty and t.qty > 0 else (t.amount / t.price if t.price and t.price > 0 else None)
        price = t.price if t.price and t.price > 0 else (t.amount / qty if qty else None)
        if not qty:
            raise HTTPException(400, "Нужно количество монет или цена")
        con.execute("insert into purchases(day, symbol, amount, price, mult, side, qty, fee, source) values(?,?,?,?,?,?,?,?,?)",
                    (day, t.symbol, t.amount, price, None, t.side, qty, t.fee or 0, t.source))
        since = con.execute("select since from tickers where symbol=?", (t.symbol,)).fetchone()["since"]
        if not since or day < since:           # сделка раньше дня добавления тикера — учёт резерва начинается с неё
            con.execute("update tickers set since=? where symbol=?", (day, t.symbol))
    return {"ok": True}


@app.get("/api/trades")
def list_trades(symbol: str, _=Depends(auth)):
    with db() as con:
        return [dict(r) for r in con.execute("select id, day, side, amount, qty, price, fee, source from purchases where symbol=? order by day desc, id desc limit 200", (symbol,))]


@app.delete("/api/trades/{trade_id}")
def delete_trade(trade_id: int, _=Depends(auth)):
    with db() as con:
        con.execute("delete from purchases where id=?", (trade_id,))
    return {"ok": True}


class Shot(BaseModel):
    image: str                        # картинка в base64 (без префикса data:)
    media_type: str = "image/jpeg"


@app.post("/api/scan")
def scan_trade(shot: Shot, _=Depends(auth)):
    """Читает скриншот сделки и возвращает черновик записи. В журнал ничего не пишет — запись делает /api/trades после подтверждения."""
    import scan
    with db() as con:
        tickers = [r["symbol"] for r in con.execute("select symbol from tickers")]
    try:
        return scan.read(shot.image, shot.media_type, tickers, today())
    except scan.ScanError as e:
        raise HTTPException(e.status, str(e))


class Done(BaseModel):
    symbol: str
    amount: float
    price: float | None = None
    mult: float | None = None


@app.post("/api/done")
def mark_done(d: Done, _=Depends(auth)):
    """Отметить сделку дня как выполненную по плану: по цене из приложения. Отрицательная сумма — продажа."""
    if not d.price or not d.amount:
        raise HTTPException(400, "Нет суммы или цены")
    return add_trade(Trade(symbol=d.symbol, side="sell" if d.amount < 0 else "buy", amount=abs(d.amount), price=d.price, source="plan"), _)


@app.delete("/api/done/{symbol}")
def undo_done(symbol: str, _=Depends(auth)):
    with db() as con:
        con.execute("delete from purchases where day=? and symbol=?", (today(), symbol))
    return {"ok": True}
