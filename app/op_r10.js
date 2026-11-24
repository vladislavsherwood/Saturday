/* op, круг 10 — итоговый кандидат op-best = combo7-draft + К-V + К-D, сравнение с combo6 и combo7-draft, монеты пользователя, «что сейчас»,
   правила для маржи (scratchpad/op/margin_rules.json → python3 op_margin.py) и found/op-best.json.
   К-V: перед каждым правилом фандинга (29–31 combo6) — копия «VVIX > 120 → не продавать, копить (act 1e-6)».
   К-D: перед каждым правилом продажи вершины (40–59) и пампа (61–69) — копия «перцентиль DVOL BTC за 365 дн < 0,3 → продажа × 1,5».
   Запуск: node op_r10.js (лог scratchpad/op/r10.txt) */
const fs = require('fs');
const O = require('./op_lib.js'), { c } = O;
O.tee('r10');
const isF = (r) => O.famOf(r) === 'fund', isTP = (r) => ['top', 'pump'].includes(O.famOf(r)) && r.act < 0;
const num6 = (r) => O.IDX6.get(JSON.stringify({ a: r.act, c: r.conds })); // номер исходного правила combo6 (0-based)
function build(S) {
  let Q = O.preMod(isF, (r) => ({ act: 1e-6, conds: [...r.conds, c('op_vvix', '>', 120)], op: { family: 'К-V: VVIX > 120 → фандинг не продавать (копить)', before_rule_combo6: num6(r) + 1, act_was: r.act } }), S);
  Q = O.preMod(isTP, (r) => ({ act: O.sellAct(r.act, 1.5), conds: [...r.conds, c('op_dvp', '<', 0.3)], op: { family: 'К-D: перцентиль DVOL < 0,3 → продажа вершины/пампа ×1,5', before_rule_combo6: num6(r) + 1, act_was: r.act } }), Q);
  return Q;
}
const S6c = build(O.S6), S7c = build(O.S7);
const res = {};
O.base('c6');
console.log('к combo6:');
res.c6_c7 = O.run('combo7-draft', O.S7); res.c6_6c = O.run('combo6 + К-V + К-D', S6c); res.c6_op = O.run('op-best = combo7-draft + К-V + К-D', S7c);
const F6 = O.preMod(isF, (r) => ({ act: 1e-6, conds: [...r.conds, c('op_vix', '>', 30)] }), O.S7);
res.c6_c7F = O.run('combo7-draft + st F (VIX > 30)', F6);
O.base('c7');
console.log('к combo7-draft:');
res.c7_op = O.run('op-best', S7c); res.c7_F = O.run('combo7-draft + st F', F6);
res.c7_FD = O.run('combo7-draft + st F + К-D', O.preMod(isTP, (r) => ({ act: O.sellAct(r.act, 1.5), conds: [...r.conds, c('op_dvp', '<', 0.3)] }), F6));
const mineA = O.mine(S7c, O.polW, O.S6), mineB = O.mine(S7c, O.polW, O.S7);
console.log('\nмонеты пользователя, итог к DCA %, вся история: combo6 → op-best:\n  ' + O.mineTxt(mineA));
console.log('combo7-draft → op-best:\n  ' + O.mineTxt(mineB));
// с 2026-01-01 с нуля
const A = O.A, from = '2026-01-01';
const m26 = O.MINE.map((nm) => { const X = O.BY[nm]; if (!X || X.ind.t[X.n - 1] < O.T(from) + 30) return `${nm}: —`; const Y = A.cut(X, from); return `${nm} ${Math.round(A.E(Y, O.S6, O.polW))}/${Math.round(A.E(Y, O.S7, O.polW))}/${Math.round(A.E(Y, S7c, O.polW))}`; });
console.log(`с ${from} с нуля (combo6 / combo7-draft / op-best): ${m26.join(', ')}`);
// сейчас
const d = O.T('2026-11-23') - O.T0, v = (k) => O.M[k][d];
const now = { day: '2026-11-23', VIX: +v('op_vix').toFixed(2), 'VIX/SMA50': +v('op_vixr').toFixed(2), 'VIX9D/VIX3M': +v('op_ts').toFixed(3), 'VIX3M/VIX6M': +v('op_ts6').toFixed(3), VVIX: +v('op_vvix').toFixed(1), SKEW: +v('op_skew').toFixed(1),
  'SKEW-ср250': +v('op_skewz').toFixed(1), GVZ: +v('op_gvz').toFixed(1), OVX: +v('op_ovx').toFixed(1), MOVE: +v('op_move').toFixed(1), 'VIX/реализ.S&P': +v('op_vrp').toFixed(2), 'put/call акций 10д': +v('op_pce10').toFixed(3), 'put/call z': +v('op_pcez').toFixed(2),
  'put/call total': +v('op_pct').toFixed(2), DVOL_BTC: +v('op_dv').toFixed(1), DVOL_ETH: +v('op_dve').toFixed(1), 'DVOL/SMA50': +v('op_dvr').toFixed(2), 'DVOL перцентиль 365': +v('op_dvp').toFixed(3), 'DVOL/реализ.': +v('op_dvrv').toFixed(2), 'реализ. вол BTC 30д': +v('op_rv30').toFixed(1), 'DVOL за 7 дн': +v('op_dvr7').toFixed(2) };
console.log('\nсейчас:', JSON.stringify(now));
const tail = (k, n = 10) => Array.from({ length: n }, (_, q) => (+O.M[k][d - n + 1 + q]).toFixed(k === 'op_dvp' ? 2 : 1)).join(' ');
console.log('последние 10 дней VVIX:', tail('op_vvix'), '| DVOL:', tail('op_dv'), '| перц. DVOL:', tail('op_dvp'), '| VIX:', tail('op_vix'));
const strip = (S) => S.rules.map(({ act, conds }) => ({ act, conds }));
fs.writeFileSync(O.LOG + 'margin_rules.json', JSON.stringify({ combo6: strip(O.S6), 'combo7-draft': strip(O.S7), 'op-best': strip(S7c), 'combo6+КV+КD': strip(S6c) }));
const pack = (r) => ({ medians: O.G3.map((g) => Math.round(r.RS[g].all.med)).join('/'), income: +r.dseg.all.toFixed(3), big: +r.dseg.big.toFixed(3), alt: +r.dseg.alt.toFixed(3), meme: +r.dseg.meme.toFixed(3), strict: r.w ? '✗ ' + r.w : '✔', new100: r.n100 ? `${r.n100.m >= 0 ? '+' : ''}${r.n100.m.toFixed(3)} (${r.n100.u} лучше / ${r.n100.d} хуже)` : '', halves: `${r.hv.h1.toFixed(3)} / ${r.hv.h2.toFixed(3)}`, m81: `${r.m81.m.toFixed(4)} ${r.m81.u}/${r.m81.d}` });
module.exports = { S7c, S6c, res, pack, now, mineA, mineB, m26 };
fs.writeFileSync(O.LOG + 'r10.json', JSON.stringify({ res: Object.fromEntries(Object.entries(res).map(([k, r]) => [k, pack(r)])), now, mineA, mineB, m26, insert: S7c.rules.map((r, i) => (r.op ? { index0: i, ...r.op, act: r.act, conds: r.conds } : null)).filter(Boolean), rules: strip(S7c) }));
