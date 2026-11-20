/* h2, круг 3 (идея 1): «зона дна без продаж + поэтапная покупка» — рыночная зона (MVRV < 1 / BTC < 200-нед. / BTC ниже ATH > 70) → +f резерва в день,
   продажи на страхе в зоне не срабатывают (правило стоит перед ними). Фильтры монеты: сегмент; «не отстаёт от BTC» (rel180 > r); глубина своего падения.
   Запуск: node h2_r3.js [wick|plain] [часть] */
const H = require('./h2_lib.js'), { L, c } = H, C = require('./h2_coin.js');
const kind = process.argv[2] || 'wick', part = process.argv[3] || 'all', pol = H.base(kind);
console.log(`ОСНОВА: combo4 (57)${kind === 'wick' ? ' + фитили' : ''}`);
const ext = (r) => { const m = H.m81(r); return `${r.s.slice(0, 150)} | 81 ${L.sg(m.m)} ${m.u}/${m.d}${r.w ? ' | ' + r.w.slice(0, 140) : ''}`; };
const go = (nm, rules) => console.log(ext(H.run(nm, H.ins(rules, 10), pol, { n100: true, quiet: true })));
const zones = { 'mvrv<1': [c('mvrv', '<', 1)], 'wma<1': [c('h2wma', '<', 1)], 'ath>70': [c('btcath', '>', 70)] };
const segs = { все: [], крупные: [c('isbig', '>', 0.5)], 'не альты': [c('isalt', '<', 0.5)], альты: [c('isalt', '>', 0.5)], мемы: [c('meme', '>', 0.5)],
  'rel180>-15': [c('rel180', '>', -15)], 'rel180>-30': [c('rel180', '>', -30)], 'rel180>0': [c('rel180', '>', 0)], 'rel90>-15': [c('rel90', '>', -15)] };
const Z = (zc, act, extra = []) => ({ act, conds: [...zc, ...extra, c('btcr30', '<', 20)] });
if (part === 'all' || part === 'a') for (const [zn, zc] of Object.entries(zones)) for (const [sn, sc] of Object.entries(segs)) for (const [an, act] of [['взнос', 1], ['+2%', 1.02], ['+5%', 1.05]]) go(`${zn} ${sn} → ${an}`, [Z(zc, act, sc)]);
if (part === 'all' || part === 'e') {
  const mk = (zc, act, sc) => (w) => [{ act, conds: [...zc, ...sc, c('btcr30', '<', 20), ...w] }];
  C.explain('mvrv<1, rel180>-15 → +2%', mk(zones['mvrv<1'], 1.02, segs['rel180>-15']), 10, pol);
  C.explain('mvrv<1, крупные → +2%', mk(zones['mvrv<1'], 1.02, segs['крупные']), 10, pol);
  C.explain('mvrv<1, не альты → +2%', mk(zones['mvrv<1'], 1.02, segs['не альты']), 10, pol);
}
