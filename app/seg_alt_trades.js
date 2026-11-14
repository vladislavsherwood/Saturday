/* Агент «АЛЬТЫ»: разбор сделок основы на одной монете (быстрый оценщик, сдвиг 0): по кварталам — сколько продано/куплено резерва,
   по каким правилам, средняя цена к максимуму/минимуму следующих 180 дней; доля денег в стейблах; итог к DCA.
   Запуск: node app/seg_alt_trades.js TON HYPE XMR ... */
const Q = require('./seg_alt_sim.js');
const { K } = Q;
const G = Q.load();
const all = Object.values(G).flat();
const S = Q.BASE;
const day = (t) => new Date(t * 864e5).toISOString().slice(0, 10);
const RN = (q) => { const r = S.rules[q]; return q < 0 ? 'base' : `#${q}(${r.act})`; };
for (const nm of process.argv.slice(2)) {
  const X = all.find((x) => x.name === nm); if (!X) { console.log('нет', nm); continue; }
  const res = K.edge(X, S, 0, 'full', true), c = X.c, n = X.n;
  const fmax = (i) => { let m = 0; for (let j = i; j < Math.min(n, i + 180); j++) m = Math.max(m, c[j]); return m; };
  const fmin = (i) => { let m = Infinity; for (let j = i; j < Math.min(n, i + 180); j++) m = Math.min(m, c[j]); return m; };
  console.log(`\n=== ${nm} (${Q.cls(nm)}) ${day(X.t[0])}…${day(X.t[n - 1])} итог к DCA ${res.e.toFixed(0)}% (h1 ${K.E(X, S, 'h1').toFixed(0)} h2 ${K.E(X, S, 'h2').toFixed(0)}), цена ${c[0].toPrecision(3)} → ${c[n - 1].toPrecision(3)}`);
  const Qr = {};
  for (const t of res.tr) {
    const k = day(X.t[t.i]).slice(0, 4) + 'Q' + (Math.floor(+day(X.t[t.i]).slice(5, 7) / 3.01) + 1);
    const o = (Qr[k] = Qr[k] || { s: 0, b: 0, sp: 0, bp: 0, rs: {}, rb: {}, p0: c[t.i] });
    if (t.s < 0) { o.s += t.amt; o.sp += t.amt * (t.p / fmax(t.i)); o.rs[RN(t.q)] = (o.rs[RN(t.q)] || 0) + 1; }
    else if (t.s > 0) { o.b += t.amt; o.bp += t.amt * (t.p / fmin(t.i)); o.rb[RN(t.q)] = (o.rb[RN(t.q)] || 0) + 1; }
  }
  for (const k in Qr) { const o = Qr[k]; console.log(`  ${k} цена~${o.p0.toPrecision(3)} | продано $${o.s.toFixed(0)} (к макс.180д ${o.s ? ((100 * o.sp) / o.s).toFixed(0) : '-'}%) ${Object.entries(o.rs).map(([a, b]) => a + '×' + b).join(' ')} | куплено резерва $${o.b.toFixed(0)} (к мин.180д ${o.b ? ((100 * o.bp) / o.b - 100).toFixed(0) : '-'}% выше) ${Object.entries(o.rb).map(([a, b]) => a + '×' + b).join(' ')}`); }
  console.log(`  в конце: монет на $${(res.units * c[n - 1]).toFixed(0)}, стейблов $${res.cash.toFixed(0)}, DCA $${res.dca.toFixed(0)}`);
}
