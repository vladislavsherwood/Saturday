/* tune3, круг 5: итоговая проверка кандидатов на всех группах, включая 100 новых (быстрый оценщик): медиана / в плюсе / половины / худшая
   половина по группам и сегментам, доход и строгая к combo2, средний лог-прирост и лучше/хуже по монетам 100 новых.
   Запуск: node app/tune3_final.js '{"имя":{...},...}' [выход.json] */
const T = require('./tune3_sim.js'); const Z = T.Z; const fs = require('fs');
const V = { combo2: {}, ...JSON.parse(process.argv[2]) }, OUT = process.argv[3];
const G = T.load(); const GR = ['sel', 'ex', 'rnd', 'n100']; let B = null; const res = {};
const f0 = (v) => (v == null ? '—' : v.toFixed(0));
for (const [tag, o] of Object.entries(V)) {
  const S = T.build(o), r = Z.evc(G, S, GR), R = Z.sum(r); if (!B) B = { r, R };
  const row = { o, R: {}, inc: {}, strict: {}, n100: {} };
  console.log(`\n== ${tag} ${JSON.stringify(o)} (правил ${S.rules.length})`);
  for (const s of Z.SEGS) {
    row.inc[s] = Z.inc(R, s) - Z.inc(B.R, s); row.strict[s] = Z.strict(R, B.R, s);
    const n = Z.mlog(r, B.r, s, ['n100']); row.n100[s] = n;
    row.R[s] = Object.fromEntries(GR.map((g) => [g, R[g][s] ? { med: +R[g][s].med.toFixed(1), pos: R[g][s].pos, n: R[g][s].n, hpos: R[g][s].hpos, hworst: +R[g][s].hworst.toFixed(1), worst: +R[g][s].worst.toFixed(1) } : null]));
    const q = GR.map((g) => (R[g][s] ? `${f0(R[g][s].med)}/${R[g][s].pos}из${R[g][s].n}/${R[g][s].hpos}/${R[g][s].hworst.toFixed(1)}` : '—')).join(' | ');
    const n100s = R.n100[s] && B.R.n100[s] ? (R.n100[s].pos < B.R.n100[s].pos || R.n100[s].hpos < B.R.n100[s].hpos || R.n100[s].med < B.R.n100[s].med - 1e-9 ? ' 100н·' : ' 100н✔') : '';
    console.log(`  ${s.padEnd(4)} доход ${row.inc[s] >= 0 ? '+' : ''}${row.inc[s].toFixed(3)} ${row.strict[s].length ? '· ' + row.strict[s].join(',') : '✔'}${n100s} | ${q} | 100н ср.лог ${n.m >= 0 ? '+' : ''}${n.m.toFixed(4)} (${n.u}/${n.d})`);
  }
  res[tag] = row;
}
if (OUT) fs.writeFileSync(OUT, JSON.stringify(res));
