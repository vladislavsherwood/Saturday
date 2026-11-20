/* h3, круг 3: рыночные признаки вершин вне ATH BTC (правило последним). Основа — combo4 + фитили (или c4).
   3а альтсезон без ATH BTC: oth90 > X и 15 < btcath < Y; 3б широта: breadth > X и btcath > 15; 3в жадность в медвежьем рынке: fng > G и btcath > B;
   3г «памп без BTC» (круг 2, C) с фильтрами: возраст монеты, без мемов / только альты. */
const H = require('./h3_lib.js'), { L, c } = H; H.inds();
const KEY = process.argv[2] === 'c4' ? 'c4' : 'wick';
const pol = H.base(KEY);
const SIG = {
  '3а oth90>2 btcath 15..40': [c('oth90', '>', 2), c('btcath', '>', 15), c('btcath', '<', 40)],
  '3а oth90>3 btcath 15..40': [c('oth90', '>', 3), c('btcath', '>', 15), c('btcath', '<', 40)],
  '3а oth90>3 btcath 15..60': [c('oth90', '>', 3), c('btcath', '>', 15), c('btcath', '<', 60)],
  '3б breadth>90 btcath>15': [c('breadth', '>', 90), c('btcath', '>', 15)],
  '3б breadth>80 btcath>15': [c('breadth', '>', 80), c('btcath', '>', 15)],
  '3в fng>80 btcath>20': [c('fng', '>', 80), c('btcath', '>', 20)],
  '3в fng>90 btcath>20': [c('fng', '>', 90), c('btcath', '>', 20)],
  '3в fng>75 btcath>30': [c('fng', '>', 75), c('btcath', '>', 30)],
  '3г C + age>365': [c('up90', '>', 200), c('btcr90', '<', 20), c('age', '>', 365)],
  '3г C + не мем': [c('up90', '>', 200), c('btcr90', '<', 20), c('meme', '<', 0.5)],
  '3г C + мем': [c('up90', '>', 200), c('btcr90', '<', 20), c('meme', '>', 0.5)],
  '3г C + age>365, up90>300': [c('up90', '>', 300), c('btcr90', '<', 20), c('age', '>', 365)],
};
for (const [nm, conds] of Object.entries(SIG)) for (const s of [0.05, 0.1, 0.25]) {
  const S = H.ins(H.S57, { act: -s, conds }, 'end');
  L.run(`${nm} → −${s * 100}%`, S, pol, { n100: true });
}
