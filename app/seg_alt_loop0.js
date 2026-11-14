/* Агент «АЛЬТЫ», круг 0: список альтов, цифры основы (combo-best: F + C1.25 + C6) по альтам и остальным, разбор по монетам:
   итог к DCA (полная история и половины), монета/BTC за историю, метрики дна/вершин по альтам и остальным, худшие альты.
   Запуск: node app/seg_alt_loop0.js <out.json> */
const Q = require('./seg_alt_sim.js');
const fs = require('fs');
const { K } = Q;
const G = Q.load();
const t0 = Date.now();
const r = Q.evs(G, Q.BASE);
console.log('время оценки', ((Date.now() - t0) / 1000).toFixed(1), 'с');
for (const g of Q.GR) {
  const a = G[g].filter(Q.isAlt).map((x) => x.name), o = G[g].filter((x) => !Q.isAlt(x)).map((x) => `${x.name}(${Q.cls(x.name)})`);
  console.log(`\n${g}: альтов ${a.length}: ${a.join(' ')}\n  остальные ${o.length}: ${o.join(' ')}`);
}
console.log('\nОснова по подгруппам (медиана, в плюсе, худшая, половины в плюсе, худшая половина):');
for (const g of Q.GR) for (const sub of ['alt', 'oth', 'all']) { const s = r[g][sub]; console.log(`  ${g} ${sub}: n ${s.n} мед ${s.med.toFixed(0)} плюс ${s.pos} худш ${s.worst.toFixed(1)} пол ${s.hpos}/${2 * s.n} хп ${s.hworst.toFixed(1)}`); }
// монета/BTC за всю историю и по половинам; бета, волатильность (медиана по истории)
const out = { r: Q.pack(r), coins: [] };
console.log('\nАльты: итог к DCA (полная/1-я/2-я половина) | монета к BTC за историю (×) | рост монеты (×) | бета180/вол180 медианы');
for (const g of Q.GR) for (const X of G[g]) {
  if (!Q.isAlt(X)) continue;
  const c = X.c, b = X.ind.btcp, n = X.n, h = Math.floor(n / 2);
  const ratio = (i, j) => (c[j] / c[i]) / (b[j] / b[i]);
  const be = [...X.ind.beta180].filter((v) => !isNaN(v)), vo = [...X.ind.vol180].filter((v) => !isNaN(v));
  const x = r.c[g].find((y) => y.name === X.name);
  const o = { g, name: X.name, n, full: x.full, h1: x.h1, h2: x.h2, relAll: ratio(0, n - 1), rel1: ratio(0, h - 1), rel2: ratio(h, n - 1), grow: c[n - 1] / c[0], beta: K.med(be), vol: K.med(vo) };
  out.coins.push(o);
}
out.coins.sort((a, b) => a.full - b.full);
for (const o of out.coins) console.log(`  ${o.g.padEnd(4)} ${o.name.padEnd(7)} ${o.full.toFixed(0).padStart(6)} / ${o.h1.toFixed(0).padStart(6)} / ${o.h2.toFixed(0).padStart(5)} | к BTC ${o.relAll.toFixed(2)} (${o.rel1.toFixed(2)} / ${o.rel2.toFixed(2)}) | рост ${o.grow.toFixed(2)} | β ${o.beta.toFixed(2)} вол ${o.vol.toFixed(0)} | дней ${o.n}`);
// связь итога с отношением к BTC
const cs = out.coins, rk = (v) => { const s = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), o = new Array(v.length); s.forEach(([, i], k) => (o[i] = k)); return o; };
const sp = (a, b) => { const ra = rk(a), rb = rk(b), m = (a.length - 1) / 2; let s = 0, sa = 0, sb = 0; for (let i = 0; i < a.length; i++) { s += (ra[i] - m) * (rb[i] - m); sa += (ra[i] - m) ** 2; sb += (rb[i] - m) ** 2; } return s / Math.sqrt(sa * sb); };
console.log(`\nСпирмен итог~отношение к BTC: ${sp(cs.map((x) => x.full), cs.map((x) => Math.log(x.relAll))).toFixed(2)}, итог~рост монеты: ${sp(cs.map((x) => x.full), cs.map((x) => Math.log(x.grow))).toFixed(2)}, итог~бета: ${sp(cs.map((x) => x.full), cs.map((x) => x.beta)).toFixed(2)}, итог~вол: ${sp(cs.map((x) => x.full), cs.map((x) => x.vol)).toFixed(2)}`);
// половины в минусе и монеты в минусе
console.log('Альты с половиной в минусе:', cs.filter((x) => x.h1 < 0 || x.h2 < 0).map((x) => `${x.name}(${x.g}) ${x.h1.toFixed(0)}/${x.h2.toFixed(0)}`).join(', '));
// метрики дна/вершин: альты и остальные (отбор + экзамен + 50 случайных)
const AL = ['sel', 'ex', 'rnd'].flatMap((g) => G[g].filter(Q.isAlt)), OT = ['sel', 'ex', 'rnd'].flatMap((g) => G[g].filter((x) => !Q.isAlt(x)));
out.mAlt = K.metrics(AL, Q.BASE); out.mOth = K.metrics(OT, Q.BASE);
console.log('\nМетрики альты:     ' + K.fmtM(out.mAlt));
console.log('Метрики остальные: ' + K.fmtM(out.mOth));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
