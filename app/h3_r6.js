/* h3, круг 6: «стоп после собственного пампа» — монета выросла ×P за 90 дн (pump90 = макс90 / мин90) и уже ушла от 90-дн. максимума на D% (ddm90),
   BTC не у ATH (btcath > 15) или любой → продать s (последним). Идея: у пропущенных вершин падение своё (рынок спокоен, страха нет), продажи на страхе не включаются. */
const H = require('./h3_lib.js'), { L, c } = H; H.inds();
const KEY = process.argv[2] === 'c4' ? 'c4' : 'wick';
const pol = H.base(KEY);
for (const p of [3, 5]) for (const d of [25, 40]) for (const b of [15, -1]) for (const s of [0.1, 0.25]) {
  const conds = [c('pump90', '>', p), c('ddm90', '>', d), c('ddm90', '<', 70), ...(b > 0 ? [c('btcath', '>', b)] : [])];
  L.run(`6 pump90>${p} ddm90>${d}${b > 0 ? ' btcath>' + b : ''} → −${s * 100}%`, H.ins(H.S57, { act: -s, conds }, 'end'), pol, { n100: true });
}
