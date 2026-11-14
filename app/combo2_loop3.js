/* Объединение 2, круг 3: не держится ли выигрыш выбранного сочетания на одном режиме рынка — новые правила (A1, AS, CM2, список|B65) включены
   только до 2025-01-01 или только с 2025-01-01 (по дню решения; C из основы — всегда). Быстрый оценщик; сегменты; 100 новых. */
const Z = require('./combo2_sim.js'); const { c } = Z;
const G = Z.load(); const D = Math.round(Date.UTC(2025, 0, 1) / 864e5);
const ALL3 = { a1: true, as: true, cm2: true, b65: 'list' };
const b = Z.evc(G, Z.BASE), bs = Z.sum(b);
for (const [tag, o] of [['всё время', ALL3], ['только до 2025', { ...ALL3, when: [c('t', '<', D)] }], ['только с 2025', { ...ALL3, when: [c('t', '>', D - 1)] }]]) {
  const r = Z.evc(G, Z.build(o)), R = Z.sum(r);
  console.log(`${tag.padEnd(16)} ` + Z.SEGS.map((s) => { const m = Z.mlog(r, b, s, ['sel', 'ex', 'rnd']), n = Z.mlog(r, b, s, ['n100']); return `${s} ${(Z.inc(R, s) - Z.inc(bs, s)).toFixed(3)}${Z.strict(R, bs, s).length ? '·' + Z.strict(R, bs, s).join(',') : '✔'} ср.лог ${m.m.toFixed(4)} (${m.u}/${m.d}) 100н ${n.m.toFixed(4)} (${n.u}/${n.d})`; }).join(' | ') + ` | 100н ${R.n100.all.med.toFixed(0)} ${R.n100.all.pos}/${R.n100.all.hpos}`);
}
