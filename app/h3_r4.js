/* h3, круг 4: (а) плато «памп без BTC» с возрастом монеты > 365 дн (лучший из кругов 2–3); (б) альтсезон без ATH BTC — без крупных;
   (в) жадность в медвежьем ралли перед правилом 27 (вершина 06.2019). Основа — combo4 + фитили (или c4). */
const H = require('./h3_lib.js'), { L, c } = H; H.inds();
const KEY = process.argv[2] === 'c4' ? 'c4' : 'wick', PART = process.argv[3] || 'abc';
const pol = H.base(KEY);
const out = [];
const R = (nm, S, extra = {}) => { const r = L.run(nm, S, pol, { n100: true }); out.push({ nm, d: r.dseg, ok: !r.w, n: r.n100, ...extra }); };
if (PART.includes('a')) for (const u of [150, 200, 250, 300]) for (const b of [10, 20, 30]) for (const s of [0.05, 0.1, 0.25])
  R(`4а up90>${u} btcr90<${b} age>365 → −${s * 100}%`, H.ins(H.S57, { act: -s, conds: [c('up90', '>', u), c('btcr90', '<', b), c('age', '>', 365)] }, 'end'), { u, b, s });
if (PART.includes('b')) for (const x of [2, 3]) for (const s of [0.05, 0.1, 0.25])
  R(`4б oth90>${x} btcath 15..40 не крупные → −${s * 100}%`, H.ins(H.S57, { act: -s, conds: [c('oth90', '>', x), c('btcath', '>', 15), c('btcath', '<', 40), c('isbig', '<', 0.5)] }, 'end'));
if (PART.includes('c')) for (const g of [85, 90]) for (const b of [20, 30]) for (const s of [0.1, 0.25])
  R(`4в fng>${g} btcath>${b} перед R27 → −${s * 100}%`, H.ins(H.S57, { act: -s, conds: [c('fng', '>', g), c('btcath', '>', b)] }, 'pre27'));
require('fs').writeFileSync(`/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/h3/r4_${KEY}_${PART}.json`, JSON.stringify(out));
