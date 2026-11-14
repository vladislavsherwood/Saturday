/* Круг 9, плато для K3 = B + тихая вершина q + подтверждение паники OI < v, иначе lo. Запуск: node app/agent_loop9b.js */
const S = require('./agent_sim.js');
const { B, c } = S;
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
const GRP = [1, 1, 2, 2, 0, 3, 2, 4, 4, 3, 4, 4];
const mk = (q, v, lo) => { const rules = []; B.rules.forEach((r, i) => { if (GRP[i] === 2) rules.push({ ...r, conds: [...r.conds, c('oidd30', '<', v)] }, { ...r, act: Math.min(r.act, lo) }); else if (i === 11) rules.push({ ...r, act: -q }); else rules.push(r); }); return { base: 1, rules }; };
const b = S.evalAll(G, B);
console.log(S.HDR + ' | 100 новых | доход | ✔ | худшая монета отбора/экзамена');
for (const q of [0.3, 0.4, 0.5]) for (const v of [-6, -8, -10, -12]) for (const lo of [1.05, 1.1, 1.15]) {
  const r = S.evalAll(G, mk(q, v, lo));
  console.log(`${S.line(r)} | ${r.n100.med.toFixed(0)}/${r.n100.pos}/${r.n100.hpos}/${r.n100.hworst.toFixed(0)} | ${(S.inc(r) - S.inc(b)).toFixed(3)} ${S.passes(r, b) ? '✔' : '·'} | ${r.sel.worst.toFixed(1)}/${r.ex.worst.toFixed(0)} | тихая вершина ${q * 100}%, OI<${v}%, иначе ${Math.round((lo - 1) * 100)}%`);
}
