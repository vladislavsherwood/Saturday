/* Агент 4B, круг 3: «первый страх после вершины».
   Гипотеза: первые дни страха вскоре после перегрева (жадность > 75 / счёт перегрева ≥ 3 / тихая вершина в последние D дней) —
   это начало разворота у вершины; продавать в эти дни крупнее (40–60% вместо 16/30%) — продать выше и сохранить больше резерва на дно.
   Отличие от отвергнутого H4c агента 2 (страх при BTC в 10–30% от максимума): условие — недавний перегрев и только первые k дней страха.
   Критерий: строгая ✔, доход > +0,03, соседи в плюсе, вершины не хуже. Запуск: node app/agent4b_loop3.js */
const B = require('./agent4b_sim.js');
const { c } = B;
const G = B.groups(), base = B.ev(G, B.W25);
const SIG = [['fng', 75], ['fund30', 1], ['mvrv', 2.5], ['oth90', 0.5], ['btcup90', 60]];
B.addInd(G, 'heat', (X) => { const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = SIG.reduce((s, [k, v]) => s + (X.ind[k] && X.ind[k][i] > v ? 1 : 0), 0); return a; });
const I = (X) => X.ind;
B.addInd(G, 'ago_g75', (X) => B.since(X.n, (i) => I(X).fng[i] > 75));
B.addInd(G, 'ago_h3', (X) => B.since(X.n, (i) => I(X).heat[i] > 2.5));
B.addInd(G, 'ago_qt', (X) => B.since(X.n, (i) => I(X).qt[i] > 0.5 || (I(X).btcath[i] < 15 && I(X).oth90[i] > 1)));
const rows = []; const run = (tag, S) => { const r = B.ev(G, S); r.tag = tag; r.dd = B.d(r, base); rows.push(r); console.log(B.show(tag, r, base) + (B.passes(r, base) ? '' : ' | ' + B.why(r, base))); return r; };
console.log(B.HDR); console.log(B.show('W25', base, base));
const iF = B.W25.rules.findIndex((r) => r.act === -0.3);
const fear = [c('fng', '<', 52), c('usdtd', '<', 7.6)];
for (const hot of ['ago_g75', 'ago_h3', 'ago_qt']) for (const D of [30, 60, 90]) for (const k of [3, 7, 1e4]) for (const s of [0.4, 0.6]) {
  const cond = [...fear, c(hot, '<', D + 0.5), ...(k < 1e4 ? [c('feard', '<', k + 0.5)] : [])];
  run(`страх после ${hot} ≤ ${D} дн${k < 1e4 ? `, первые ${k} дн страха` : ''} → ${s * 100}%`, B.ins(B.W25, [{ act: -s, conds: cond }], iF));
}
require('fs').writeFileSync(B.SCR + '/agent4b_loop3.json', JSON.stringify(rows.map((r) => ({ tag: r.tag, dd: r.dd, pass: B.passes(r, base), m: r.m, n100: r.n100.med }))));
