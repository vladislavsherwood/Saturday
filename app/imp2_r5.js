/* imp2, круг 5 (по монетам): финальная проверка лучшего варианта — основа без смены правил + доход на резерв в стейблах.
   Плато по доходу (0 / 3 / 4,5 / 6%), поверх combo-best и combo2-best; для сравнения лучшие отвергнутые правки кругов 1 и 4 поверх combo2.
   Запуск: node app/imp2_r5.js <out.json> */
const I = require('./imp2_sim.js'); const Z = require('./combo2_sim.js'); const fs = require('fs'); const { c } = I;
const G = Z.load(); I.K.prep(G);
for (const g in G) for (const X of G[g]) { const b = X.ind.btcp, n = X.n, a = new Float64Array(n); for (let i = 0; i < n; i++) { let m = -Infinity; for (let j = Math.max(0, i - 89); j <= i; j++) if (b[j] > m) m = b[j]; a[i] = i >= 89 && b[i] >= m ? 1 : 0; } X.ind.bhi90 = a; }
const C2J = JSON.parse(fs.readFileSync(__dirname + '/found/combo2-best.json', 'utf8')); const C2 = { base: C2J.base, rules: C2J.rules };
const out = {}; console.log(I.HDR);
for (const [bn, B] of [['combo-best', I.BASE], ['combo2-best', C2]]) {
  const b = I.ev(G, B); out[bn] = { base: I.slim(b) }; console.log(I.row(bn, b, b));
  for (const y of [0.03, 0.045, 0.06]) { const r = I.ev(G, { ...B, yld: y }); console.log(I.row(`${bn} + доход на резерв ${y * 100}%`, r, b)); out[bn]['yld' + y] = { d: I.d(r, b), pass: I.passes(r, b), bw: I.bw(r, b, 'n100'), r: I.slim(r) }; }
  if (bn === 'combo2-best') for (const [t, S] of [['+ возврат 25% резерва при BTC < 1% от максимума и жадности > 52 (круг 4)', { ...B, idle: [{ N: 0, f: 0.25, sh: 0, conds: [c('btcath', '<', 1), c('fng', '>', 52)] }] }],
    ['+ возврат 3% в день после 45 дней без сигналов при доле резерва > 50% (круг 1)', { ...B, idle: [{ N: 45, f: 0.03, sh: 0.5, conds: [] }] }]]) {
    const r = I.ev(G, S, false); console.log(I.row(t, r, b)); out[bn][t] = { d: I.d(r, b), pass: I.passes(r, b), bw: I.bw(r, b, 'n100'), r: I.slim(r) };
  }
}
fs.writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out, null, 1));
