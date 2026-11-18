/* Приложение без сервера — для артефакта. Заменяет вызовы /api/… локальной логикой:
   цены, сигналы и история по монетам встроены в страницу (SNAP), сделки и настройки хранятся в базе артефакта
   (личный раздел зрителя; если базы нет — в памяти браузера), скриншоты сделок читает Claude через возможность страницы. */
const mem = { unit: 10, tickers: null, trades: [] };
let col = null, sampler = null, scanImg = null;   // scanImg: false — этот просмотр не умеет отправлять картинки Claude
const LS = "dca-app-v1", todayStr = () => new Date().toISOString().slice(0, 10);
const DEFAULTS = ["BTC-USD", "ETH-USD", "SOL-USD", "HYPE32196-USD", "PUMP36507-USD", "DOGE-USD", "PEPE24478-USD", "ENA-USD", "ZEC-USD"];
const coin = (s) => SNAP.coins[s];
const modeOf = (t) => t.mode || (t.margin ? "margin" : "spot");   // режим исполнения монеты: спот / маржа на споте / перпы
const fresh = (symbol) => { const k = coin(symbol), codes = k.h.strategies.map((x) => x.code); return { symbol, name: k.name, kind: k.kind, strategy: codes.includes("combo4") ? "combo4" : codes.includes("main") ? "main" : codes.includes("quiet") ? "quiet" : "dca", unit: null, since: todayStr() }; };

