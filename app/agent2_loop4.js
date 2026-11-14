/* Агент 2, круг 4: продавать ближе к вершине и не пропускать хорошие точки выхода.
   H4a: плато тихой вершины по порогам (BTC до максимума < 5/7/10/15%, рост доли альтов за 90 дней > 0,5/1/1,5/2,5 п.п.).
   H4b: тихая вершина крупнее, когда вершину подтверждают плечи или жадность (фандинг за 30 дн > 1%, страх-жадность > 70/75, толпа в лонгах).
   H4c: первый страх у максимума — продать крупнее: страх (fng < 52, usdtd < 7,6) при BTC в 15/20/25% от максимума → 25/30/40%.
   H4d: вершина по толпе: BTC у максимума (< 10%) и толпа в лонгах (лонги/шорты к средней 90 дн > 1,2/1,4) или фандинг за 7 дн > 0,5% → продать 5/10%.
   Запуск: node app/agent2_loop4.js */
const A = require('./agent2_sim.js');
const { c } = A;
const G = A.groups(), base = A.ev(G, A.MAIN);
const M = A.MAIN.rules, iQT = M.findIndex((r) => A.has(r, 'qt')), iWeak = M.findIndex((r) => r.act === -0.3), QT = M[iQT];
const repl = (i, ...R) => ({ ...A.MAIN, rules: [...M.slice(0, i), ...R, ...M.slice(i + 1)] });
const ins = (at, ...R) => ({ ...A.MAIN, rules: [...M.slice(0, at), ...R, ...M.slice(at)] });
const rows = [];
const run = (tag, X, fam) => { const r = A.ev(G, X); r.tag = tag; r.fam = fam; r.dd = A.d(r, base); rows.push(r); return r; };
const cell = (r) => `${r.dd >= 0 ? '+' : ''}${r.dd.toFixed(2)}${A.passes(r, base) ? '✔' : ''}`;
console.log(A.HDR); console.log(A.show('основа', base, base));
console.log('\nH4a: пороги тихой вершины (строки — BTC до максимума <, столбцы — рост доли альтов за 90 дн >)');
for (const b of [5, 7, 10, 12, 15, 20]) { const line = []; for (const o of [0.5, 1, 1.5, 2, 2.5, 3.5]) line.push(`${o}:${cell(run(`тихая вершина: btcath < ${b}, oth90 > ${o}`, repl(iQT, { act: -0.4, conds: [c('btcath', '<', b), c('oth90', '>', o)] }), 'a'))}`); console.log(`  btcath < ${String(b).padStart(2)} | ${line.join(' ')}`); }
console.log('\nH4b: тихая вершина крупнее при подтверждении');
for (const [cd, t] of [[c('fund30', '>', 1), 'фандинг 30д > 1%'], [c('fund30', '>', 2), 'фандинг 30д > 2%'], [c('fng', '>', 70), 'жадность > 70'], [c('fng', '>', 75), 'жадность > 75'], [c('lsr', '>', 1.2), 'толпа в лонгах > 1,2']])
  for (const f of [0.5, 0.6, 0.75]) console.log(A.show(`тихая вершина и ${t} → ${f * 100}%, иначе 40%`, run(`тихая вершина и ${t} → ${f * 100}%`, ins(iQT, { act: -f, conds: [...QT.conds, cd] }), 'b'), base));
console.log('\nH4c: первый страх у максимума — крупнее');
for (const b of [10, 15, 20, 25, 30]) { const line = []; for (const f of [0.2, 0.25, 0.3, 0.4, 0.5]) line.push(`${f * 100}%:${cell(run(`страх при btcath < ${b} → ${f * 100}%`, ins(iWeak, { act: -f, conds: [c('fng', '<', 52), c('usdtd', '<', 7.6), c('btcath', '<', b)] }), 'c'))}`); console.log(`  btcath < ${b} | ${line.join(' ')}`); }
console.log('\nH4d: вершина по толпе и плечам');
for (const [cds, t] of [[[c('lsr', '>', 1.2)], 'толпа в лонгах > 1,2'], [[c('lsr', '>', 1.4)], 'толпа в лонгах > 1,4'], [[c('fund7', '>', 0.5)], 'фандинг 7д > 0,5%'], [[c('fund7', '>', 0.8)], 'фандинг 7д > 0,8%'], [[c('oic30', '>', 20)], 'OI +20% за 30 дн']])
  for (const f of [0.05, 0.1]) for (const at of ['end', 'qt']) console.log(A.show(`BTC у максимума (< 10%) и ${t} → ${f * 100}% (${at === 'end' ? 'в конце' : 'перед тихой вершиной'})`, run(`вершина: ${t} → ${f * 100}% ${at}`, at === 'end' ? { ...A.MAIN, rules: [...M, { act: -f, conds: [c('btcath', '<', 10), ...cds] }] } : ins(iQT, { act: -f, conds: [c('btcath', '<', 10), ...cds] }), 'd'), base));
console.log('\nлучшие 12:'); for (const r of rows.sort((a, b) => b.dd - a.dd).slice(0, 12)) console.log(A.show(r.tag, r, base));
console.log('\nпрошли строгую проверку с доходом > 0:'); for (const r of rows.filter((r) => A.passes(r, base) && r.dd > 0.001)) console.log(A.show(r.tag, r, base));
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent2_loop4.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, fam: r.fam, dd: r.dd, pass: A.passes(r, base), sel: r.sel, ex: r.ex, rnd: r.rnd, n100: r.n100, m: r.m }))));
