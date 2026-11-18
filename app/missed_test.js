// Логика приложения (web/standalone.js) в Node на придуманной монете: сколько предлагается купить, если взносы покупались
// не вовремя или не полностью. Запуск: node app/missed_test.js [путь к standalone.js]. Код выхода 1 при расхождении.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2] || require('path').join(__dirname, 'web', 'standalone.js'), 'utf8');
const D = 864e5, end = Math.round(Date.parse(new Date().toISOString().slice(0, 10)) / D), iso = (d) => new Date(d * D).toISOString().slice(0, 10);
// данные по вчера, как у приложения: 30 дней истории; plan[i] — решение по данным дня t[i], исполняется на следующий день
function coin(actions) {           // actions: {сколько дней назад: действие в тот день}; сегодня — actions[0] (по умолчанию 1)
  const t = [], c = [], plan = [];
  for (let d = end - 30; d <= end - 1; d++) { t.push(d); c.push(100); }
  for (let i = 0; i < t.length; i++) { const ago = end - (t[i] + 1); plan.push(actions[ago] != null ? actions[ago] : 1); }
  return { name: 'Test', kind: 'alt', h: { symbol: 'T-USD', kind: 'alt', price: 100, currency: 'USD', as_of: iso(end - 1), t, c, o: c, h: c, l: c,
    strategies: [{ code: 'combo4', name: 'combo4', about: '', plan, plan_today: plan[plan.length - 1], today: 1, label: '', action: '', rule: -1, fam: '' }] } };
}
function run(name, { actions = {}, since, buys = [], unit = 2, expect }) {
  const ctx = { console, localStorage: { getItem: () => null, setItem() {} }, window: {}, document: {}, navigator: {}, atob: (x) => Buffer.from(x, 'base64').toString('binary') };
  ctx.SNAP = { as_of: iso(end - 1), coins: { 'T-USD': coin(actions) } };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const trades = buys.map(([ago, amount, side], n) => ({ id: n + 1, symbol: 'T-USD', side: side || 'buy', day: iso(end - ago), amount, qty: amount / 100, price: 100 }));
  ctx.__seed = { unit, tickers: [{ symbol: 'T-USD', name: 'Test', kind: 'alt', strategy: 'combo4', unit, since: iso(end - since) }], trades };
  const it = vm.runInContext('Object.assign(mem, __seed); today().items[0]', ctx);
  const got = { amount: it.amount, extra: it.missed_amount || 0, reserve: it.reserve, tiny: it.tiny ? it.tiny.have : 0, done: it.done || 0, partial: it.partial || 0 };
  const ok = Object.keys(expect).every((k) => Math.abs(got[k] - expect[k]) < 0.005);
  console.log((ok ? 'ok   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (ok ? '' : '  ожидалось ' + JSON.stringify(expect)));
  return ok;
}
let all = true;
const t = (...a) => { all = run(...a) && all; };
const daily = (from, to, amount = 2) => { const l = []; for (let ago = from; ago >= to; ago--) l.push([ago, amount]); return l; };   // покупки каждый день
const kept = (from, to) => { const o = {}; for (let ago = from; ago >= to; ago--) o[ago] = -0.3; return o; };                     // дни продажи: взнос уходит в резерв
// взнос $2 в день; монета ведётся 10 дней (сегодня — одиннадцатый)
t('покупал каждый день по вчера', { since: 10, buys: daily(10, 1), expect: { amount: 2, extra: 0 } });
t('пропустил вчера', { since: 10, buys: daily(10, 2), expect: { amount: 4, extra: 2 } });
t('пропустил два дня', { since: 10, buys: daily(10, 3), expect: { amount: 6, extra: 4 } });
t('пропустил два дня, один из них — день продажи (его взнос остаётся в резерве)', { since: 10, actions: { 2: -0.3 }, buys: daily(10, 3), expect: { amount: 4, extra: 2 } });
t('не покупал с самого старта', { since: 4, expect: { amount: 10, reserve: 10 } });
t('вчера купил меньше взноса: остаток остаётся к покупке', { since: 10, buys: daily(10, 2).concat([[1, 1]]), expect: { amount: 3, extra: 1, reserve: 3 } });
t('пропустил вчера, сегодня купил только на один день: второй ещё к покупке', { since: 10, buys: daily(10, 2).concat([[0, 2]]), expect: { amount: 2, partial: 2, done: 0 } });
t('сегодня купил всё', { since: 10, buys: daily(10, 0), expect: { amount: 0, done: 2, partial: 0 } });
t('сегодня купил на $1,94 из $2: шесть центов не докупить — сделано', { since: 10, buys: daily(10, 1).concat([[0, 1.94]]), expect: { amount: 0, done: 1.94, partial: 0 } });
// сигнал «взнос + 25% резерва»: недокупленные взносы целиком, доля — от резерва стратегии ($10 за пять дней продажи)
t('сигнал +25%, резерв стратегии $10, пропусков нет (как раньше)', { since: 10, actions: { ...kept(10, 6), 0: 1.25 }, buys: daily(5, 1), expect: { amount: 2 + 0.25 * 10, extra: 0 } });
t('сигнал +25%, вчера пропущено, резерв стратегии $10', { since: 11, actions: { ...kept(11, 7), 0: 1.25 }, buys: daily(6, 2), expect: { amount: 4 + 0.25 * 10, extra: 2 } });
t('сигнал +25%, купил всё предложенное: второй раз не предлагается', { since: 10, actions: { ...kept(10, 6), 0: 1.25 }, buys: daily(5, 1).concat([[0, 4.5]]), expect: { amount: 0, done: 4.5 } });
t('сегодня день продажи: покупать нечего', { since: 10, actions: { 0: -0.3 }, buys: daily(10, 2), expect: { extra: 0 } });
// меньше $1 биржа не исполнит: сегодня не предлагается, завтра добавится к покупке
t('к покупке осталось $0,60 (вчера купил больше): сегодня не предлагается', { since: 10, buys: daily(10, 2).concat([[1, 3.4]]), expect: { amount: 0, tiny: 0.6, reserve: 0.6 } });
t('на следующий день: $0,60 и новый взнос вместе', { since: 11, buys: daily(11, 3).concat([[2, 3.4]]), expect: { amount: 2.6, tiny: 0, extra: 0.6 } });
t('ровно $1 предлагается', { since: 10, buys: daily(10, 2).concat([[1, 3]]), expect: { amount: 1, tiny: 0 } });
t('продажа меньше $1 пропускается', { since: 10, actions: { 0: -0.3 }, buys: [[5, 2]], expect: { amount: 0, tiny: 0.6 } });
process.exit(all ? 0 : 1);
