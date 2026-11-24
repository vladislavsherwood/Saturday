/* op, круг 3 — паника/капитуляция на опционах → покупать крупнее (и не повторять st B).
   (а) перед каждым правилом покупки 1–9 (в combo7 — и перед копиями К1) — копия с условием опционной паники и долей резерва × m (act = 1 + (act − 1) × m);
       сигналы: put/call акций 10 д > X, VIX9D/VIX3M > X, VIX3M/VIX6M > X, DVOL за 7 дн × X, DVOL / реализ. < X, VVIX > X, SKEW − ср.250 > X; для сравнения st B (VIX/SMA50 > 1,5).
   (б) то же поверх st B (B + сигнал) — прибавка сверх B.
   (в) новое правило «put/call > X → взнос + f резерва» в конце (только дни без сигнала) и после покупок с BTC < 200д.
   Запуск: node op_r3.js [c6|c7] (лог scratchpad/op/r3_<основа>.txt) */
const O = require('./op_lib.js'), { c } = O;
const BK = process.argv[2] || 'c6'; O.tee('r3_' + BK);
const S0 = O.base(BK);
const pickB = (r) => ['buy', 'k1'].includes(O.famOf(r));
const boost = (conds, m, S = S0) => O.preMod(pickB, (r) => ({ act: O.buyAct(r.act, m), conds: [...r.conds, ...conds] }), S);
console.log(`основа ${BK}: ${S0.rules.length} правил`);
const SIG = {
  'st B: VIX/SMA50 >': ['op_vixr', [1.3, 1.5, 1.7]],
  'put/call акций 10д >': ['op_pce10', [0.7, 0.75, 0.8]],
  'VIX9D/VIX3M >': ['op_ts', [1.0, 1.1, 1.2]],
  'VIX3M/VIX6M >': ['op_ts6', [0.98, 1.0, 1.02]],
  'DVOL за 7 дн ×': ['op_dvr7', [1.2, 1.25, 1.3]],
  'DVOL / реализ. <': ['op_dvrv', [0.85, 0.9, 1.0]],
  'VVIX >': ['op_vvix', [110, 120, 130]],
  'SKEW − ср.250 >': ['op_skewz', [5, 10, 15]],
};
const R = {};
console.log('(а) покупки 1–9 × m при сигнале');
for (const [nm, [ind, xs]] of Object.entries(SIG)) for (const m of [1.5, 2]) for (const x of xs) {
  const op = nm.trim().endsWith('<') ? '<' : '>';
  R[`${nm}${x} ×${m}`] = O.run(`${nm} ${x} ×${m}`, boost([c(ind, op, x)], m));
}
console.log('\n(б) поверх st B (VIX/SMA50 > 1,5 ×2): прибавка сверх B');
const SBm = boost([c('op_vixr', '>', 1.5)], 2);
O.run('B', SBm);
for (const [nm, ind, op, x] of [['put/call 10д > 0,75', 'op_pce10', '>', 0.75], ['put/call 10д > 0,7', 'op_pce10', '>', 0.7], ['VIX9D/VIX3M > 1,1', 'op_ts', '>', 1.1], ['VIX3M/VIX6M > 1', 'op_ts6', '>', 1],
  ['DVOL 7д ×1,25', 'op_dvr7', '>', 1.25], ['DVOL/реализ. < 0,9', 'op_dvrv', '<', 0.9]]) for (const m of [1.5, 2]) {
  // копии сигнала ставятся перед копиями B (сигнал проверяется первым, затем B, затем исходное правило)
  const Q = O.preMod((r) => pickB(r) && !r.conds.some((cd) => cd.ind === 'op_vixr'), (r) => ({ act: O.buyAct(r.act, m), conds: [...r.conds, c(ind, op, x)] }), SBm);
  // в SBm копии B стоят перед исходными; preMod выше добавил копию сигнала перед каждым исходным правилом (после копии B) — переставим: сигнал раньше B
  const rules = []; for (let k = 0; k < Q.rules.length; k++) { const r = Q.rules[k]; if (r.conds.some((cd) => cd.ind === 'op_vixr') && Q.rules[k + 1] && Q.rules[k + 1].conds.some((cd) => cd.ind === ind)) { rules.push(Q.rules[k + 1], r); k++; } else rules.push(r); }
  Q.rules = rules;
  O.run(`B + ${nm} ×${m}`, Q);
}
console.log('\n(в) новое правило «put/call / инверсия → взнос + f резерва»');
const lastBuy = S0.rules.reduce((a, r, k) => (pickB(r) ? k : a), -1) + 1;
for (const [nm, cd] of [['put/call 10д > 0,75', c('op_pce10', '>', 0.75)], ['put/call 10д > 0,8', c('op_pce10', '>', 0.8)], ['VIX9D/VIX3M > 1,1', c('op_ts', '>', 1.1)], ['DVOL 7д ×1,25', c('op_dvr7', '>', 1.25)]])
  for (const f of [0.1, 0.2]) {
    O.run(`${nm} → +${f} в конце`, O.ins([{ act: 1 + f, conds: [cd] }], 'end'));
    O.run(`${nm} → +${f} после покупок, BTC<200д`, O.ins([{ act: 1 + f, conds: [cd, c('btc200', '<', 1)] }], lastBuy));
  }