async function boot() {
  try {
    if (window.claude && window.claude.use) {
      const [db, user, s] = await Promise.all([claude.use("db"), claude.use("user"), claude.use("sample")]);
      sampler = s;
      if (s && s.limits) { try { const L = await s.limits(); scanImg = L && L.images ? L.images : false; } catch (e) { scanImg = null; } }
      if (db && user) col = db.collection("data/users/" + (await user.id()));
    }
  } catch (e) { col = null; }
  try {
    if (col) {
      const snap = await Promise.race([col.get(), new Promise((_, no) => setTimeout(() => no(new Error("timeout")), 10000))]);
      for (const d of snap.docs) { const raw = d.data(); if (!raw) continue; const v = JSON.parse(JSON.stringify(raw));   // копия: данные из хранилища нельзя менять на месте
        if (d.id === "cfg") { mem.unit = v.unit || 10; mem.tickers = v.tickers || null; mem.mig = v.mig || null; mem.mig2 = v.mig2 || null; mem.mig3 = v.mig3 || null; mem.mig4 = v.mig4 || null; mem.mig5 = v.mig5 || null; mem.mig6 = v.mig6 || null; mem.mig7 = v.mig7 || null; mem.mig8 = v.mig8 || null; mem.mig9 = v.mig9 || null; mem.mig10 = v.mig10 || null; } else if (d.id.startsWith("t")) mem.trades.push({ ...v, id: +d.id.slice(1) }); }
    } else { const v = JSON.parse(localStorage.getItem(LS) || "null"); if (v) Object.assign(mem, v); }
  } catch (e) { /* пустое или недоступное хранилище — работаем с набором по умолчанию */ }
  if (!mem.tickers) mem.tickers = DEFAULTS.filter(coin).map(fresh);
  mem.tickers = mem.tickers.filter((t) => coin(t.symbol));
  // один раз: монеты на прежней основной стратегии переходят на новую основную (Тихая вершина + ликвидации)
  if (mem.mig !== "main2") {
    for (const t of mem.tickers) if (t.strategy === "quiet" && coin(t.symbol).h.strategies.some((x) => x.code === "main")) t.strategy = "main";
    mem.mig = "main2";
    try { await saveCfg(); } catch (e) {}
  }
  // один раз (ноябрь 2026, по просьбе пользователя): все монеты переходят на итоговую стратегию combo4
  if (mem.mig !== "combo4") {
    for (const t of mem.tickers) if (coin(t.symbol).h.strategies.some((x) => x.code === "combo4")) t.strategy = "combo4";
    mem.mig = "combo4";
    try { await saveCfg(); } catch (e) {}
  }
  // один раз (по просьбе пользователя): добавить USELESS в список монет — с той же суммой, что у большинства монет
  if (!mem.mig2 && coin("USELESS36828-USD") && !mem.tickers.some((t) => t.symbol === "USELESS36828-USD")) {
    const cnt = {}; for (const t of mem.tickers) cnt[t.unit] = (cnt[t.unit] || 0) + 1;
    const unit = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
    mem.tickers.push({ ...fresh("USELESS36828-USD"), unit: unit && unit !== "null" ? +unit : null });
    mem.mig2 = "useless";
    try { await saveCfg(); } catch (e) {}
  }
  // один раз (по просьбе пользователя): добавить Monero ($2 в день) и Lighter ($1 в день)
  if (mem.mig3 !== "xmr-lit") {
    for (const [sym, unit] of [["XMR-USD", 2], ["LIT39125-USD", 1]]) if (coin(sym) && !mem.tickers.some((t) => t.symbol === sym)) mem.tickers.push({ ...fresh(sym), unit });
    mem.mig3 = "xmr-lit";
    try { await saveCfg(); } catch (e) {}
  }
  // один раз (по просьбе пользователя, 15.11.2026): суммы по монетам из research/alloc_report.md и старт инвестиций с 15 ноября — резерв с нуля
  if (mem.mig4 !== "alloc-2026-11-15") {
    const U = { "ETH-USD": 3, "SOL-USD": 3, "BTC-USD": 2, "XMR-USD": 2, "DOGE-USD": 2, "PEPE24478-USD": 2, "ENA-USD": 2, "ZEC-USD": 2,
      "HYPE32196-USD": 1, "PUMP36507-USD": 1, "USELESS36828-USD": 1, "LIT39125-USD": 1 };
    for (const t of mem.tickers) { if (U[t.symbol] != null) t.unit = U[t.symbol]; t.since = "2026-11-15"; }
    mem.mig4 = "alloc-2026-11-15";
    try { await saveCfg(); } catch (e) {}
  }
  // один раз (по просьбе пользователя): USELESS, XMR, ZEC — перпы на Bybit (спота там нет)
  if (mem.mig5 !== "perp-3") {
    for (const t of mem.tickers) if (["USELESS36828-USD", "XMR-USD", "ZEC-USD"].includes(t.symbol)) { t.mode = "perp"; t.margin = false; }
    mem.mig5 = "perp-3";
    try { await saveCfg(); } catch (e) {}
  }
  // один раз (по просьбе пользователя): добавить PENGU — $2 в день, старт с сегодняшнего дня
  if (mem.mig6 !== "pengu") {
    if (coin("PENGU34466-USD") && !mem.tickers.some((t) => t.symbol === "PENGU34466-USD")) mem.tickers.push({ ...fresh("PENGU34466-USD"), unit: 2 });
    mem.mig6 = "pengu";
    try { await saveCfg(); } catch (e) {}
  }
  // один раз (по просьбе пользователя): добавить FARTCOIN — $1 в день, только перп на Bybit
  if (mem.mig7 !== "fartcoin") {
    if (coin("FARTCOIN-USD") && !mem.tickers.some((t) => t.symbol === "FARTCOIN-USD")) mem.tickers.push({ ...fresh("FARTCOIN-USD"), unit: 1, mode: "perp" });
    mem.mig7 = "fartcoin";
    try { await saveCfg(); } catch (e) {}
  }
  // один раз (по просьбе пользователя): PUMP — $2 в день
  if (mem.mig8 !== "pump2") {
    for (const t of mem.tickers) if (t.symbol === "PUMP36507-USD") t.unit = 2;
    mem.mig8 = "pump2";
    try { await saveCfg(); } catch (e) {}
  }
  // один раз (по просьбе пользователя): Lighter — $2 в день
  if (mem.mig9 !== "lit2") {
    for (const t of mem.tickers) if (t.symbol === "LIT39125-USD") t.unit = 2;
    mem.mig9 = "lit2";
    try { await saveCfg(); } catch (e) {}
  }
  // один раз (по просьбе пользователя): HYPE — $2 в день
  if (mem.mig10 !== "hype2") {
    for (const t of mem.tickers) if (t.symbol === "HYPE32196-USD") t.unit = 2;
    mem.mig10 = "hype2";
    try { await saveCfg(); } catch (e) {}
  }
}
async function saveCfg() {
  if (col) await col.doc("cfg").set({ unit: mem.unit, tickers: mem.tickers, mig: mem.mig || null, mig2: mem.mig2 || null, mig3: mem.mig3 || null, mig4: mem.mig4 || null, mig5: mem.mig5 || null, mig6: mem.mig6 || null, mig7: mem.mig7 || null, mig8: mem.mig8 || null, mig9: mem.mig9 || null, mig10: mem.mig10 || null });
  else try { localStorage.setItem(LS, JSON.stringify(mem)); } catch (e) {}
}
async function storeTrade(t) { mem.trades.push(t); if (col) { const { id, ...row } = t; await col.doc("t" + id).set(row); } else await saveCfg(); }
async function dropTrades(ids) { mem.trades = mem.trades.filter((t) => !ids.includes(t.id)); if (col) for (const id of ids) await col.doc("t" + id).delete(); else await saveCfg(); }

