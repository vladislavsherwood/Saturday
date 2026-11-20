/* h3, круг 2: продажи на вершинах альтов раньше BTC — правило последним (только в дни без сигналов combo4). Основа — combo4 + фитили (или c4).
   A относительная вершина (пара монета/BTC у 90-дн. максимума после роста ×u за 180 дн, BTC не у ATH); B остаток с поправкой на бету;
   C памп без участия BTC; D разворот пары монета/BTC после роста; E памп без альтов (доля альтов падает); F относительная сила rel90. */
const H = require('./h3_lib.js'), { L, c } = H; H.inds();
const KEY = process.argv[2] === 'c4' ? 'c4' : 'wick', POS = process.argv[3] || 'end';
const pol = H.base(KEY);
const SIG = {
  'A rlo180>2 rdd90<3 btcath>15': [c('rlo180', '>', 2), c('rdd90', '<', 3), c('btcath', '>', 15)],
  'A rlo180>3 rdd90<3 btcath>15': [c('rlo180', '>', 3), c('rdd90', '<', 3), c('btcath', '>', 15)],
  'B res90>1 btcath>15': [c('res90', '>', 1), c('btcath', '>', 15)],
  'B res90>1.5 btcath>15': [c('res90', '>', 1.5), c('btcath', '>', 15)],
  'C up90>150 btcr90<10': [c('up90', '>', 150), c('btcr90', '<', 10)],
  'C up90>200 btcr90<20': [c('up90', '>', 200), c('btcr90', '<', 20)],
  'D rlo180>2 rdd90>20 btcath>15': [c('rlo180', '>', 2), c('rdd90', '>', 20), c('rdd90', '<', 50), c('btcath', '>', 15)],
  'D rlo180>3 rdd90>25 btcath>15': [c('rlo180', '>', 3), c('rdd90', '>', 25), c('rdd90', '<', 50), c('btcath', '>', 15)],
  'E up90>150 oth90<0': [c('up90', '>', 150), c('oth90', '<', 0)],
  'F rel90>100 btcath>15': [c('rel90', '>', 100), c('btcath', '>', 15)],
  'F rel90>200 btcath>15': [c('rel90', '>', 200), c('btcath', '>', 15)],
};
const out = [];
for (const [nm, conds] of Object.entries(SIG)) for (const s of [0.03, 0.1, 0.25]) {
  const rule = { act: -s, conds }, S = H.ins(H.S57, rule, POS);
  const r = L.run(`${nm} → −${s * 100}% (${POS})`, S, pol, { n100: true });
  out.push({ nm, s, d: r.dseg, ok: !r.w, n: r.n100 });
}
require('fs').writeFileSync(`/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/h3/r2_${KEY}_${POS}.json`, JSON.stringify(out));
