/* h3, круг 1: защита разворота BTC (правило 27: btcr30 > 20 → весь резерв). Основа — combo4 + фитили.
   1а поэтапно: act 2 → 1 + f (каждый день сигнала — доля f остатка резерва);
   1б не на перегреве монеты: перед правилом 27 «btcr30 > 20 и r30 / up90 / rel30 > X → 1 + g» (g = 0 — только взнос);
   1в не у ATH BTC: «btcr30 > 20 и btcath < X → 1 + g»;  1г не при горячем фандинге: «btcr30 > 20 и fund30 > X → 1 + g». */
const H = require('./h3_lib.js'), { L, c } = H;
const KEY = process.argv[2] === 'c4' ? 'c4' : 'wick';
const pol = H.base(KEY);
const out = [];
const R = (nm, S) => { const r = L.run(nm, S, pol, { n100: true }); out.push({ nm, d: r.dseg, ok: !r.w, n: r.n100 }); };
for (const f of [0.25, 0.5, 0.75]) { const S = H.cl(); S.rules[26].act = 1 + f; R(`1а R27 поэтапно ${f * 100}%/день`, S); }
for (const [ind, xs] of [['r30', [30, 40, 60]], ['up90', [100, 200]], ['rel30', [20, 40]]]) for (const x of xs) for (const g of [0, 0.5]) R(`1б R27, ${ind} > ${x} → ${g ? g * 100 + '%' : 'взнос'}`, H.ins(H.S57, { act: 1 + g, conds: [c('btcr30', '>', 20), c(ind, '>', x)] }, 'pre27'));
for (const x of [5, 10, 15]) for (const g of [0, 0.5]) R(`1в R27, btcath < ${x} → ${g ? g * 100 + '%' : 'взнос'}`, H.ins(H.S57, { act: 1 + g, conds: [c('btcr30', '>', 20), c('btcath', '<', x)] }, 'pre27'));
for (const x of [1, 2, 3]) for (const g of [0, 0.5]) R(`1г R27, fund30 > ${x} → ${g ? g * 100 + '%' : 'взнос'}`, H.ins(H.S57, { act: 1 + g, conds: [c('btcr30', '>', 20), c('fund30', '>', x)] }, 'pre27'));
require('fs').writeFileSync(`/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/h3/r1_${KEY}.json`, JSON.stringify(out));
