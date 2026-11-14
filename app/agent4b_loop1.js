/* Агент 4B, круг 1: форма широкой тихой вершины — размер дневной продажи, длительность (сколько дней подряд горит сигнал),
   лесенка «сначала мало, потом больше», то же для узкой тихой вершины.
   Гипотеза: широкая тихая вершина продаёт рано (56% от вершины монеты); если продавать её меньшими долями или только после
   N дней подряд, продажи сместятся ближе к вершине и доход вырастет. Критерий: строгая ✔, доход > +0,03, соседи в плюсе, вершины не хуже.
   Запуск: node app/agent4b_loop1.js */
const B = require('./agent4b_sim.js');
const { c } = B;
const G = B.groups(), base = B.ev(G, B.W25);
B.addInd(G, 'wrun', (X) => B.runOf(X.n, (i) => X.ind.btcath[i] < 15 && X.ind.oth90[i] > 1));
const R = B.W25.rules, iW = R.findIndex(B.isW), iQ = R.findIndex((r) => B.has(r, 'qt'));
const W = (rules) => ({ ...B.W25, rules: [...R.slice(0, iW), ...rules, ...R.slice(iW + 1)] });
const wide = (act, extra = []) => ({ act, conds: [c('btcath', '<', 15), c('oth90', '>', 1), ...extra] });
const rows = []; const run = (tag, S) => { const r = B.ev(G, S); r.tag = tag; r.dd = B.d(r, base); rows.push(r); console.log(B.show(tag, r, base)); return r; };
console.log(B.HDR); console.log(B.show('W25', base, base));
console.log('\nA: размер × длительность широкой (дней подряд ≥ k)');
for (const k of [0, 3, 7, 14, 21, 30]) for (const s of [0.1, 0.15, 0.25, 0.35, 0.5]) run(`широкая ${s * 100}%, ≥${k} дн`, W([wide(-s, k ? [c('wrun', '>', k - 0.5)] : [])]));
console.log('\nB: лесенка широкой: первые k дней a%, дальше b%');
for (const k of [7, 14, 30]) for (const [a, b] of [[0.1, 0.25], [0.1, 0.4], [0.05, 0.25], [0.15, 0.4]]) run(`широкая ${a * 100}% первые ${k} дн, потом ${b * 100}%`, W([wide(-b, [c('wrun', '>', k - 0.5)]), wide(-a)]));
console.log('\nC: узкая тихая вершина — длительность (qtrun ≥ k) и размер');
for (const k of [3, 7, 14]) for (const s of [0.4, 0.6]) { const S = { ...B.W25, rules: R.map((r, i) => (i === iQ ? { act: -s, conds: [...r.conds, c('qtrun', '>', k - 0.5)] } : r)) }; run(`узкая ${s * 100}% только ≥${k} дн`, S); }
require('fs').writeFileSync(B.SCR + '/agent4b_loop1.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, dd: r.dd, pass: B.passes(r, base), m: r.m, n100: r.n100.med }))));
