/* tune3: перебор одного или нескольких параметров (сетка) поверх текущего набора; сравнение с combo2 и с текущим набором.
   Запуск: node app/tune3_scan.js '{"fs":[0.14,0.15,0.16]}' ['{"текущие": ...}'] [выход.json]
   Вывод: доход (Σ лог-медиан отбор/экзамен/50 случ.) всей выборки и сегментов к текущему; строгая к текущему (всё и сегменты); медианы. */
const T = require('./tune3_sim.js'); const fs = require('fs');
const grid = JSON.parse(process.argv[2]), cur = JSON.parse(process.argv[3] || '{}'), OUT = process.argv[4];
const G = T.load(['sel', 'ex', 'rnd']);
const B0 = T.evalv(G, {}), BC = Object.keys(cur).length ? T.evalv(G, cur) : B0;
const keys = Object.keys(grid); let combos = [{}];
for (const k of keys) combos = combos.flatMap((o) => grid[k].map((v) => ({ ...o, [k]: v })));
const res = [];
const f = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
for (const o of combos) {
  const p = { ...cur, ...o }, X = T.evalv(G, p), c = T.cmp(X, BC), c0 = T.cmp(X, B0);
  const row = { o, p, inc: Object.fromEntries(Object.entries(c).map(([s, v]) => [s, v.inc])), strict: Object.fromEntries(Object.entries(c).map(([s, v]) => [s, v.strict])), inc0: c0.all.inc, strict0: Object.values(c0).flatMap((v) => v.strict).length,
    med: ['sel', 'ex', 'rnd'].map((g) => Math.round(X.R[g].all.med)) };
  res.push(row);
  const st = ['all', 'big', 'alt', 'meme'].map((s) => (c[s].strict.length ? s + '·' + c[s].strict.join(',') : '')).filter(Boolean).join(' ');
  console.log(`${JSON.stringify(o).padEnd(28)} доход ${f(c.all.inc)} | кр ${f(c.big.inc)} ал ${f(c.alt.inc)} мем ${f(c.meme.inc)} | к combo2 ${f(c0.all.inc)} | ${row.med.join('/')} | ${st || '✔'}`);
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res));
