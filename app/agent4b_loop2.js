/* Агент 4B, круг 2: перегрев рынка как сумма признаков и продажа лесенкой по мере роста перегрева.
   Признаки (только прошлое, рыночные): жадность > 75; фандинг 30 дн > 1%; MVRV BTC > 2,5; доля альтов за 90 дн растёт (> 0,5 п.п.);
   BTC выше минимума 90 дней на > 60%; OI BTC за 30 дн > +15%. Счёт = число выполненных признаков (0…6).
   Гипотеза: одиночные признаки перегрева шумят (жадность > 70–75 портит отбор), а совпадение ≥ 3–4 признаков отмечает настоящие
   вершины — продажа на нём (в конце списка) и лесенкой (больше при большем счёте) продаст ближе к вершине и сократит пропуски.
   Критерий: строгая ✔, доход > +0,03, соседи в плюсе, вершины не хуже. Запуск: node app/agent4b_loop2.js */
const B = require('./agent4b_sim.js');
const { c } = B;
const G = B.groups(), base = B.ev(G, B.W25);
const SIG = [['fng', 75], ['fund30', 1], ['mvrv', 2.5], ['oth90', 0.5], ['btcup90', 60], ['oic30', 15]];
B.addInd(G, 'heat', (X) => { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = SIG.reduce((s, [k, v]) => s + (X.ind[k] && X.ind[k][i] > v ? 1 : 0), 0); return a; });
B.addInd(G, 'heat5', (X) => { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = SIG.slice(0, 5).reduce((s, [k, v]) => s + (X.ind[k] && X.ind[k][i] > v ? 1 : 0), 0); return a; });
const rows = []; const run = (tag, S) => { const r = B.ev(G, S); r.tag = tag; r.dd = B.d(r, base); rows.push(r); console.log(B.show(tag, r, base) + (B.passes(r, base) ? '' : ' | ' + B.why(r, base))); return r; };
console.log(B.HDR); console.log(B.show('W25', base, base));
// доля дней по счёту на BTC
{ const X = G.sel.find((x) => x.name === 'BTC'), h = {}; for (let i = 0; i < X.n; i++) h[X.ind.heat[i]] = (h[X.ind.heat[i]] || 0) + 1; console.log('дней BTC по счёту перегрева:', JSON.stringify(h)); }
console.log('\nA: одна ступень в конце: счёт ≥ k → продать s');
for (const ind of ['heat', 'heat5']) for (const k of [3, 4, 5]) for (const s of [0.05, 0.1, 0.2, 0.4]) run(`${ind} ≥ ${k} → ${s * 100}%`, B.ins(B.W25, [{ act: -s, conds: [c(ind, '>', k - 0.5)] }]));
console.log('\nB: лесенка: счёт ≥ k → s, ≥ k+1 → 2s, ≥ k+2 → 4s');
for (const k of [2, 3, 4]) for (const s of [0.03, 0.05, 0.1]) run(`лесенка heat с ${k}: ${s * 100}/${2 * s * 100}/${Math.min(1, 4 * s) * 100}%`, B.ins(B.W25, [{ act: -Math.min(1, 4 * s), conds: [c('heat', '>', k + 1.5)] }, { act: -2 * s, conds: [c('heat', '>', k + 0.5)] }, { act: -s, conds: [c('heat', '>', k - 0.5)] }]));
console.log('\nC: лесенка, вставленная перед продажами на страхе (перегрев важнее страха)');
const iF = B.W25.rules.findIndex((r) => r.act === -0.3);
for (const k of [3, 4]) for (const s of [0.05, 0.1]) run(`перед страхом: heat ≥ ${k} → ${s * 100}%`, B.ins(B.W25, [{ act: -s, conds: [c('heat', '>', k - 0.5)] }], iF));
require('fs').writeFileSync(B.SCR + '/agent4b_loop2.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, dd: r.dd, pass: B.passes(r, base), m: r.m, n100: r.n100.med }))));
