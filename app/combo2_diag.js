/* Объединение 2: разбор выбранного варианта по монетам — кто хуже основы (полная история и половины), откуда провал «B65 по поведению» у крупных. */
const Z = require('./combo2_sim.js'); const G = Z.load();
const A = Z.build({ a1: true, as: true, cm2: true, b65: 'list' }), Bh = Z.build({ a1: true, as: true, cm2: true, b65: 'b' });
const r0 = Z.evc(G, Z.BASE), r1 = Z.evc(G, A), r2 = Z.evc(G, Bh);
const f = (v) => v.toFixed(1);
console.log('Крупные: основа → B65 по поведению → список|B65 (вся / 1-я / 2-я половина)');
r0.sel.forEach((x, i) => { if (x.seg !== 'big') return; const y = r2.sel[i], z = r1.sel[i]; console.log(`  ${x.name}: ${f(x.f)}/${f(x.h1)}/${f(x.h2)} → ${f(y.f)}/${f(y.h1)}/${f(y.h2)} → ${f(z.f)}/${f(z.h1)}/${f(z.h2)}`); });
for (const g of ['sel', 'ex', 'rnd', 'n100']) {
  const L = r1[g].map((x, i) => ({ x, y: r0[g][i], d: Z.L1(x.f) - Z.L1(r0[g][i].f) })).filter((q) => q.d < -0.02 || q.x.h1 < q.y.h1 - 1 || q.x.h2 < q.y.h2 - 1).sort((a, b) => a.d - b.d);
  console.log(`\n${g}: хуже основы (лог-итог < −0,02 или половина хуже на 1 п.п.) — ${L.length}`);
  for (const q of L.slice(0, 14)) console.log(`  ${q.x.name} (${q.x.seg}): ${f(q.y.f)} → ${f(q.x.f)} | половины ${f(q.y.h1)}→${f(q.x.h1)}, ${f(q.y.h2)}→${f(q.x.h2)}`);
}
