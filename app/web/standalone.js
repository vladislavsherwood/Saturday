/* Приложение без сервера — для артефакта. Заменяет вызовы /api/… локальной логикой:
   цены, сигналы и история по монетам встроены в страницу (SNAP), сделки и настройки хранятся в базе артефакта
   (личный раздел зрителя; если базы нет — в памяти браузера), скриншоты сделок читает Claude через возможность страницы. */
const mem = { unit: 10, tickers: null, trades: [] };
let col = null, sampler = null;
const LS = "dca-app-v1", todayStr = () => new Date().toISOString().slice(0, 10);
const DEFAULTS = ["BTC-USD", "ETH-USD", "SOL-USD", "HYPE32196-USD", "PUMP36507-USD", "DOGE-USD", "PEPE24478-USD", "ENA-USD", "ZEC-USD"];
const coin = (s) => SNAP.coins[s];
const fresh = (symbol) => { const k = coin(symbol), codes = k.h.strategies.map((x) => x.code); return { symbol, name: k.name, kind: k.kind, strategy: codes.includes("quiet") ? "quiet" : "dca", unit: null, since: todayStr() }; };

async function boot() {
  try {
    if (window.claude && window.claude.use) {
      const [db, user, s] = await Promise.all([claude.use("db"), claude.use("user"), claude.use("sample")]);
      sampler = s;
      if (db && user) col = db.collection("data/users/" + (await user.id()));
    }
  } catch (e) { col = null; }
  try {
    if (col) {
      const snap = await Promise.race([col.get(), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 10000))]);
      for (const d of snap.docs) { const v = d.data(); if (!v) continue; if (d.id === "cfg") { mem.unit = v.unit || 10; mem.tickers = v.tickers || null; } else if (d.id.startsWith("t")) mem.trades.push({ ...v, id: +d.id.slice(1) }); }
    } else { const v = JSON.parse(localStorage.getItem(LS) || "null"); if (v) Object.assign(mem, v); }
  } catch (e) { /* пустое или недоступное хранилище — работаем с набором по умолчанию */ }
  if (!mem.tickers) mem.tickers = DEFAULTS.filter(coin).map(fresh);
  mem.tickers = mem.tickers.filter((t) => coin(t.symbol));
}
async function saveCfg() {
  if (col) await col.doc("cfg").set({ unit: mem.unit, tickers: mem.tickers });
  else try { localStorage.setItem(LS, JSON.stringify(mem)); } catch (e) {}
}
async function storeTrade(t) { mem.trades.push(t); if (col) { const { id, ...row } = t; await col.doc("t" + id).set(row); } else await saveCfg(); }
async function dropTrades(ids) { mem.trades = mem.trades.filter((t) => !ids.includes(t.id)); if (col) for (const id of ids) await col.doc("t" + id).delete(); else await saveCfg(); }

