/* Агент 2, круг 5 (продолжение): широкая тихая вершина с фильтром, чтобы не продавать монету в начале её собственного роста
   (TON, 1-я половина: продажа в марте 2024 посреди роста монеты). Фильтры: жадность > 50/60, монета выше своей средней 200 дней
   в 1,2/1,5 раза. Критерии пользователя: монет в плюсе, половин в плюсе, худшая половина (отбор, экзамен, 50 случайных) — не хуже.
   Запуск: node app/agent2_loop5b.js */
const A = require('./agent2_sim.js');
const { c } = A;
const G = A.groups(), base = A.ev(G, A.MAIN);
const M = A.MAIN.rules, iQT = M.findIndex((r) => A.has(r, 'qt')), QT = M[iQT];
const user = (r, b) => ['sel', 'ex', 'rnd'].every((k) => r[k].pos >= b[k].pos && r[k].hpos >= b[k].hpos && r[k].hworst >= b[k].hworst - 1e-9);
const rows = [];
console.log(A.HDR); console.log(A.show('основа', base, base));
const FL = [[[], 'без фильтра'], [[c('fng', '>', 50)], 'жадность > 50'], [[c('fng', '>', 60)], 'жадность > 60'], [[c('sma200', '>', 1.2)], 'монета > 1,2 средней 200'], [[c('sma200', '>', 1.5)], 'монета > 1,5 средней 200']];
for (const keep of [true, false]) for (const [b, o] of [[10, 1], [12, 1], [15, 1], [20, 1], [15, 0.75]]) for (const [fl, ft] of FL) for (const f of [0.2, 0.3, 0.4]) {
  if (keep && f === 0.4) continue;
  const wide = { act: -f, conds: [c('btcath', '<', b), c('oth90', '>', o), ...fl] };
  const X = { ...A.MAIN, rules: [...M.slice(0, iQT), ...(keep ? [QT, wide] : [wide]), ...M.slice(iQT + 1)] };
  const r = A.ev(G, X); r.tag = `${keep ? 'узкая 40% + ' : ''}широкая (BTC < ${b}%, альты > ${o}, ${ft}) ${f * 100}%`; r.S = X; r.dd = A.d(r, base); r.user = user(r, base); r.why = A.why(r, base); rows.push(r);
}
console.log('\nпрошли критерии пользователя (монет и половин в плюсе, худшая половина не хуже) — по доходу:');
for (const r of rows.filter((r) => r.user).sort((a, b) => b.dd - a.dd).slice(0, 25)) console.log(A.show(r.tag, r, base) + (r.why ? ` | не прошла: ${r.why}` : ''));
console.log('\nлучшие по доходу (все):');
for (const r of [...rows].sort((a, b) => b.dd - a.dd).slice(0, 10)) console.log(A.show(r.tag, r, base) + ` | ${r.why}`);
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent2_loop5b.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, S: r.S, dd: r.dd, pass: A.passes(r, base), user: r.user, why: r.why, sel: r.sel, ex: r.ex, rnd: r.rnd, n100: r.n100, m: r.m }))));
