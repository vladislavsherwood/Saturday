/* h2, круг 7: доводка «удержания после капитуляции» — срок N, зона, повод (страх < 10 / правила 1–3 combo4: страх < 10, отложенная после выноса, волна ликвидаций),
   фильтр возраста монеты (age > 365: молодые монеты падают сами по себе), действие (взнос / копить). Правило «не продавать» перед продажами на страхе.
   Запуск: node h2_r7.js [wick|plain] [часть] */
const H = require('./h2_lib.js'), { L, c } = H;
const kind = process.argv[2] || 'wick', part = process.argv[3] || 'grid', pol = H.base(kind);
console.log(`ОСНОВА: combo4 (57)${kind === 'wick' ? ' + фитили' : ''}`);
const ext = (r) => { const m = H.m81(r); return `${r.s.slice(0, 150)} | 81 ${L.sg(m.m)} ${m.u}/${m.d}${r.w ? ' | ' + r.w.slice(0, 120) : ''}`; };
const go = (nm, conds, act) => { const r = H.run(nm, H.ins([{ act, conds: [...conds, c('btcr30', '<', 20)] }], 10), pol, { n100: true, quiet: true }); console.log(ext(r)); return r; };
const zones = { 'mvrv<1': [c('mvrv', '<', 1)], 'mvrv<1,1': [c('mvrv', '<', 1.1)], 'ath>65': [c('btcath', '>', 65)], 'ath>70': [c('btcath', '>', 70)] };
if (part === 'grid') for (const [zn, zc] of Object.entries(zones)) for (const [ag, ac] of [['', []], [', age>365', [c('age', '>', 365)]]]) for (const N of [30, 60, 90, 120, 150, 180]) go(`страх<10 ≤${N} дн, ${zn}${ag} → взнос`, [c('h2fd', '<', N), ...zc, ...ac], 1);
if (part === 'cap') for (const [tn, tk] of [['правила1–3', 'h2cap'], ['ликв', 'h2liq'], ['страх<15', 'h2fd15'], ['страх<20', 'h2fd20']]) for (const [zn, zc] of Object.entries(zones)) for (const N of [30, 60, 120]) go(`${tn} ≤${N} дн, ${zn}, age>365 → взнос`, [c(tk, '<', N), ...zc, c('age', '>', 365)], 1);
if (part === 'act') for (const [zn, zc] of Object.entries(zones)) for (const N of [60, 120]) for (const [an, a] of [['копить', 1e-6], ['+2%', 1.02], ['+5%', 1.05]]) go(`страх<10 ≤${N} дн, ${zn}, age>365 → ${an}`, [c('h2fd', '<', N), ...zc, c('age', '>', 365)], a);
// выход из удержания по цене: держать, пока монета не выросла на u от закрытия дня капитуляции (дальше продажи на страхе снова работают — фиксация отскока)
if (part === 'exit') for (const [zn, zc] of Object.entries(zones)) for (const N of [60, 120, 180, 365]) for (const u of [0.1, 0.2, 0.3, 0.5]) go(`страх<10 ≤${N} дн, ${zn}, цена<+${u * 100}% → взнос`, [c('h2fd', '<', N), ...zc, c('h2capr', '<', 1 + u)], 1);
