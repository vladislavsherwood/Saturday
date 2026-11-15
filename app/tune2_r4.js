/* tune2 круг 4: край плато множителя m (3…4, у сильного страха 75…100%) и 100 новых монет для кандидатов m = 2 / 2,5 / 3
   (финальная проверка: монеты и половины в плюсе, медиана, сегменты; лучше/хуже по монетам). */
const T = require('./tune2_sim.js');
const Z = T.Z;
const G = T.load(['sel', 'ex', 'rnd', 'n100']), L = ['sel', 'ex', 'rnd', 'n100'];
const B = T.ev(G, T.P0, L), b = Z.evc(G, T.build(T.P0), L);
for (const m of [3.2, 3.4, 3.6, 3.8, 4.0]) console.log(T.row('m=' + m, T.ev(G, { m }), B));
const s = (x) => `${x.med.toFixed(0)} / ${x.pos} из ${x.n} / ${x.hpos} пол. / худш.пол ${x.hworst.toFixed(1)}`;
console.log('\n100 новых: медиана / монет в плюсе / половин / худшая половина; сегменты альты, мемы; лучше/хуже (±0,5 п.п.)');
console.log('combo2: ' + s(B.n100.all) + ' | альты ' + s(B.n100.alt) + ' | мемы ' + s(B.n100.meme));
for (const m of [2, 2.5, 3]) {
  const r = Z.evc(G, T.build({ m }), L), R = Z.sum(r), ml = Z.mlog(r, b, 'all', ['n100']);
  console.log(`m=${m}: ` + s(R.n100.all) + ' | альты ' + s(R.n100.alt) + ' | мемы ' + s(R.n100.meme) + ` | лучше ${ml.u} / хуже ${ml.d}, ср. лог ${ml.m.toFixed(4)}`);
  const ch = r.n100.map((x, i) => [x.name, b.n100[i].f, x.f]).filter(([, y, x]) => Math.abs(x - y) > 0.5).sort((p, q) => (q[2] - q[1]) - (p[2] - p[1]));
  console.log('   больше всего: ' + ch.slice(0, 4).map(([n, y, x]) => `${n} ${y.toFixed(0)}→${x.toFixed(0)}`).join(', ') + ' | хуже: ' + ch.slice(-4).filter((q) => q[2] < q[1]).map(([n, y, x]) => `${n} ${y.toFixed(0)}→${x.toFixed(0)}`).join(', '));
}
