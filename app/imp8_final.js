/* imp8, круг 5: итоговая проверка упрощённых вариантов против основы: отбор, экзамен, 50 случайных (строгая, доход), 100 новых
   (медиана, в плюсе, половины, лучше/хуже по монетам), метрики дна/вершин (81 монета), металлы. Запуск: node app/imp8_final.js <out.json> */
const I = require('./imp8_sim.js'); const { K } = I; const fs = require('fs');
const G = I.load(['sel', 'ex', 'rnd', 'n100', 'met']);
const setThr = (S, ind, op, v0, v) => ({ ...S, rules: S.rules.map((r) => ({ ...r, conds: r.conds.map((y) => (y.ind === ind && y.op === op && y.v === v0 ? { ...y, v } : y)) })) });
const S2 = I.simplify();
const V = { 'основа combo-best': I.BASE, S2, 'S2o (oth90 > 0,9)': setThr(S2, 'oth90', '>', 1, 0.9), 'S3a (без узкой тихой)': I.drop(S2, [], (r) => I.has(r, 'qt')) };
const base = K.ev(G, I.BASE, true), out = {};
for (const [nm, S] of Object.entries(V)) {
  const r = nm.startsWith('основа') ? base : K.ev(G, S, true);
  const o = { n: S.rules.length, d: K.d(r, base), strict: K.passes(r, base), why: K.why(r, base), m: r.m };
  for (const g of ['sel', 'ex', 'rnd', 'n100', 'met']) o[g] = { med: r[g].med, pos: r[g].pos, n: r[g].n, hpos: r[g].hpos, hn: r[g].hn, worst: r[g].worst, hworst: r[g].hworst, bw: K.bw(r, base, g) };
  out[nm] = o;
  console.log(`\n== ${nm}: ${o.n} правил | доход ${o.d >= 0 ? '+' : ''}${o.d.toFixed(3)} | строгая ${o.strict ? '✔' : '· ' + o.why}`);
  for (const [g, t] of [['sel', 'отбор 17'], ['ex', 'экзамен 14'], ['rnd', '50 случайных'], ['n100', '100 новых'], ['met', 'металлы']]) console.log(`  ${t}: ${K.sh(r[g])} | лучше/хуже основы ${o[g].bw.join('/')}`);
  console.log('  ' + K.fmtM(r.m));
}
fs.writeFileSync(process.argv[2], JSON.stringify(out, null, 1));
