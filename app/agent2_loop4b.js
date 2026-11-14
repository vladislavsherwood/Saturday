/* Агент 2, круг 4 (продолжение): плато «тихой вершины» с более низким порогом роста доли альтов (oth90) и размером продажи;
   какие монеты/половины проигрывают. Запуск: node app/agent2_loop4b.js */
const A = require('./agent2_sim.js');
const { c } = A;
const G = A.groups(), base = A.ev(G, A.MAIN);
const M = A.MAIN.rules, iQT = M.findIndex((r) => A.has(r, 'qt'));
const qt = (b, o, f) => ({ ...A.MAIN, rules: [...M.slice(0, iQT), { act: -f, conds: [c('btcath', '<', b), c('oth90', '>', o)] }, ...M.slice(iQT + 1)] });
const rows = [];
const cell = (r) => `${r.dd >= 0 ? '+' : ''}${r.dd.toFixed(2)}${A.passes(r, base) ? '✔' : ''}`;
console.log(A.HDR); console.log(A.show('основа', base, base));
for (const f of [0.3, 0.4, 0.5]) {
  console.log(`\nпродать ${f * 100}%: строки — btcath <, столбцы — oth90 >`);
  for (const b of [8, 10, 12, 15, 20, 25]) { const line = []; for (const o of [0, 0.25, 0.5, 0.75, 1, 1.1, 1.2, 1.3, 1.4, 1.5]) { const r = A.ev(G, qt(b, o, f)); r.dd = A.d(r, base); r.tag = `тихая вершина: btcath < ${b}, oth90 > ${o}, продать ${f * 100}%`; rows.push(r); line.push(`${o}:${cell(r)}`); } console.log(`  ${String(b).padStart(2)} | ${line.join(' ')}`); }
}
console.log('\nстроки сравнения:');
for (const t of ['btcath < 10, oth90 > 1, продать 40%', 'btcath < 15, oth90 > 1, продать 40%', 'btcath < 20, oth90 > 1, продать 40%', 'btcath < 15, oth90 > 0.5, продать 40%', 'btcath < 15, oth90 > 0.75, продать 40%', 'btcath < 15, oth90 > 1, продать 30%', 'btcath < 15, oth90 > 1, продать 50%'])
  { const r = rows.find((x) => x.tag.endsWith(t)); console.log(A.show(r.tag, r, base)); }
// какие монеты хуже на 50 случайных и где худшие половины
const S1 = qt(15, 1, 0.4), r1 = A.ev(G, S1);
const nm = G.rnd.map((X) => X.name);
console.log('\n50 случайных, монеты, где знак итога сменился (основа → кандидат btcath<15, oth90>1):');
r1.rnd.e.forEach((v, i) => { if ((v > 0) !== (base.rnd.e[i] > 0)) console.log(`  ${nm[i]}: ${base.rnd.e[i].toFixed(0)}% → ${v.toFixed(0)}%`); });
const dlt = r1.rnd.e.map((v, i) => [nm[i], base.rnd.e[i], v]).sort((a, b) => (a[2] - a[1]) - (b[2] - b[1]));
console.log('  сильнее всего хуже:', dlt.slice(0, 5).map(([n, a, b]) => `${n} ${a.toFixed(0)}→${b.toFixed(0)}`).join(', '));
console.log('  сильнее всего лучше:', dlt.slice(-5).map(([n, a, b]) => `${n} ${a.toFixed(0)}→${b.toFixed(0)}`).join(', '));
for (const g of ['sel', 'ex', 'rnd', 'n100']) { const better = r1[g].e.filter((v, i) => v > base[g].e[i] + 0.5).length, worse = r1[g].e.filter((v, i) => v < base[g].e[i] - 0.5).length; console.log(`  ${g}: лучше на ${better}, хуже на ${worse} монетах`); }
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/agent2_loop4b.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, dd: r.dd, pass: A.passes(r, base), sel: r.sel, ex: r.ex, rnd: r.rnd, n100: r.n100, m: r.m }))));
