/* imp8, круг 1б: упрощённая S1 (без мёртвых #5, #6-8, #10) и удаление отдельных условий внутри оставшихся правил. Запуск: node app/imp8_loop1b.js */
const I = require('./imp8_sim.js'); const { K } = I;
const G = I.load(); const base = K.ev(G, I.BASE, false);
const S1 = I.drop(I.BASE, [5, 6, 7, 8, 10]);
const show = (t, S) => { const r = K.ev(G, S, false); console.log(`${K.d(r, base) >= 0 ? '+' : ''}${K.d(r, base).toFixed(3)} ${K.passes(r, base) ? '✔' : '·'} ${K.line(r)} | n=${S.rules.length} | ${t} | ${K.why(r, base)}`); return r; };
show('S1', S1);
show('S1 без #21-22 (одна тихая вершина)', I.drop(S1, [], (r) => r.conds.some((x) => x.ind === 'qt')));
// удаление одного условия в одном правиле S1 (все копии C/C6 одной группы правятся вместе по совпадению набора условий без rel180/второго usdt)
const key = (r) => JSON.stringify(r.conds.filter((x) => x.ind !== 'rel180' && !(x.ind === 'usdt' && x.v === 1.2)));
const seen = new Set();
S1.rules.forEach((r0) => {
  const k = key(r0); if (seen.has(k)) return; seen.add(k);
  const cs = JSON.parse(k); if (cs.length < 2) return;
  cs.forEach((cd, q) => {
    const S = { ...S1, rules: S1.rules.map((r) => (key(r) !== k ? r : { ...r, conds: r.conds.filter((x) => !(x.ind === cd.ind && x.op === cd.op && x.v === cd.v)) })) };
    show(`act ${r0.act} [${cs.map((x) => x.ind + x.op + x.v).join(' ')}] без ${cd.ind}${cd.op}${cd.v}`, S);
  });
});