function ledger(symbol) {
  const o = { bought: 0, sold: 0, qty: 0, cost: 0, today: 0, n: 0 }, day = todayStr();
  for (const r of mem.trades.filter((t) => t.symbol === symbol).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.id - b.id))) {
    if (r.side === "sell") { o.sold += r.amount; if (o.qty > 0) o.cost *= Math.max(0, 1 - r.qty / o.qty); o.qty = Math.max(0, o.qty - r.qty); }
    else { o.bought += r.amount; o.cost += r.amount; o.qty += r.qty; }
    o.n++; if (r.day === day) o.today += r.side === "sell" ? -r.amount : r.amount;
  }
  return o;
}
const r2 = (x) => Math.round(x * 100) / 100;
function today() {
  const day = todayStr(), names = {};
  const items = mem.tickers.map((t) => {
    const k = coin(t.symbol), h = k.h, st = h.strategies.find((x) => x.code === t.strategy) || h.strategies[0], bk = ledger(t.symbol), unit = t.unit || mem.unit;
    h.strategies.forEach((x) => (names[x.code] = { name: x.name, about: x.about }));
    const i = { symbol: t.symbol, name: t.name, kind: t.kind, strategy: st.code, strategy_name: st.name, unit, custom_unit: t.unit, allowed: h.strategies.map((x) => x.code),
      done: bk.today ? Math.abs(bk.today) : 0, done_side: bk.today < 0 ? "sell" : "buy", invested: bk.bought - bk.sold, trades: bk.n,
      mult: st.today, price: h.price, currency: h.currency, as_of: h.as_of, label: st.label, edges: st.edges, value: st.value, action: st.action, reserve_mode: !!st.plan, plan_today: st.plan_today, rule: st.rule, state: st.state };
    const qty = Math.max(0, bk.qty);
    Object.assign(i, { qty, holding: r2(qty * h.price), avg_price: qty > 1e-12 ? bk.cost / qty : null, cost: r2(bk.cost), profit: r2(qty * h.price + bk.sold - bk.bought), amount: r2(unit * st.today) });
    if (i.reserve_mode) {
      const days = Math.round((Date.parse(day) - Date.parse(t.since || day)) / 864e5) + 1, reserve = Math.max(0, unit * days - bk.bought + bk.sold), a = st.plan_today, before = Math.max(0, reserve - unit);
      const amount = a < 0 ? a * qty * h.price : a > 0 ? Math.min(reserve, unit + (a - 1) * before) : 0;
      Object.assign(i, { reserve: r2(reserve), amount: r2(amount) });
      if (a < 0 && Math.abs(amount) < 0.005) Object.assign(i, { mult: 0, amount: 0, nothing_to_sell: true });
    }
    return i;
  });
  const todo = items.filter((i) => !i.done), sum = (a, f) => r2(a.reduce((s, i) => s + f(i), 0));
  return { day, unit: mem.unit, items, total: sum(items, (i) => Math.max(0, i.amount)), left: sum(todo, (i) => Math.max(0, i.amount)), sell_left: sum(todo, (i) => Math.max(0, -i.amount)),
    reserve: sum(items, (i) => i.reserve || 0), holding: sum(items, (i) => i.holding || 0), scan: !!sampler, strategies: names };
}
const fail = (text) => { throw new Error(text); };
async function addTrade(b) {
  if (!["buy", "sell"].includes(b.side) || !(b.amount > 0)) fail("Нужна сторона сделки и сумма больше нуля");
  const t = mem.tickers.find((x) => x.symbol === b.symbol) || fail("Сначала добавьте этот тикер"), day = b.day || todayStr();
  const qty = b.qty > 0 ? b.qty : b.price > 0 ? b.amount / b.price : fail("Нужно количество монет или цена"), price = b.price > 0 ? b.price : b.amount / qty;
  await storeTrade({ id: Date.now(), day, symbol: b.symbol, side: b.side, amount: b.amount, qty, price, fee: b.fee || 0, source: b.source || "manual" });
  if (!t.since || day < t.since) { t.since = day; await saveCfg(); }
  return { ok: true };
}
const SCAN = `На картинке — скриншот из приложения биржи, брокера или кошелька. Найди на нём одну совершённую сделку покупки или продажи актива и перепиши её данные.
Правила:
- Бери только то, что написано на картинке. Чего нет — ставь null, не вычисляй и не догадывайся. Исключение: дату можно собрать из написанного дня и месяца, взяв год из сегодняшней даты.
- Сумма — в долларах. USDT, USDC и USD считай долларами один к одному. Если сумма в другой валюте, оставь amount_usd и price пустыми, запиши валюту в currency и скажи об этом в note.
- Приведи числа к обычному виду: десятичная точка, без разделителей разрядов.
- Если на экране неисполненная заявка, пополнение, вывод или перевод, а не сделка, — found = false и объяснение в note.
- Если сделок несколько, возьми самую верхнюю и напиши об этом в note.
- symbol выбери из списка тикеров пользователя, если актив сделки там есть; иначе null.
Тикеры пользователя: TICKERS
Сегодня: TODAY
Ответь только объектом JSON с полями: found (boolean), side ("buy" | "sell" | null), asset (string | null), symbol (string | null), amount_usd (number | null), quantity (number | null), price (number | null), fee_usd (number | null), date ("ГГГГ-ММ-ДД" | null), currency (string | null), note (строка по-русски, одно короткое предложение или пусто).`;
async function scan(b) {
  if (!sampler) fail("Распознавание недоступно — введите сделку вручную");
  const bin = atob(b.image), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  let d;
  try { d = await sampler.json(SCAN.replace("TICKERS", mem.tickers.map((t) => t.symbol).join(", ")).replace("TODAY", todayStr()), { images: [new Blob([bytes], { type: b.media_type || "image/jpeg" })], cache: false }); }
  catch (e) { fail(e && e.code === "not_granted" ? "Вы не разрешили странице обращаться к Claude — введите сделку вручную" : e && e.code === "rate_limited" ? "Слишком много запросов — попробуйте через минуту" : e && e.code === "images_unavailable" ? "Здесь нельзя отправить картинку — введите сделку вручную" : "Не удалось прочитать скриншот — введите сделку вручную"); }
  if (!d || typeof d !== "object") fail("Не удалось разобрать скриншот — введите сделку вручную");
  const n = (x) => (typeof x === "number" && isFinite(x) && x > 0 ? x : null), o = { found: !!d.found, side: ["buy", "sell"].includes(d.side) ? d.side : null, asset: d.asset || null, symbol: mem.tickers.some((t) => t.symbol === d.symbol) ? d.symbol : null,
    amount_usd: n(d.amount_usd), quantity: n(d.quantity), price: n(d.price), fee_usd: n(d.fee_usd), date: /^\d{4}-\d\d-\d\d$/.test(d.date || "") ? d.date : null, currency: d.currency || null, note: String(d.note || ""), computed: [] };
  if (o.amount_usd == null && o.quantity && o.price) { o.amount_usd = r2(o.quantity * o.price); o.computed.push("amount_usd"); }
  if (o.quantity == null && o.amount_usd && o.price) { o.quantity = o.amount_usd / o.price; o.computed.push("quantity"); }
  if (o.price == null && o.amount_usd && o.quantity) { o.price = o.amount_usd / o.quantity; o.computed.push("price"); }
  return o;
}
async function api(path, opts = {}) {
  const m = (opts.method || "GET").toUpperCase(), b = opts.body ? JSON.parse(opts.body) : {}, [p, q] = path.split("?"), seg = p.split("/").filter(Boolean).slice(1).map(decodeURIComponent), arg = new URLSearchParams(q || "");
  const tick = (s) => mem.tickers.find((x) => x.symbol === s) || fail("Нет такого тикера");
  if (seg[0] === "today") return today();
  if (seg[0] === "history") return (coin(seg[1]) || fail("Нет данных по этому тикеру")).h;
  if (seg[0] === "search") { const s = (arg.get("q") || "").trim().toLowerCase(); return Object.entries(SNAP.coins).filter(([k, v]) => !s || k.toLowerCase().includes(s) || v.name.toLowerCase().includes(s)).map(([k, v]) => ({ symbol: k, name: v.name, kind: "CRYPTOCURRENCY" })); }
  if (seg[0] === "tickers" && m === "POST") { if (!coin(b.symbol)) fail("В этой версии доступны только встроенные монеты"); if (!mem.tickers.some((t) => t.symbol === b.symbol)) { mem.tickers.push(fresh(b.symbol)); await saveCfg(); } return { ok: true }; }
  if (seg[0] === "tickers" && m === "PATCH") { const t = tick(seg[1]); if (b.strategy) t.strategy = b.strategy; if (b.reset_unit) t.unit = null; else if (b.unit != null) { if (!(b.unit > 0)) fail("Сумма должна быть больше нуля"); t.unit = b.unit; } await saveCfg(); return { ok: true }; }
  if (seg[0] === "tickers" && m === "DELETE") { mem.tickers = mem.tickers.filter((t) => t.symbol !== seg[1]); await saveCfg(); return { ok: true }; }
  if (seg[0] === "unit") { if (!(b.unit > 0)) fail("Сумма должна быть больше нуля"); mem.unit = b.unit; await saveCfg(); return { ok: true }; }
  if (seg[0] === "done" && m === "POST") { if (!b.price || !b.amount) fail("Нет суммы или цены"); return addTrade({ symbol: b.symbol, side: b.amount < 0 ? "sell" : "buy", amount: Math.abs(b.amount), price: b.price, source: "plan" }); }
  if (seg[0] === "done" && m === "DELETE") { await dropTrades(mem.trades.filter((t) => t.symbol === seg[1] && t.day === todayStr()).map((t) => t.id)); return { ok: true }; }
  if (seg[0] === "trades" && m === "GET") return mem.trades.filter((t) => t.symbol === arg.get("symbol")).sort((a, b2) => (a.day < b2.day ? 1 : a.day > b2.day ? -1 : b2.id - a.id));
  if (seg[0] === "trades" && m === "POST") return addTrade(b);
  if (seg[0] === "trades" && m === "DELETE") { await dropTrades([+seg[1]]); return { ok: true }; }
  if (seg[0] === "scan") return scan(b);
  fail("Неизвестный запрос");
}
// подтверждение удаления — своим окном: системные диалоги в артефакте не показываются
function ask(q, go) {
  openSheet(`<div class="title" style="font-size:26px">${esc(q)}</div><div class="row2" style="margin-top:22px"><button class="btn" id="askNo">Отмена</button><button class="btn main" id="askYes">Удалить</button></div>`);
  $("askNo").addEventListener("click", closeSheet); $("askYes").addEventListener("click", () => { closeSheet(); go(); });
}
