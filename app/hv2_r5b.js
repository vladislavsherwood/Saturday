/* hv2, круг 5б: две ступени (вес ½ при hvv > t1, 1 при hvv > t2; U 250, ×2) — сдвиги порогов, для записи правилами. */
const X = require('./hv2_lib.js'), { H } = X;
for (const [t1, t2] of [[110, 130], [100, 120], [105, 125], [115, 135], [120, 140], [100, 130], [110, 140], [90, 120]]) for (const M of [2]) {
  const r = X.run('', { gf: X.steps([[t1, 0.5], [t2, 1]]), U: 250, M }, { quiet: true });
  console.log(`2 ступени >${t1} → ½, >${t2} → 1, ×${M}`.padEnd(36), `доход ${H.sg(r.all)} ${r.ok ? '✔' : '✗'} БД ${H.sg(r.hvInc)} БД81 ${H.sg(r.hv81.m, 3)} (${r.hv81.u}/${r.hv81.d}) БД100н ${H.sg(r.nhv.m, 3)} (${r.nhv.u}/${r.nhv.d}) 81 ${H.sg(r.m81.m, 3)} 100н ${H.sg(r.n.m, 3)} PUMP ${r.pump.toFixed(0)}${r.why ? ' | ' + r.why.slice(0, 60) : ''}`);
}
