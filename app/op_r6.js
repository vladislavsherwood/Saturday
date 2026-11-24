/* op, круг 6 — эйфория/вершина: самоуспокоение на опционах → продавать больше; страх на опционах → продавать меньше; новые правила продаж.
   Семьи combo6 (0-based): qt 31–38, вершина 39–58, памп 60–68, эйфория 70–75 («продажи на подъёме»).
   H6a: продажи на подъёме × 1,5, если опционы спокойны: put/call z < X, put/call 10 д < X, VIX < X, VIX9D/VIX3M < X, DVOL < X, перцентиль DVOL < X.
   H6b: продажи на подъёме × 0,5, если на опционах страх: VIX/SMA50 > X, VIX > X, DVOL/SMA50 > X, SKEW > X.
   H6c: новые правила продаж (в конце, только дни без сигнала): DVOL < X и страх > Y → продать f; put/call z < X и страх > Y → f; SKEW > 150 и BTC +20% за 30 д → f;
        DVOL ETH / DVOL BTC > 1,4 и альт → f.
   Запуск: node op_r6.js [c6|c7] (лог scratchpad/op/r6_<основа>.txt) */
const O = require('./op_lib.js'), { c } = O;
const BK = process.argv[2] || 'c6'; O.tee('r6_' + BK);
const S0 = O.base(BK);
const UP = ['qt', 'top', 'pump', 'euph'];
const pick = (fams) => (r) => fams.includes(O.famOf(r)) && r.act < 0;
const mod = (fams, conds, m) => O.preMod(pick(fams), (r) => ({ act: O.sellAct(r.act, m), conds: [...r.conds, ...conds] }), S0);
console.log(`основа ${BK}: ${S0.rules.length} правил`);
console.log('H6a: самоуспокоение → продажи на подъёме ×1,5 (все семьи qt/вершина/памп/эйфория; отдельно вершина+памп)');
const A = [['put/call z <', 'op_pcez', '<', [-0.5, -1, -1.5]], ['put/call 10д <', 'op_pce10', '<', [0.45, 0.5, 0.55]], ['VIX <', 'op_vix', '<', [12, 13, 14]],
  ['VIX9D/VIX3M <', 'op_ts', '<', [0.75, 0.8, 0.85]], ['DVOL <', 'op_dv', '<', [40, 45, 50]], ['DVOL перц. <', 'op_dvp', '<', [0.1, 0.2, 0.3]]];
for (const [nm, ind, op, xs] of A) for (const [fn, fams] of [['все', UP], ['верш+памп', ['top', 'pump']]]) for (const x of xs) O.run(`${nm} ${x} → ×1,5 ${fn}`, mod(fams, [c(ind, op, x)], 1.5));
console.log('\nH6b: страх на опционах → продажи на подъёме ×0,5');
const B = [['VIX/SMA50 >', 'op_vixr', '>', [1.2, 1.3, 1.5]], ['VIX >', 'op_vix', '>', [22, 25, 30]], ['DVOL/SMA50 >', 'op_dvr', '>', [1.1, 1.2, 1.3]], ['SKEW >', 'op_skew', '>', [140, 145, 150]], ['MOVE/SMA50 >', 'op_mover', '>', [1.1, 1.2, 1.3]]];
for (const [nm, ind, op, xs] of B) for (const x of xs) O.run(`${nm} ${x} → ×0,5 все`, mod(UP, [c(ind, op, x)], 0.5));
console.log('\nH6c: новые правила продаж в конце списка');
for (const f of [0.03, 0.05, 0.1]) {
  for (const [dv, fg] of [[40, 70], [45, 70], [50, 70], [45, 60], [45, 80]]) O.run(`DVOL < ${dv} и страх > ${fg} → −${f}`, O.ins([{ act: -f, conds: [c('op_dv', '<', dv), c('fng', '>', fg)] }], 'end'));
  for (const [z, fg] of [[-1, 70], [-1.5, 70], [-1.5, 60]]) O.run(`put/call z < ${z} и страх > ${fg} → −${f}`, O.ins([{ act: -f, conds: [c('op_pcez', '<', z), c('fng', '>', fg)] }], 'end'));
  O.run(`SKEW > 150 и BTC +20% за 30д → −${f}`, O.ins([{ act: -f, conds: [c('op_skew', '>', 150), c('btcr30', '>', 20)] }], 'end'));
  O.run(`DVOL ETH/BTC > 1,4 и альт → −${f}`, O.ins([{ act: -f, conds: [c('op_dverat', '>', 1.4), c('isalt', '>', 0.5)] }], 'end'));
}
