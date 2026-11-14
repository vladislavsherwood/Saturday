/* Агент 4B, круг 4: возврат в рынок после продажи на тихой вершине (не упустить продолжение роста).
   Гипотеза: широкая тихая вершина крупнее (40–50%) даёт +0,1…+0,2, но продаёт монеты в начале их собственного роста (TON 2024-03).
   Если в течение D дней после тихой вершины (узкой или широкой) монета обновляет 90-дн. максимум (hi90) или BTC — исторический
   максимум, а страха нет, вернуть часть резерва (10/25/50%) — продажа станет «страховкой», а не выходом из роста.
   Правило возврата ставится в конец (горит только в дни без продаж на тихой вершине и на страхе).
   Критерий: строгая ✔, доход > +0,03 к W25, соседи в плюсе, вершины не хуже. Запуск: node app/agent4b_loop4.js */
const B = require('./agent4b_sim.js');
const { c } = B;
const G = B.groups(), base = B.ev(G, B.W25);
const I = (X) => X.ind;
B.addInd(G, 'ago_qt', (X) => B.since(X.n, (i) => I(X).qt[i] > 0.5 || (I(X).btcath[i] < 15 && I(X).oth90[i] > 1)));
const rows = []; const run = (tag, S) => { const r = B.ev(G, S); r.tag = tag; r.dd = B.d(r, base); rows.push(r); console.log(B.show(tag, r, base) + (B.passes(r, base) ? '' : ' | ' + B.why(r, base))); return r; };
console.log(B.HDR); console.log(B.show('W25', base, base));
const R = B.W25.rules, iW = R.findIndex(B.isW);
const withWide = (s) => ({ ...B.W25, rules: R.map((r, i) => (i === iW ? { ...r, act: -s } : r)) });
for (const s of [0.25, 0.4, 0.5]) {
  const W = withWide(s); if (s !== 0.25) run(`широкая ${s * 100}% без возврата`, W);
  for (const trig of ['hi90', 'btcath']) for (const D of [30, 60, 120]) for (const r of [0.1, 0.25, 0.5]) {
    const cond = [c('ago_qt', '<', D + 0.5), c('ago_qt', '>', 0.5), c('fng', '>', 52), trig === 'hi90' ? c('hi90', '>', 0.5) : c('btcath', '<', 1)];
    run(`широкая ${s * 100}% + возврат ${r * 100}% при ${trig === 'hi90' ? 'новом 90-дн. максимуме монеты' : 'максимуме BTC'} ≤ ${D} дн после тихой вершины`, B.ins(W, [{ act: 1 + r, conds: cond }]));
  }
}
require('fs').writeFileSync(B.SCR + '/agent4b_loop4.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, dd: r.dd, pass: B.passes(r, base), m: r.m, n100: r.n100.med }))));
