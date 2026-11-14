/* Агент 4E, круг 5: продажи и «не продавать» на новых данных.
   H5a: продажа на перегреве новых рядов (рост OI ETH за 30 дн., рост доходностей 10/2 лет за 90 дн., MVRV BTC) — 10/25% позиции,
        в конце списка (только если не сработало ни одно правило) или перед продажами на страхе.
   H5b: не продавать на страхе при попутном макро-ветре (доходности 10 лет за 90 дн. падают, доллар падает) или притоке стейблкоинов —
        правило «только взнос» перед продажами на страхе.
   Критерий (заранее): доход > +0,05 к W25 на 2 соседних порогах и 2 размерах, строгая проверка; пропущенных вершин не больше.
   Запуск: node app/agent4e_loop5.js */
const E = require('./agent4e_sim.js');
const { c } = E;
const G = E.groups(['sel', 'ex', 'rnd']), base = E.ev(G, E.W25, true);
const R = E.W25.rules, iFear = R.findIndex((r) => r.act === -0.3);
const atEnd = (rule) => ({ ...E.W25, rules: [...R, rule] }), beforeFear = (rule) => ({ ...E.W25, rules: [...R.slice(0, iFear), rule, ...R.slice(iFear)] });
console.log(E.HDR); console.log(E.show('W25', base, base));
const rows = [];
const run = (tag, S) => { const r = E.ev(G, S, true), d = E.d(r, base); rows.push({ tag, d, pass: E.passes(r, base), sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med, m: r.m }); console.log(E.show(tag, r, base)); };
console.log('\nH5a: продажи на перегреве новых рядов');
const SELL = {
  'OI ETH за 30д > 35%': [c('eoic30', '>', 35)], 'OI ETH за 30д > 50%': [c('eoic30', '>', 50)],
  'доходность 10л за 90д > 0,5': [c('y10d90', '>', 0.5)], 'доходность 10л за 90д > 0,75': [c('y10d90', '>', 0.75)],
  'доходность 2л за 90д > 0,5': [c('y2d90', '>', 0.5)], 'доходность 2л за 90д > 0,75': [c('y2d90', '>', 0.75)],
  'MVRV BTC > 2,5': [c('mvrv', '>', 2.5)], 'MVRV BTC > 3': [c('mvrv', '>', 3)],
  'доходность 10л > 0,5 и BTC < 15% от макс.': [c('y10d90', '>', 0.5), c('btcath', '<', 15)],
};
for (const [nm, conds] of Object.entries(SELL)) for (const a of [0.1, 0.25]) { run(`в конце: ${nm} → продать ${a * 100}%`, atEnd({ act: -a, conds })); }
for (const nm of ['OI ETH за 30д > 35%', 'доходность 10л за 90д > 0,5', 'MVRV BTC > 2,5']) run(`перед страхом: ${nm} → продать 25%`, beforeFear({ act: -0.25, conds: SELL[nm] }));
console.log('\nH5b: не продавать на страхе при попутном ветре');
const HOLD = {
  'доходность 10л за 90д < −0,25': [c('y10d90', '<', -0.25)], 'доходность 10л за 90д < −0,5': [c('y10d90', '<', -0.5)], 'доходность 10л за 90д < −0,75': [c('y10d90', '<', -0.75)],
  'доллар за 90д < −2%': [c('dxy90', '<', -2)], 'доллар за 90д < −3%': [c('dxy90', '<', -3)],
  'стейблкоины за 30д > 2%': [c('stab30', '>', 2)], 'стейблкоины за 30д > 4%': [c('stab30', '>', 4)],
  'ленты хешрейта вверх > 30 дн.': [c('hribup', '>', 30)],
};
for (const [nm, conds] of Object.entries(HOLD)) run(`не продавать на страхе: ${nm}`, beforeFear({ act: 1, conds: [...conds, c('fng', '<', 52), c('usdtd', '<', 7.6)] }));
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent4e_loop5.json', JSON.stringify(rows));
