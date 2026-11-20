/* h2, круг 10: «удержание после капитуляции» с выходом по цене — не продавать на страхе, пока (а) страх < q был не позже N дней назад, (б) рынок в зоне дна
   (BTC ниже ATH > X или MVRV < m), (в) монета выросла меньше чем на u от своего закрытия в последний день страха < q (выше — продажи на страхе фиксируют отскок).
   Карта плато → JSON. Запуск: node h2_r10.js [wick|plain] */
const fs = require('fs');
const H = require('./h2_lib.js'), { L, c } = H;
const kind = process.argv[2] || 'wick', pol = H.base(kind);
console.log(`ОСНОВА: combo4 (57)${kind === 'wick' ? ' + фитили' : ''}`);
const FD = { 10: ['h2fd', 'h2capr'], 15: ['h2fd15', 'h2capr15'], 20: ['h2fd20', 'h2capr20'] };
const zones = { 'ath>55': [c('btcath', '>', 55)], 'ath>60': [c('btcath', '>', 60)], 'ath>62': [c('btcath', '>', 62)], 'ath>65': [c('btcath', '>', 65)], 'ath>68': [c('btcath', '>', 68)], 'ath>70': [c('btcath', '>', 70)], 'mvrv<1': [c('mvrv', '<', 1)], 'mvrv<1,1': [c('mvrv', '<', 1.1)], 'mvrv<1,2': [c('mvrv', '<', 1.2)] };
const rows = [];
for (const [zn, zc] of Object.entries(zones)) for (const q of [10, 15, 20]) for (const N of [60, 120, 180, 365]) for (const u of [0.1, 0.2, 0.3, 9]) {
  const nm = `страх<${q} ≤${N}, ${zn}, ${u < 9 ? 'цена<+' + u * 100 + '%' : 'без выхода'}`;
  const r = H.run(nm, H.ins([{ act: 1, conds: [c(FD[q][0], '<', N), ...zc, ...(u < 9 ? [c(FD[q][1], '<', 1 + u)] : []), c('btcr30', '<', 20)] }], 10), pol, { n100: true, quiet: true }), m = H.m81(r);
  rows.push({ nm, zone: zn, q, N, u, d: r.dseg, ok: !r.w, w: r.w, n100: r.n100, m81: m });
  console.log(`${r.s.slice(0, 150)} | 81 ${L.sg(m.m)} ${m.u}/${m.d}${r.w ? ' | ' + r.w.slice(0, 80) : ''}`);
}
fs.writeFileSync(process.env.H2OUT || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/h2/r10_' + kind + '.json', JSON.stringify(rows));
