/* h2, круг 8: карта плато «удержания после капитуляции» — повод (страх < q), срок N, зона (BTC ниже ATH > X / MVRV < m), фильтр возраста ряда монеты, выход по цене.
   Пишет JSON со всеми вариантами (для сводки плато). Запуск: node h2_r8.js [wick|plain] > лог */
const fs = require('fs');
const H = require('./h2_lib.js'), { L, c } = H;
const kind = process.argv[2] || 'wick', pol = H.base(kind);
console.log(`ОСНОВА: combo4 (57)${kind === 'wick' ? ' + фитили' : ''}`);
const FD = { 10: 'h2fd', 15: 'h2fd15', 20: 'h2fd20' };
const zones = { 'ath>60': [c('btcath', '>', 60)], 'ath>65': [c('btcath', '>', 65)], 'mvrv<1': [c('mvrv', '<', 1)], 'mvrv<1,1': [c('mvrv', '<', 1.1)] };
const ages = { '': [], 'age>180': [c('age', '>', 180)], 'age>365': [c('age', '>', 365)] };
const exits = { '': [], 'цена<+20%': [c('h2capr', '<', 1.2)] };
const rows = [];
for (const q of [10, 15, 20]) for (const N of [30, 60, 90, 120]) for (const [zn, zc] of Object.entries(zones)) for (const [an, ac] of Object.entries(ages)) for (const [en, ec] of Object.entries(exits)) {
  if (en && q !== 10) continue; // выход по цене привязан к дню страха < 10
  const nm = `страх<${q} ≤${N}, ${zn}${an ? ', ' + an : ''}${en ? ', ' + en : ''}`;
  const r = H.run(nm, H.ins([{ act: 1, conds: [c(FD[q], '<', N), ...zc, ...ac, ...ec, c('btcr30', '<', 20)] }], 10), pol, { n100: true, quiet: true }), m = H.m81(r);
  const o = { nm, q, N, zone: zn, age: an, exit: en, d: r.dseg, ok: !r.w, w: r.w, n100: r.n100, m81: m };
  rows.push(o); console.log(`${r.s.slice(0, 150)} | 81 ${L.sg(m.m)} ${m.u}/${m.d}${r.w ? ' | ' + r.w.slice(0, 80) : ''}`);
}
fs.writeFileSync(process.env.H2OUT || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/h2/r8.json', JSON.stringify(rows));
