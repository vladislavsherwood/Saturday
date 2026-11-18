// The helper's own logic (standalone.js), run in Node with a made-up coin: how much it proposes after missed days.
const fs = require('fs'), vm = require('vm');
const src = fs.readFileSync(process.argv[2] || require('path').join(__dirname, 'web', 'standalone.js'), 'utf8');
const D = 864e5, end = Math.round(Date.parse(new Date().toISOString().slice(0, 10)) / D), iso = (d) => new Date(d * D).toISOString().slice(0, 10);
// data up to yesterday (as the app has it): 30 days of history; plan[i] is the decision by the data of day t[i], carried out on the next day
function coin(actions) {           // actions: {daysAgo: action carried out on that day}; today's action is actions[0] (default 1)
  const t = [], c = [], plan = [];
  for (let d = end - 30; d <= end - 1; d++) { t.push(d); c.push(100); }
  for (let i = 0; i < t.length; i++) { const carried = t[i] + 1, ago = end - carried; plan.push(actions[ago] != null ? actions[ago] : 1); }
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
  const got = { amount: it.amount, missed: it.missed || 0, missed_amount: it.missed_amount || 0, reserve: it.reserve };
  const ok = Object.keys(expect).every((k) => Math.abs(got[k] - expect[k]) < 0.005);
  console.log((ok ? 'ok   ' : 'FAIL ') + name + ' → ' + JSON.stringify(got) + (ok ? '' : '  expected ' + JSON.stringify(expect)));
  return ok;
}
let all = true;
const t = (...a) => { all = run(...a) && all; };
// взнос $2 в день; монета ведётся 10 дней (сегодня — одиннадцатый)
t('bought every day up to yesterday', { since: 10, buys: [...Array(10)].map((_, i) => [i + 1, 2]), expect: { amount: 2, missed: 0 } });
t('missed yesterday', { since: 10, buys: [...Array(9)].map((_, i) => [i + 2, 2]), expect: { amount: 4, missed: 1, missed_amount: 2 } });
t('missed two days', { since: 10, buys: [...Array(8)].map((_, i) => [i + 3, 2]), expect: { amount: 6, missed: 2, missed_amount: 4 } });
t('missed two days, one of them a sell day (its contribution belongs to the reserve)', { since: 10, actions: { 2: -0.3 }, buys: [...Array(8)].map((_, i) => [i + 3, 2]), expect: { amount: 4, missed: 1 } });
t('never bought since the start', { since: 4, expect: { amount: 10, missed: 4, reserve: 10 } });
t('bought less than proposed yesterday: the shortfall stays in the reserve', { since: 10, buys: [...Array(9)].map((_, i) => [i + 2, 2]).concat([[1, 1]]), expect: { amount: 2, missed: 0, reserve: 3 } });
t('already bought today', { since: 10, buys: [...Array(10)].map((_, i) => [i + 1, 2]).concat([[0, 2]]), expect: { missed: 0, reserve: 0 } });
// сигнал «взнос + 25% резерва»: пропущенный взнос целиком, доля — от остального резерва
t('signal +25% with a strategic reserve of $10 and nothing missed (as before)', { since: 10, actions: { 0: 1.25 }, buys: [...Array(5)].map((_, i) => [i + 1, 2]), expect: { amount: 2 + 0.25 * 10, missed: 0 } });
t('signal +25%, yesterday missed, strategic reserve $10', { since: 11, actions: { 0: 1.25 }, buys: [...Array(5)].map((_, i) => [i + 2, 2]), expect: { amount: 4 + 0.25 * 10, missed: 1 } });
t('sell day today: nothing to buy', { since: 10, actions: { 0: -0.3 }, buys: [...Array(9)].map((_, i) => [i + 2, 2]), expect: { missed: 0 } });
process.exit(all ? 0 : 1);
