/* Объединение 2, круг 1: варианты по монетам (быстрый оценщик): основа; + альты (A1 + AS); + мемы (CM2); + крупные (B65, список|B65);
   все три (произведение множителей / максимум не-C множителей); все три + TA. Вся выборка (строгая, доход), сегменты, 100 новых, метрики.
   Запуск: node app/combo2_loop1.js [выход.json] */
const Z = require('./combo2_sim.js'); const { K } = Z; const fs = require('fs');
const OUT = process.argv[2];
const G = Z.load();
const V = {
  'основа': {},
  '+альты (A1+AS)': { a1: true, as: true },
  '+мемы (CM2)': { cm2: true },
  '+крупные B65': { b65: 'b' },
  '+крупные список|B65': { b65: 'list' },
  'все три (B65)': { a1: true, as: true, cm2: true, b65: 'b' },
  'все три (список|B65)': { a1: true, as: true, cm2: true, b65: 'list' },
  'все три (список|B65), максимум': { a1: true, as: true, cm2: true, b65: 'list', combine: 'max' },
  'все три (B65) + TA': { a1: true, as: true, cm2: true, b65: 'b', ta: true },
  'все три (список|B65) + TA': { a1: true, as: true, cm2: true, b65: 'list', ta: true },
  'все три (список|B65) + TA, максимум': { a1: true, as: true, cm2: true, b65: 'list', ta: true, combine: 'max' },
};
const only = process.env.ONLY ? process.env.ONLY.split('|') : null;
const res = {}; let b = null, bs = null; const t0 = Date.now();
const f0 = (v) => (v == null ? '—' : v.toFixed(0));
for (const [tag, o] of Object.entries(V)) {
  if (only && tag !== 'основа' && !only.includes(tag)) continue;
  const S = Z.build(o), r = Z.evc(G, S), R = Z.sum(r);
  if (!b) { b = r; bs = R; }
  const m = K.metrics([...G.sel, ...G.ex, ...G.rnd], S);
  const row = { o, nrules: S.rules.length, R: {}, inc: {}, strict: {}, mlog: {}, m };
  for (const g in R) { row.R[g] = {}; for (const s of Z.SEGS) if (R[g][s]) { const { e, ...x } = R[g][s]; row.R[g][s] = x; } }
  for (const s of Z.SEGS) { row.inc[s] = Z.inc(R, s) - Z.inc(bs, s); row.strict[s] = Z.strict(R, bs, s); row.mlog[s] = { old: Z.mlog(r, b, s, ['sel', 'ex', 'rnd']), n100: Z.mlog(r, b, s, ['n100']) }; }
  res[tag] = row;
  console.log(`\n== ${tag} (правил ${S.rules.length}) [${((Date.now() - t0) / 1000).toFixed(0)} с]`);
  for (const s of Z.SEGS) {
    const q = ['sel', 'ex', 'rnd', 'n100'].map((g) => R[g][s] ? `${f0(R[g][s].med)}/${R[g][s].pos}из${R[g][s].n}/${R[g][s].hpos}/${R[g][s].hworst.toFixed(1)}` : '—').join(' | ');
    const ml = row.mlog[s];
    console.log(`  ${s.padEnd(4)} доход ${row.inc[s] >= 0 ? '+' : ''}${row.inc[s].toFixed(3)} ${row.strict[s].length ? '· ' + row.strict[s].join(',') : '✔'} | ${q} | ср.лог старые ${ml.old.m >= 0 ? '+' : ''}${ml.old.m.toFixed(4)} (${ml.old.u}/${ml.old.d}) 100н ${ml.n100.m >= 0 ? '+' : ''}${ml.n100.m.toFixed(4)} (${ml.n100.u}/${ml.n100.d})`);
  }
  console.log('  ' + K.fmtM(m));
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(res));
}
// монеты, где вариант «все три» отличается от суммы отдельных изменений (пересечения)
