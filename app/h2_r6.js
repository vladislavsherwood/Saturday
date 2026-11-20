/* h2, круг 6 (идея 7): «удержание после капитуляции» — после дня крайнего страха (страх < 10: правило 1 combo4 покупает +25%) в глубоком медвежьем рынке
   не продавать на страхе N дней (правило «взнос»/«копить» перед продажами на страхе). В 2018 combo4 купила капитуляцию 25.11.2018 и через несколько дней продала её
   на страхе обратно (кэш снова 98–100% к дну 15.12); в 2022 — то же после 18.06.2022.
   Сетка: зона (нет / BTC ниже ATH > 50/60/70 / MVRV < 1,1 / < 1) × N (14/30/60/90/120) × действие. Запуск: node h2_r6.js [wick|plain] [часть] */
const H = require('./h2_lib.js'), { L, c } = H, C = require('./h2_coin.js');
const kind = process.argv[2] || 'wick', part = process.argv[3] || 'grid', pol = H.base(kind);
console.log(`ОСНОВА: combo4 (57)${kind === 'wick' ? ' + фитили' : ''}`);
const ext = (r) => { const m = H.m81(r); return `${r.s.slice(0, 150)} | 81 ${L.sg(m.m)} ${m.u}/${m.d}${r.w ? ' | ' + r.w.slice(0, 120) : ''}`; };
const go = (nm, conds, act) => console.log(ext(H.run(nm, H.ins([{ act, conds: [...conds, c('btcr30', '<', 20)] }], 10), pol, { n100: true, quiet: true })));
const zones = { 'везде': [], 'ath>50': [c('btcath', '>', 50)], 'ath>60': [c('btcath', '>', 60)], 'ath>70': [c('btcath', '>', 70)], 'mvrv<1,1': [c('mvrv', '<', 1.1)], 'mvrv<1': [c('mvrv', '<', 1)] };
if (part === 'grid') for (const [zn, zc] of Object.entries(zones)) for (const N of [14, 30, 60, 90, 120]) for (const [an, a] of [['взнос', 1], ['+2%', 1.02]]) go(`страх<10 ≤${N} дн, ${zn} → ${an}`, [c('h2fd', '<', N), ...zc], a);
if (part === 'q') for (const [k, q] of [['h2fd15', 15], ['h2fd20', 20]]) for (const [zn, zc] of Object.entries(zones)) for (const N of [30, 60, 90]) go(`страх<${q} ≤${N} дн, ${zn} → взнос`, [c(k, '<', N), ...zc], 1);
