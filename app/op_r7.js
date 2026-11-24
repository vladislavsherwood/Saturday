/* op, круг 7 — фильтры к другим правилам combo6 по диагностике круга 1 (Б):
   (а) фандинг (29–31, продажи на высоком фандинге) → копить (act 1e-6), когда на опционах страх: VVIX > X, VIX9D/VIX3M > X, VIX/SMA50 > X, реализ. вол BTC / ср.90 > X,
       DVOL > X, DVOL/SMA50 > X; для сравнения st F (VIX > 30) и прибавка сверх F;
   (б) разворот BTC (правило 28: BTC +20% за 30 дн → весь резерв) → только взнос (act 1) или половина (act 1,5), когда DVOL / реализ. < X, GVZ > X, put/call z < X, DVOL > X.
   Запуск: node op_r7.js [c6|c7] (лог scratchpad/op/r7_<основа>.txt) */
const O = require('./op_lib.js'), { c } = O;
const BK = process.argv[2] || 'c6'; O.tee('r7_' + BK);
const S0 = O.base(BK);
const isF = (r) => O.famOf(r) === 'fund', isR = (r) => O.famOf(r) === 'rev';
const fund = (conds, S = S0) => O.preMod(isF, (r) => ({ act: 1e-6, conds: [...r.conds, ...conds] }), S);
console.log(`основа ${BK}: ${S0.rules.length} правил`);
console.log('(а) фандинг → копить при опционном страхе');
const SF = fund([c('op_vix', '>', 30)]);
O.run('st F: VIX > 30', SF);
for (const [nm, ind, xs] of [['VIX >', 'op_vix', [22, 25, 35]], ['VVIX >', 'op_vvix', [110, 120, 130]], ['VIX9D/VIX3M >', 'op_ts', [0.95, 1.0, 1.1]], ['VIX/SMA50 >', 'op_vixr', [1.2, 1.3, 1.5]],
  ['реализ. вол BTC / ср.90 >', 'op_rvr', [1.3, 1.5, 1.7]], ['DVOL >', 'op_dv', [65, 75, 85]], ['DVOL/SMA50 >', 'op_dvr', [1.1, 1.2, 1.3]], ['SKEW <', 'op_skew', [120, 125, 130]]])
  for (const x of xs) { const op = nm.trim().endsWith('<') ? '<' : '>'; O.run(`${nm} ${x}`, fund([c(ind, op, x)])); }
console.log('  сверх st F (F + сигнал):');
for (const [nm, ind, x] of [['VVIX > 120', 'op_vvix', 120], ['VIX9D/VIX3M > 1', 'op_ts', 1], ['реализ. вол ×1,5', 'op_rvr', 1.5], ['VIX/SMA50 > 1,3', 'op_vixr', 1.3]]) O.run(`F + ${nm}`, fund([c(ind, '>', x)], SF));
console.log('\n(б) разворот BTC (правило 28) → взнос / половина при опционных признаках');
for (const [nm, ind, op, xs] of [['DVOL/реализ. <', 'op_dvrv', '<', [0.9, 1.0, 1.1]], ['GVZ >', 'op_gvz', '>', [18, 20, 22]], ['put/call z <', 'op_pcez', '<', [-0.5, -1, -1.5]], ['DVOL >', 'op_dv', '>', [60, 70, 80]],
  ['VIX <', 'op_vix', '<', [13, 15, 17]], ['SKEW >', 'op_skew', '>', [140, 145, 150]]])
  for (const [an, a] of [['взнос', 1], ['половина', 1.5]]) for (const x of xs) O.run(`${nm} ${x} → ${an}`, O.preMod(isR, (r) => ({ act: a, conds: [...r.conds, c(ind, op, x)] }), S0));
