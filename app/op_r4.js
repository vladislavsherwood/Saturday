/* op, круг 4 — продажи на страхе (правила 12–27 combo6; в combo7 — и копии К4) и опционный режим.
   (а) не продавать (act = 1, обычный взнос) или продавать вдвое меньше, когда опционы показывают капитуляцию/всплеск страха:
       DVOL/SMA50 > X, DVOL за 7 дн × X, DVOL > X, put/call акций 10 д > X, VIX9D/VIX3M > X, VVIX > X (диагностика круга 1: продажи на страхе при DVOL/SMA50 > 1,3 — перед ростом, +12,8%).
   (б) продавать больше (× 1,5), когда опционы спокойны (самоуспокоение рядом со страхом в крипте): VIX < X, GVZ > X, put/call 10 д < X, VIX9D/VIX3M < X, put/call z < X;
       с возрастом монеты > 365 и без него.
   Запуск: node op_r4.js [c6|c7] (лог scratchpad/op/r4_<основа>.txt) */
const O = require('./op_lib.js'), { c } = O;
const BK = process.argv[2] || 'c6'; O.tee('r4_' + BK);
const S0 = O.base(BK);
const pickF = (r) => ['fear', 'k4'].includes(O.famOf(r));
const mod = (conds, actF, S = S0) => O.preMod(pickF, (r) => ({ act: actF(r.act), conds: [...r.conds, ...conds] }), S);
console.log(`основа ${BK}: ${S0.rules.length} правил`);
console.log('(а) капитуляция на опционах → продажи на страхе ×0 (взнос) / ×0,5');
const A = [['DVOL/SMA50 >', 'op_dvr', '>', [1.2, 1.3, 1.4]], ['DVOL за 7 дн ×', 'op_dvr7', '>', [1.15, 1.25, 1.35]], ['DVOL >', 'op_dv', '>', [70, 80, 90]],
  ['put/call 10д >', 'op_pce10', '>', [0.7, 0.75, 0.8]], ['VIX9D/VIX3M >', 'op_ts', '>', [1.0, 1.1, 1.2]], ['VVIX >', 'op_vvix', '>', [110, 120, 130]], ['DVOL/реализ. <', 'op_dvrv', '<', [0.9, 1.0, 1.1]]];
for (const [nm, ind, op, xs] of A) for (const [mn, f] of [['×0', () => 1], ['×0,5', (a) => O.sellAct(a, 0.5)]]) for (const x of xs) O.run(`${nm} ${x} → ${mn}`, mod([c(ind, op, x)], f));
console.log('\n(б) спокойные опционы → продажи на страхе ×1,5 (± монете > 365 дн)');
const B = [['VIX <', 'op_vix', '<', [13, 15, 17]], ['GVZ >', 'op_gvz', '>', [18, 20, 22]], ['put/call 10д <', 'op_pce10', '<', [0.5, 0.55, 0.6]], ['VIX9D/VIX3M <', 'op_ts', '<', [0.75, 0.8, 0.85]],
  ['put/call z <', 'op_pcez', '<', [-1, -1.5, -2]], ['DVOL <', 'op_dv', '<', [45, 50, 55]], ['SKEW >', 'op_skew', '>', [140, 145, 150]]];
for (const [nm, ind, op, xs] of B) for (const age of [0, 365]) for (const x of xs) O.run(`${nm} ${x} → ×1,5${age ? ' age>365' : ''}`, mod([c(ind, op, x), ...(age ? [c('age', '>', age)] : [])], (a) => O.sellAct(a, 1.5)));
