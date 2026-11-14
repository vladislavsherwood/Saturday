/* Круг 1. Продажи на мягком страхе (fng 40–52) у крупных монет в восходящем тренде — меньше? */
const Z = require('./seg_big_sim.js'); const { K } = Z; const c = K.c;
const G = Z.load(); Z.addBig(G); const S = Z.BASE_S;
const rb = K.ev(G, S, false), bb = Z.bigStats(G, S);
const big = [c('isbig', '>', 0.5)];
const MILD = [16, 17], ALLF = [14, 15, 16, 17];
const V = [];
for (const k of [0, 0.5])
  for (const [tn, tc] of [['всегда', []], ['монета>sma200', [c('sma200', '>', 1)]], ['BTC>sma200', [c('bsma200', '>', 1)]], ['BTC<20% от макс.', [c('btcath', '<', 20)]], ['монета>sma200 и BTC<30%', [c('sma200', '>', 1), c('btcath', '<', 30)]]]) {
    V.push([`крупные: мягкий страх ×${k}, ${tn}`, Z.scale(S, MILD, k, [...big, ...tc])]);
    V.push([`крупные: весь страх ×${k}, ${tn}`, Z.scale(S, ALLF, k, [...big, ...tc])]);
  }
// контроль: то же на всех монетах
V.push(['ВСЕ монеты: мягкий страх ×0,5, монета>sma200', Z.scale(S, MILD, 0.5, [c('sma200', '>', 1)])]);
V.push(['ВСЕ монеты: мягкий страх ×0, монета>sma200 и BTC<30%', Z.scale(S, MILD, 0, [c('sma200', '>', 1), c('btcath', '<', 30)])]);
for (const [t, s] of V) { const o = Z.cmp(G, s, rb, bb, t); console.log(o.txt); console.log('   по монетам full: ' + Z.BIG.map((nm) => `${nm} ${(o.bs[nm].full - bb[nm].full).toFixed(0)}`).join(' ') + (o.s.wy.length ? ' | хуже годы: ' + o.s.wy.slice(0, 8).join(', ') : '')); }
