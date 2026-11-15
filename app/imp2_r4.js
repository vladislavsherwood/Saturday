/* imp2, круг 4: возврат резерва, проданного на страхе внутри бычьего рынка, на новом максимуме BTC.
   В «тихий» день (ни одно правило не горит): BTC на новом максимуме (btcath < 1 / < 3) или на новом 90-дн. максимуме (bhi90),
   жадность > 52, с последнего дня страха прошло ≤ W дней (fearoff; W = 60 / 120 / любое), доля резерва в счёте > sh → купить на f резерва.
   Запуск: node app/imp2_r4.js <out.json> */
const I = require('./imp2_sim.js'); const fs = require('fs'); const { c } = I;
const G = I.groups();
for (const g in G) for (const X of G[g]) { const b = X.ind.btcp, n = X.n, a = new Float64Array(n); for (let i = 0; i < n; i++) { let m = -Infinity; for (let j = Math.max(0, i - 89); j <= i; j++) if (b[j] > m) m = b[j]; a[i] = i >= 89 && b[i] >= m ? 1 : 0; } X.ind.bhi90 = a; }
const base = I.ev(G, I.BASE); console.log(I.HDR); console.log(I.row('основа', base, base));
const TR = { 'BTC < 1% от максимума': [c('btcath', '<', 1)], 'BTC < 3% от максимума': [c('btcath', '<', 3)], 'BTC на 90-дн. максимуме': [c('bhi90', '>', 0.5)] };
const out = [];
for (const [tn, tc] of Object.entries(TR)) for (const W of [60, 120, 1e6]) for (const f of [0.05, 0.1, 0.25]) for (const sh of [0, 0.5]) {
  const conds = [...tc, c('fng', '>', 52), ...(W < 1e6 ? [c('fearoff', '<', W + 0.5)] : [])];
  const S = { ...I.BASE, idle: [{ N: 0, f, sh, conds }] }; const r = I.ev(G, S, f === 0.1 && sh === 0.5);
  const t = `${tn}, жадн > 52, страх ≤ ${W < 1e6 ? W + ' дн' : 'любой'}, ${f * 100}% резерва, доля > ${sh * 100}%`;
  console.log(I.row(t, r, base)); out.push({ t, d: I.d(r, base), pass: I.passes(r, base), r: I.slim(r), bw: I.bw(r, base, 'n100') });
}
out.sort((a, b) => b.d - a.d); console.log('--- лучшие'); for (const o of out.slice(0, 8)) console.log(o.d.toFixed(3), o.pass ? '✔' : '·', o.r.n100.toFixed(0), o.bw.join('/'), o.t);
fs.writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out));
