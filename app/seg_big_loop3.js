/* Круг 3. Раньше возвращаться в рынок у крупных: мягче порог разворота BTC или разворот самой монеты (вставка перед правилом 18 «разворот → весь резерв») */
const Z = require('./seg_big_sim.js'); const { K } = Z; const c = K.c;
const G = Z.load(); Z.addBig(G); const S = Z.BASE_S;
const rb = K.ev(G, S, false), bb = Z.bigStats(G, S);
const big = [c('isbig', '>', 0.5)];
const V = [];
for (const a of [1.25, 1.5, 2]) {
  for (const x of [10, 15]) V.push([`BTC +${x}% за 30 дн → ${a}`, Z.ins(S, 18, [{ act: a, conds: [...big, c('btcr30', '>', x)] }])]);
  for (const x of [15, 20, 30]) V.push([`монета +${x}% за 30 дн → ${a}`, Z.ins(S, 18, [{ act: a, conds: [...big, c('r30', '>', x)] }])]);
  V.push([`монета выше sma200 и +10% за 30 дн → ${a}`, Z.ins(S, 18, [{ act: a, conds: [...big, c('sma200', '>', 1), c('r30', '>', 10)] }])]);
  V.push([`монета на новом 90-дн макс. → ${a}`, Z.ins(S, 18, [{ act: a, conds: [...big, c('hi90', '>', 0.5)] }])]);
}
for (const [t, s] of V) { const o = Z.cmp(G, s, rb, bb, t); console.log(o.txt); console.log('   по монетам full: ' + Z.BIG.map((nm) => `${nm} ${(o.bs[nm].full - bb[nm].full).toFixed(0)}`).join(' ') + (o.s.wy.length ? ' | хуже годы: ' + o.s.wy.slice(0, 10).join(', ') : '')); }
