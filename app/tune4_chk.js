/* tune4: проверка кандидата — быстрый оценщик на отборе/экзамене/50 случайных + 100 новых (монеты/половины в плюсе, медиана, лучше/хуже к combo2).
   Запуск: node app/tune4_chk.js '<JSON P>' ['<JSON P2>' ...] */
const T = require('./tune4_sim.js'); const Z = T.Z;
const G = T.load(); const { b, bs } = T.base(G);
for (const a of process.argv.slice(2)) {
  const P = JSON.parse(a); const x = T.run(G, P, [...T.GR, 'n100']);
  const n = x.R.n100.all, n0 = bs.n100.all, m = Z.mlog(x.r, b, 'all', ['n100']);
  const segs = Z.SEGS.map((s) => { const q = Z.mlog(x.r, b, s, ['sel', 'ex', 'rnd']); return `${s} ${q.u}/${q.d}`; }).join(' ');
  console.log(`${a}\n  ${T.line(x)}\n  100 новых: медиана ${n.med.toFixed(1)} (было ${n0.med.toFixed(1)}), в плюсе ${n.pos}/${n0.pos}, половин ${n.hpos}/${n0.hpos}, худшая пол. ${n.hworst.toFixed(1)}/${n0.hworst.toFixed(1)}; ср.лог ${m.m.toFixed(4)} лучше/хуже ${m.u}/${m.d} | старые лучше/хуже: ${segs}`);
}
