"""DCA-помощник: API и мини-приложение Telegram.

Запуск:  uvicorn server:app --host 0.0.0.0 --port 8000   (из папки app)

Переменные окружения:
  BOT_TOKEN — токен бота Telegram. Если задан, приложение открывается только из Telegram.
  OWNER_ID  — Telegram ID владельца. Если не задан, владельцем становится первый вошедший.
  DCA_DB    — путь к файлу базы (по умолчанию app/dca.db).
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

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel

import data
import engine

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.environ.get("DCA_DB", os.path.join(HERE, "dca.db"))
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
    """Проверка подписи Telegram. Без BOT_TOKEN — режим разработки, вход открыт."""
    if not BOT_TOKEN:
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


@app.get("/")
def index():
    return FileResponse(os.path.join(HERE, "web", "index.html"), headers={"Cache-Control": "no-cache"})


@app.get("/api/today")
def api_today(_=Depends(auth)):
    unit = float(setting("unit", "10"))
    day = today()
    with db() as con:
        tickers = [dict(r) for r in con.execute("select * from tickers order by pos, symbol")]
        done = {r["symbol"]: r["amount"] for r in con.execute(
            "select symbol, sum(amount) amount from purchases where day=? group by symbol", (day,))}
        totals = {r["symbol"]: r["amount"] for r in con.execute(
            "select symbol, sum(amount) amount from purchases group by symbol")}

    def one(t):
        item = {"symbol": t["symbol"], "name": t["name"], "kind": t["kind"], "strategy": t["strategy"],
                "strategy_name": engine.STRATEGIES.get(t["strategy"], ("?",))[0],
                "unit": t["unit"] or unit, "custom_unit": t["unit"],
                "allowed": engine.allowed(t["kind"]),
                "done": done.get(t["symbol"], 0), "invested": totals.get(t["symbol"], 0)}
        try:
            d = engine.decide(t["symbol"], t["kind"], t["strategy"])
            item.update(d)
            item["amount"] = round(item["unit"] * d["mult"], 2)
            if d.get("reserve_mode"):                       # объединённая стратегия: сумма зависит от накопленного резерва и позиции
                item.update(engine.position(t["symbol"], t["kind"], t["since"] or day, item["unit"], t["strategy"]))
                if d["mult"] < 0 and abs(item["amount"]) < 0.005:      # продавать пока нечего: взнос просто идёт в резерв
                    item.update({"mult": 0, "amount": 0, "action": item["action"] + " — позиции ещё нет, взнос идёт в резерв"})
        except Exception as e:  # noqa: BLE001
            item.update({"mult": None, "amount": 0, "error": f"нет данных: {e}"})
        return item

    items = list(pool.map(one, tickers))
    left = sum(i["amount"] for i in items if not i["done"] and i["amount"] > 0)
    return {"day": day, "unit": unit, "items": items,
            "total": round(sum(i["amount"] for i in items if i["amount"] > 0), 2),
            "left": round(left, 2),
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


class Done(BaseModel):
    symbol: str
    amount: float
    price: float | None = None
    mult: float | None = None


@app.post("/api/done")
def mark_done(d: Done, _=Depends(auth)):
    with db() as con:
        con.execute("insert into purchases(day, symbol, amount, price, mult) values(?,?,?,?,?)",
                    (today(), d.symbol, d.amount, d.price, d.mult))
    return {"ok": True}


@app.delete("/api/done/{symbol}")
def undo_done(symbol: str, _=Depends(auth)):
    with db() as con:
        con.execute("delete from purchases where day=? and symbol=?", (today(), symbol))
    return {"ok": True}
