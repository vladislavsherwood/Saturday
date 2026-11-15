/* combo3, круг 1: вклад каждой правки отдельно, парами и всех вместе (быстрый оценщик agent_sim через combo2_sim; худший из двух сдвигов).
   Группы: отбор 17, экзамен 14, 50 случайных, 100 новых; сегменты (крупные/альты/мемы — единые списки combo2); доход = Σ лог-медиан отбор+экзамен+50 сл.
   к combo2; строгая проверка к combo2 (всё и каждый сегмент); 100 новых — медиана, плюс, половины, лучше/хуже по монетам; метрики дна/вершин (81 монета);
   резерв в стейблах 4,5% годовых (imp2_sim.edge с S.yld). Тождество упрощения — разница по каждой монете.
   Запуск: node app/combo3_loop1.js <выход.json> */
const Z = require('./combo2_sim.js'); const { K } = Z;
const C3 = require('./combo3_sim.js');
const I2 = require('./imp2_sim.js');
const AS = require('./agent_sim.js');
const fs = require('fs');
const G = Z.load(['sel', 'ex', 'rnd', 'n100']);
const E0 = (X, S, p) => K.E(X, S, p);
const EY = (X, S, p) => Math.min(I2.edge(X, S, 0, p).e, I2.edge(X, S, 1, p).e);
function evc(S) {
  const E = S.yld ? EY : E0, o = {};
  for (const g in G) o[g] = G[g].map((X) => ({ name: X.name, seg: X.seg, f: E(X, S, 'full'), h1: E(X, S, 'h1'), h2: E(X, S, 'h2') }));
  return o;
}
const V = {
  'combo2': {},
  'combo2 упрощённая (simp)': { simp: 1 },
  'combo2 без упрощения + все правки': { t1: 1, t2: 1, t3: 1 },
  'simp + t2 (паника ×2,5)': { simp: 1, t2: 1 },
  'simp + t3 (corr > 0,60)': { simp: 1, t3: 1 },
  'simp + t1 (OI < −26 → 15%)': { simp: 1, t1: 1 },
  'simp + t2 + t3': { simp: 1, t2: 1, t3: 1 },
  'simp + t2 + t1': { simp: 1, t2: 1, t1: 1 },
  'simp + t3 + t1': { simp: 1, t3: 1, t1: 1 },
  'combo3 (simp + t1 + t2 + t3)': { simp: 1, t1: 1, t2: 1, t3: 1 },
  'combo2 + резерв 4,5%': { yld: 0.045 },
  'combo3 + резерв 4,5%': { simp: 1, t1: 1, t2: 1, t3: 1, yld: 0.045 },
};
const out = {}; let b = null, bs = null, rb = null, by = null, bys = null;
const t0 = Date.now();
for (const [nm, o] of Object.entries(V)) {
  const S = C3.make(o), r = evc(S), s = Z.sum(r);
  if (!b) { b = r; bs = s; }
  if (nm === 'combo2 + резерв 4,5%') { by = r; bys = s; }
  const x = { opt: o, n: S.rules.length, inc: {}, strict: {}, mlog: {}, R: {} };
  for (const g in s) { x.R[g] = {}; for (const sg of Z.SEGS) if (s[g][sg]) { const { e, ...y } = s[g][sg]; x.R[g][sg] = y; } }
  for (const sg of Z.SEGS) {
    x.inc[sg] = Z.inc(s, sg) - Z.inc(bs, sg); x.strict[sg] = Z.strict(s, bs, sg);
    x.mlog[sg] = { old: Z.mlog(r, b, sg, ['sel', 'ex', 'rnd']), n100: Z.mlog(r, b, sg, ['n100']) };
  }
  // разница по монетам с combo2 (макс. по модулю, лог) — для проверки тождества
  let mx = 0; for (const g in r) r[g].forEach((y, i) => { mx = Math.max(mx, Math.abs(Math.log1p(y.f / 100) - Math.log1p(b[g][i].f / 100))); });
  x.maxdiff = mx;
  if (o.yld && o.simp && bys) { x.vs_yld = { inc: Z.inc(s, 'all') - Z.inc(bys, 'all'), strict: Z.strict(s, bys, 'all') }; }
  if (!o.yld) { const A = [...G.sel, ...G.ex, ...G.rnd]; x.metrics = AS.metrics(A, S); }
  x.coins = Object.fromEntries(Object.entries(r).map(([g, a]) => [g, a.map((y) => [y.name, +y.f.toFixed(2), +y.h1.toFixed(2), +y.h2.toFixed(2)])]));
  out[nm] = x;
  const R = x.R;
  console.log(`\n== ${nm} (${x.n} правил) [${((Date.now() - t0) / 1000).toFixed(0)} с] макс. разница по монете ${(100 * mx).toFixed(3)}%`);
  for (const sg of Z.SEGS) {
    const q = ['sel', 'ex', 'rnd', 'n100'].map((g) => (R[g][sg] ? `${R[g][sg].med.toFixed(0)}/${R[g][sg].pos}из${R[g][sg].n}/${R[g][sg].hpos}/${R[g][sg].hworst.toFixed(1)}/${R[g][sg].worst.toFixed(0)}` : '—')).join(' | ');
    console.log(`  ${sg.padEnd(4)} доход ${x.inc[sg] >= 0 ? '+' : ''}${x.inc[sg].toFixed(3)} ${x.strict[sg].length ? '· ' + x.strict[sg].join(',') : '✔'} | ${q} | 100н лучше/хуже ${x.mlog[sg].n100.u}/${x.mlog[sg].n100.d}`);
  }
  if (x.metrics) console.log('  ' + AS.fmtM(x.metrics));
  if (x.vs_yld) console.log(`  к combo2 + 4,5%: доход ${x.vs_yld.inc.toFixed(3)} ${x.vs_yld.strict.length ? '· ' + x.vs_yld.strict.join(',') : '✔'}`);
  fs.writeFileSync(process.argv[2], JSON.stringify(out));
}