function ledger(symbol, since) {
  const o = { bought: 0, sold: 0, qty: 0, cost: 0, today: 0, n: 0, boughtSince: 0, soldSince: 0, borrowedSince: 0, repaidSince: 0, boughtBefore: 0, soldBefore: 0 }, day = todayStr();
  for (const r of mem.trades.filter((t) => t.symbol === symbol).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.id - b.id))) {
    if (since && r.day < since) { if (r.side === "sell") o.soldBefore += r.amount; else o.boughtBefore += r.amount; }
    if (since && r.day >= since) { if (r.side === "sell") { o.soldSince += r.amount; o.repaidSince += r.repaid || 0; } else { o.boughtSince += r.amount; o.borrowedSince += r.borrowed || 0; if (!o.lastBuy || r.day > o.lastBuy) o.lastBuy = r.day; } }   // резерв и долг — с даты старта монеты
    if (r.side === "sell") { o.sold += r.amount; if (o.qty > 0) o.cost *= Math.max(0, 1 - r.qty / o.qty); o.qty = Math.max(0, o.qty - r.qty); }
    else { o.bought += r.amount; o.cost += r.amount; o.qty += r.qty; }
    o.n++; if (r.day === day) o.today += r.side === "sell" ? -r.amount : r.amount;
  }
  return o;
}
const r2 = (x) => Math.round(x * 100) / 100;
// сколько дней подряд обычный взнос не куплен: дни после последней покупки (или со старта монеты) до сегодня, в которые план говорил
// покупать. День продажи не считается: по стратегии его взнос остаётся в резерве. Действие дня — план по данным предыдущего дня.
function skipped(t, bk, st, h, day) {
  const dn = (x) => Math.round(Date.parse(x) / 864e5), end = dn(day), from = bk.lastBuy ? dn(bk.lastBuy) + 1 : t.since ? dn(t.since) : end;
  let n = 0;
  for (let d = Math.max(from, end - 366); d < end; d++) { const k = h.t.lastIndexOf(d), i = k < 0 ? h.t.length : k; if (i > 0 && st.plan[Math.min(i, st.plan.length) - 1] > 0) n++; }
  return n;
}
function today() {
  const day = todayStr(), names = {};
  const items = mem.tickers.map((t) => {
    const k = coin(t.symbol), h = k.h, st = h.strategies.find((x) => x.code === t.strategy) || h.strategies[0], bk = ledger(t.symbol, t.since), unit = t.unit || mem.unit;
    h.strategies.forEach((x) => (names[x.code] = { name: x.name, about: x.about }));
    const i = { symbol: t.symbol, name: t.name, kind: t.kind, strategy: st.code, strategy_name: st.name, unit, custom_unit: t.unit, allowed: h.strategies.map((x) => x.code),
      done: bk.today ? Math.abs(bk.today) : 0, done_side: bk.today < 0 ? "sell" : "buy", invested: bk.bought - bk.sold, trades: bk.n,
      mult: st.today, price: h.price, currency: h.currency, as_of: h.as_of, label: st.label, edges: st.edges, value: st.value, action: st.action, reserve_mode: !!st.plan, plan_today: st.plan_today, rule: st.rule, state: st.state };
    const qty = Math.max(0, bk.qty);
    Object.assign(i, { qty, holding: r2(qty * h.price), avg_price: qty > 1e-12 ? bk.cost / qty : null, cost: r2(bk.cost), profit: r2(qty * h.price + bk.sold - bk.bought), amount: r2(unit * st.today) });
    if (i.reserve_mode) {
      // резерв = взносы − свои деньги в покупках + выручка без погашения долга; долг = занятое − погашенное
      const days = Math.round((Date.parse(day) - Date.parse(t.since || day)) / 864e5) + 1, debt = Math.max(0, bk.borrowedSince - bk.repaidSince);
      const reserve = Math.max(0, unit * days - (bk.boughtSince - bk.borrowedSince) + (bk.soldSince - bk.repaidSince)), before = Math.max(0, reserve - unit);
      let a = st.plan_today, amount, borrowed = 0, repaid = 0, wait = null, minOpen = null, small = false, missed = 0, missedAmt = 0;
      const mode = modeOf(t);
      if (mode !== "spot" && st.m) {   // маржа или перпы: доли схемы с плечом, сделки дна/паники/продаж 50/50 на два дня
        const m = st.m;
        if (mode === "perp") {   // перпы Bybit: открытие от max($5, 0,01 монеты), взнос копится до минимума; продажа — шагом 0,01 монеты
          minOpen = Math.max(5, 0.01 * h.price);
          const pd = bk.lastBuy ? Math.round((Date.parse(day) - Date.parse(bk.lastBuy)) / 864e5) : days, pending = Math.min(reserve, unit * Math.max(1, pd)), base = Math.max(0, reserve - pending);
          if (m.sf > 0) { const sq = m.sf * qty >= qty * 0.999 ? qty : Math.floor((m.sf * qty) / 0.01 + 1e-9) * 0.01; a = -m.sf; amount = -sq * h.price; repaid = qty > 0 ? (sq / qty) * debt : 0; small = sq <= 0 && qty > 0; }
          else { const want = pending + m.es * base, own = Math.min(reserve, want); borrowed = want > 0 ? (m.bu * pending + m.bs * base) * own / want : 0; a = 1 + m.es;
            if (own + borrowed < minOpen) { wait = { have: r2(own + borrowed), need: r2(minOpen) }; amount = 0; borrowed = 0; } else amount = own + borrowed; }
        } else if (m.sf > 0) { a = -m.sf; amount = -m.sf * qty * h.price; repaid = m.sf * debt; }
        else { const want = unit + m.es * before, own = Math.min(reserve, want); borrowed = want > 0 ? (m.bu * unit + m.bs * before) * own / want : 0; amount = own + borrowed; a = 1 + m.es; }
      } else if (a > 0) {
        // спот: обычные взносы, не купленные в дни, когда план говорил покупать, копятся и идут в сегодняшнюю покупку целиком
        // (как взнос у перпа до минимума открытия); доля сигнала считается от остального резерва. Без пропусков — прежняя сумма.
        missed = skipped(t, bk, st, h, day);
        const pending = Math.min(reserve, unit * (1 + missed)), base = Math.max(0, reserve - pending);
        amount = Math.min(reserve, pending + (a - 1) * base); missedAmt = Math.max(0, pending - Math.min(reserve, unit));
        if (missedAmt < 0.005) missed = 0;
      } else amount = a < 0 ? a * qty * h.price : 0;
      Object.assign(i, { reserve: r2(reserve), amount: r2(amount), plan_today: a, mode, margin: mode !== "spot" && !!st.m, has_margin: !!st.m, borrowed: r2(borrowed), repaid: r2(repaid), debt: r2(debt),
        lev: mode !== "spot" && st.m ? st.m.lev : 1, wait, min_open: minOpen && r2(minOpen), small_sell: small, missed, missed_amount: r2(missedAmt) });
      // портфель: вложено = взносы с даты старта + чистые покупки до неё; стоимость = позиция + резерв − долг (для перпа — капитал счёта)
      const inv = unit * days + Math.max(0, bk.boughtBefore - bk.soldBefore), val = qty * h.price + reserve - debt;
      Object.assign(i, { invested_total: r2(inv), value: r2(val), pnl: r2(val - inv) });
      if (a < 0 && Math.abs(amount) < 0.005) Object.assign(i, { mult: 0, amount: 0, nothing_to_sell: true });
    }
    return i;
  });
  const todo = items.filter((i) => !i.done), sum = (a, f) => r2(a.reduce((s, i) => s + f(i), 0));
  return { day, unit: mem.unit, items, total: sum(items, (i) => Math.max(0, i.amount)), left: sum(todo, (i) => Math.max(0, i.amount)), sell_left: sum(todo, (i) => Math.max(0, -i.amount)),
    reserve: sum(items, (i) => i.reserve || 0), holding: sum(items, (i) => i.holding || 0), scan: !!sampler, strategies: names,
    value: sum(items, (i) => i.value || 0), invested_total: sum(items, (i) => i.invested_total || 0), pnl: sum(items, (i) => i.pnl || 0), debt: sum(items, (i) => i.debt || 0) };
}
// П/У портфеля по дням (свечи): для каждого дня — позиция, резерв и долг по сделкам и взносам; открытие/максимум/минимум/закрытие — по ценам монет дня
function pnlHistory() {
  const dn = (x) => Math.round(Date.parse(x) / 864e5), end = dn(todayStr());
  let start = end;
  for (const t of mem.tickers) if (t.since) start = Math.min(start, dn(t.since));
  for (const r of mem.trades) start = Math.min(start, dn(r.day));
  const P = mem.tickers.map((t) => {
    const H = coin(t.symbol).h, idx = new Map(H.t.map((x, i) => [x, i]));
    return { t, H, idx, unit: t.unit || mem.unit, since: t.since ? dn(t.since) : null, tr: mem.trades.filter((r) => r.symbol === t.symbol).sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.id - b.id)), j: 0,
      qty: 0, bS: 0, sS: 0, brS: 0, rpS: 0, bB: 0, sB: 0, last: null };
  });
  const out = [];
  for (let d = start; d <= end; d++) {
    let o = 0, hi = 0, lo = 0, c = 0, inv = 0, any = false;
    for (const x of P) {
      while (x.j < x.tr.length && dn(x.tr[x.j].day) <= d) { const r = x.tr[x.j++], inS = x.since != null && dn(r.day) >= x.since;
        if (r.side === "sell") { x.qty = Math.max(0, x.qty - r.qty); if (inS) { x.sS += r.amount; x.rpS += r.repaid || 0; } else x.sB += r.amount; }
        else { x.qty += r.qty; if (inS) { x.bS += r.amount; x.brS += r.borrowed || 0; } else x.bB += r.amount; } }
      const i = x.idx.get(d); let po, ph, pl, pc;
      if (i != null) { pc = x.H.c[i]; po = (x.H.o && x.H.o[i]) || pc; ph = (x.H.h && x.H.h[i]) || pc; pl = (x.H.l && x.H.l[i]) || pc; x.last = pc; }
      else if (d === end) { pc = x.H.price || x.last; po = x.last || pc; ph = Math.max(po || 0, pc || 0); pl = Math.min(po || 0, pc || 0); }
      else { pc = po = ph = pl = x.last; }
      if (pc == null) continue;
      const days = x.since != null && d >= x.since ? d - x.since + 1 : 0, contrib = x.unit * days;
      const res = days ? Math.max(0, contrib - (x.bS - x.brS) + (x.sS - x.rpS)) : 0, debt = Math.max(0, x.brS - x.rpS), base = res - debt;
      const i0 = contrib + Math.max(0, x.bB - x.sB);
      if (i0 <= 0 && x.qty <= 0) continue;
      any = true; inv += i0; o += x.qty * po + base; hi += x.qty * ph + base; lo += x.qty * pl + base; c += x.qty * pc + base;
    }
    if (any) out.push({ d, o: r2(o - inv), h: r2(hi - inv), l: r2(lo - inv), c: r2(c - inv), v: r2(c), inv: r2(inv) });
  }
  return out;
}
// историческая доходность стратегии монеты (план из сборки, спот без плеча) против обычного DCA: последний год, 2, 3 года и вся история
function histPerf(symbol) {
  const t = mem.tickers.find((x) => x.symbol === symbol), h = coin(symbol).h, st = h.strategies.find((x) => x.code === (t && t.strategy)) || h.strategies[0], n = h.c.length, unit = (t && t.unit) || mem.unit;
  const run = (a) => { let cash = 0, units = 0, du = 0, inv = 0;
    for (let i = a; i < n; i++) { const p = h.c[i], x = st.plan ? (i > a ? st.plan[i - 1] : 1) : 1, before = cash; cash += unit; inv += unit; du += unit * 0.999 / p;
      if (x < 0) { const amt = -x * units * p; units -= amt / p; cash += amt * 0.999; } else { const amt = Math.min(cash, unit + (x - 1) * before); units += amt * 0.999 / p; cash -= amt; } }
    const pe = h.c[n - 1]; return { inv: r2(inv), val: r2(cash + units * pe), dca: r2(du * pe) }; };
  const out = [];
  for (const [lab, y] of [["1 год", 1], ["2 года", 2], ["3 года", 3], ["вся история", 0]]) {
    const a = y ? n - 365 * y : 0; if (y && a < 0) continue;
    const r = run(Math.max(0, a)); out.push({ lab, y, from: new Date(h.t[Math.max(0, a)] * 864e5).toISOString().slice(0, 10), ...r });
  }
  // устойчивость: старт каждые 30 дней за 3 года — в скольких стратегия лучше DCA и в минусе
  const sts = []; for (let a = Math.max(0, n - 365 * 3); a <= n - 60; a += 30) sts.push(run(a));
  return { unit, rows: out, starts: sts.length, beat: sts.filter((r) => r.val > r.dca).length, loss: sts.filter((r) => r.val < r.inv).length, strategy: st.name };
}
function histDetail(symbol, years) {
  const t = mem.tickers.find((x) => x.symbol === symbol), h = coin(symbol).h, st = h.strategies.find((x) => x.code === (t && t.strategy)) || h.strategies[0], n = h.c.length, unit = (t && t.unit) || mem.unit;
  const a = years ? Math.max(0, n - 365 * years) : 0, fam = st.fam || "";
  let cash = 0, units = 0, du = 0; const tr = [], eq = [], dq = [];
  for (let i = a; i < n; i++) {
    const p = h.c[i], x = st.plan ? (i > a ? st.plan[i - 1] : 1) : 1, f = i > a ? fam[i - 1] || "." : ".", before = cash; cash += unit; du += unit * 0.999 / p;
    if (x < 0) { const amt = -x * units * p; if (amt > 0.005) { const eb = cash + units * p; units -= amt / p; cash += amt * 0.999; tr.push([i - a, -1, r2(amt), f, amt / eb]); } }
    else { const amt = Math.min(cash, unit + (x - 1) * before), eb = cash + units * p; units += amt * 0.999 / p; cash -= amt; if (amt > unit * 1.5) tr.push([i - a, 1, r2(amt - unit), f, (amt - unit) / eb]); }
    eq.push(cash + units * p); dq.push(du * p);
  }
  const cut = (x) => (x ? x.slice(a) : null);
  return { t: h.t.slice(a), c: h.c.slice(a), o: cut(h.o), h: cut(h.h), l: cut(h.l), tr, eq, dq, unit };
}
const fail = (text) => { throw new Error(text); };
async function addTrade(b) {
  if (!["buy", "sell"].includes(b.side) || !(b.amount > 0)) fail("Нужна сторона сделки и сумма больше нуля");
  const t = mem.tickers.find((x) => x.symbol === b.symbol) || fail("Сначала добавьте этот тикер"), day = b.day || todayStr();
  const qty0 = b.qty > 0 ? b.qty : b.price > 0 ? b.amount / b.price : fail("Нужно количество монет или цена"), price = b.price > 0 ? b.price : b.amount / qty0;
  // комиссия: монетой — на счёт приходит меньше монет при покупке (уходит больше при продаже); в долларах — покупка дороже, выручка меньше
  const fc = b.fee_kind === "coin" && b.fee_amount > 0 ? b.fee_amount : 0, fu = b.fee_kind === "usd" && b.fee_amount > 0 ? b.fee_amount : 0;
  const qty = b.side === "buy" ? Math.max(0, qty0 - fc) : qty0 + fc, amount = b.side === "buy" ? b.amount + fu : Math.max(0, b.amount - fu);
  await storeTrade({ id: Date.now(), day, symbol: b.symbol, side: b.side, amount, qty, price, fee: Math.round((fu + fc * price) * 1e4) / 1e4, fee_amount: b.fee_amount || 0, fee_kind: b.fee_kind || null, gross_qty: qty0, gross_amount: b.amount,
    source: b.source || "manual", borrowed: b.borrowed || 0, repaid: b.repaid || 0 });
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
- Комиссию (Fee, Trading fee, Комиссия) перепиши как есть: fee_amount — число, fee_currency — в чём она указана (тикер монеты, например PENGU, или USDT). Если комиссий несколько строк — сложи одинаковые по валюте и возьми основную. quantity — количество из ордера (Traded Qty / Filled Qty) без вычета комиссии.
Тикеры пользователя: TICKERS
Сегодня: TODAY
Ответь только объектом JSON с полями: found (boolean), side ("buy" | "sell" | null), asset (string | null), symbol (string | null), amount_usd (number | null), quantity (number | null), price (number | null), fee_amount (number | null), fee_currency (string | null), date ("ГГГГ-ММ-ДД" | null), currency (string | null), note (строка по-русски, одно короткое предложение или пусто).`;
async function scan(b) {
  if (!sampler) fail("Распознавание недоступно — введите сделку вручную");
  const bin = atob(b.image), bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  let d, raw = "";
  const prompt = SCAN.replace("TICKERS", mem.tickers.map((t) => t.symbol).join(", ")).replace("TODAY", todayStr()), img = new Blob([bytes], { type: b.media_type || "image/jpeg" });
  // ответ берём текстом и разбираем сами: так работает и там, где у страницы нет sample.json
  try { raw = (await sampler(prompt, { images: [img], cache: false })).text || ""; }
  catch (e) { const c = (e && e.code) || "unknown";
    fail(c === "not_granted" ? "Вы не разрешили странице обращаться к Claude — разрешите в запросе или введите сделку вручную"
      : c === "rate_limited" ? "Слишком много запросов или исчерпан лимит Claude — попробуйте позже"
      : c === "images_unavailable" ? "В этом окне нельзя отправить картинку Claude — откройте артефакт в браузере на claude.ai или введите сделку вручную"
      : c === "image_rejected" ? "Claude не принял картинку — попробуйте другой скриншот (PNG или JPEG)"
      : c === "session_expired" ? "Нужно заново войти в Claude"
      : c === "sampling_disabled" || c === "capability_disabled" ? "Claude недоступен для этой страницы в этом окне"
      : c === "refused" ? "Claude отказался читать этот скриншот"
      : "Не удалось прочитать скриншот (" + c + ") — попробуйте ещё раз или введите вручную"); }
  try { d = JSON.parse(raw); } catch (e) { const m = raw.match(/\{[\s\S]*\}/); try { d = m ? JSON.parse(m[0]) : null; } catch (e2) { d = null; } }
  if (!d || typeof d !== "object") fail("Не удалось разобрать ответ по скриншоту — попробуйте ещё раз или введите вручную");
  const n = (x) => (typeof x === "number" && isFinite(x) && x > 0 ? x : null), o = { found: !!d.found, side: ["buy", "sell"].includes(d.side) ? d.side : null, asset: d.asset || null, symbol: mem.tickers.some((t) => t.symbol === d.symbol) ? d.symbol : null,
    amount_usd: n(d.amount_usd), quantity: n(d.quantity), price: n(d.price), fee_amount: n(d.fee_amount), fee_currency: d.fee_currency ? String(d.fee_currency).toUpperCase() : null, date: /^\d{4}-\d\d-\d\d$/.test(d.date || "") ? d.date : null, currency: d.currency || null, note: String(d.note || ""), computed: [] };
  if (o.amount_usd == null && o.quantity && o.price) { o.amount_usd = r2(o.quantity * o.price); o.computed.push("amount_usd"); }
  if (o.quantity == null && o.amount_usd && o.price) { o.quantity = o.amount_usd / o.price; o.computed.push("quantity"); }
  if (o.price == null && o.amount_usd && o.quantity) { o.price = o.amount_usd / o.quantity; o.computed.push("price"); }
  // комиссия: в долларах (USDT/USDC/USD) или монетой сделки
  if (o.fee_amount != null) { const usd = /^(USD|USDT|USDC)$/.test(o.fee_currency || ""); o.fee_kind = usd ? "usd" : "coin"; o.fee_usd = usd ? o.fee_amount : o.price ? r2(o.fee_amount * o.price * 1e4) / 1e4 : null; }
  return o;
}
async function api(path, opts = {}) {
  const m = (opts.method || "GET").toUpperCase(), b = opts.body ? JSON.parse(opts.body) : {}, [p, q] = path.split("?"), seg = p.split("/").filter(Boolean).slice(1).map(decodeURIComponent), arg = new URLSearchParams(q || "");
  const tick = (s) => mem.tickers.find((x) => x.symbol === s) || fail("Нет такого тикера");
  if (seg[0] === "today") return today();
  if (seg[0] === "history") return (coin(seg[1]) || fail("Нет данных по этому тикеру")).h;
  if (seg[0] === "search") { const s = (arg.get("q") || "").trim().toLowerCase(); return Object.entries(SNAP.coins).filter(([k, v]) => !s || k.toLowerCase().includes(s) || v.name.toLowerCase().includes(s)).map(([k, v]) => ({ symbol: k, name: v.name, kind: "CRYPTOCURRENCY" })); }
  if (seg[0] === "tickers" && m === "POST") { if (!coin(b.symbol)) fail("В этой версии доступны только встроенные монеты"); if (!mem.tickers.some((t) => t.symbol === b.symbol)) { mem.tickers.push(fresh(b.symbol)); await saveCfg(); } return { ok: true }; }
  if (seg[0] === "tickers" && m === "PATCH") { const t = tick(seg[1]); if (b.strategy) t.strategy = b.strategy; if (b.margin != null) t.margin = !!b.margin; if (b.mode) { t.mode = ["spot", "margin", "perp"].includes(b.mode) ? b.mode : "spot"; t.margin = t.mode === "margin"; } if (b.reset_unit) t.unit = null; else if (b.unit != null) { if (!(b.unit > 0)) fail("Сумма должна быть больше нуля"); t.unit = b.unit; } await saveCfg(); return { ok: true }; }
  if (seg[0] === "tickers" && m === "DELETE") { mem.tickers = mem.tickers.filter((t) => t.symbol !== seg[1]); await saveCfg(); return { ok: true }; }
  if (seg[0] === "unit") { if (!(b.unit > 0)) fail("Сумма должна быть больше нуля"); mem.unit = b.unit; await saveCfg(); return { ok: true }; }
  if (seg[0] === "pnl" && m === "GET") return pnlHistory();
  if (seg[0] === "hist" && m === "GET") return histPerf(decodeURIComponent(seg[1]));
  if (seg[0] === "histd" && m === "GET") return histDetail(decodeURIComponent(seg[1]), Number(seg[2]) || 0);
  if (seg[0] === "done" && m === "POST") { if (!b.price || !b.amount) fail("Нет суммы или цены"); const it = today().items.find((x) => x.symbol === b.symbol) || {}; return addTrade({ symbol: b.symbol, side: b.amount < 0 ? "sell" : "buy", amount: Math.abs(b.amount), price: b.price, source: "plan", borrowed: b.amount > 0 ? it.borrowed || 0 : 0, repaid: b.amount < 0 ? it.repaid || 0 : 0 }); }
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
