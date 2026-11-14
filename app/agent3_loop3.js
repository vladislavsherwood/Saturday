/* Агент 3, круг 3: продажи крупнее у высокобетовых монет — поиск плато и формы, которая пройдёт строгую проверку.
   H3a: порог беты к BTC за 180 дней 1,0…1,4 × множитель продаж 1,25/1,5/2 × какие продажи (все / на страхе / у вершины — тихие вершины и фандинг).
   H3b: ступени по бете (чем выше бета, тем крупнее продажа): ×(1 + k·(бета − 1)) полосами по 0,2. H3c: то же окно 90 дней.
   Критерий: строгая проверка к W25 + доход > +0,03 + соседние клетки в плюсе. Запуск: node app/agent3_loop3.js <out.json> > log */
const A = require('./agent3_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.W25), out = [];
console.log(A.HDR); console.log(A.row('W25', base, base));
const isFear = (r) => r.act < 0 && r.conds.some((cd) => cd.ind === 'fng' && cd.v === 52);
const isTop = (r) => r.act < 0 && !isFear(r);
const WH = { все: (r) => r.act < 0, страх: isFear, вершины: isTop };
const rec = (t, S) => { const r = A.ev(G, S); console.log(A.row(t, r, base)); out.push({ tag: t, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m }); return r; };
for (const w of [180, 90]) for (const b of [1.0, 1.1, 1.2, 1.3, 1.4]) {
  const key = `hb${w}_${b}`; A.addInd(G, key, (X) => A.flagOf(X.n, (i) => X.ind['beta' + w][i] > b));
  for (const k of [1.25, 1.5, 2]) for (const wh in WH) { if (w === 90 && wh !== 'все') continue; rec(`бета${w} > ${b}: продажи (${wh}) ×${k}`, A.scale(A.W25, key, 1, k, WH[wh])); }
}
// ступени: бета в полосах [1,1.2), [1.2,1.4), [1.4,1.6), [1.6,∞) → множитель 1 + k·(середина − 1)
for (const k of [0.5, 1, 1.5, 2]) {
  let S = A.W25;
  const bands = [[1.6, 9, 1.7], [1.4, 1.6, 1.5], [1.2, 1.4, 1.3], [1.0, 1.2, 1.1]];
  // правила в порядке: самые высокие полосы первыми (scale вставляет копию перед правилом, поэтому идём от низких к высоким)
  for (const [lo, hi, mid] of [...bands].reverse()) { const key = `bb_${lo}`; A.addInd(G, key, (X) => A.flagOf(X.n, (i) => X.ind.beta180[i] > lo && X.ind.beta180[i] <= hi)); S = A.scale(S, key, 1, 1 + k * (mid - 1), (r) => r.act < 0 && !r.conds.some((cd) => cd.ind.startsWith('bb_'))); }
  rec(`ступени по бете: продажи ×(1 + ${k}·(бета − 1))`, S);
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
