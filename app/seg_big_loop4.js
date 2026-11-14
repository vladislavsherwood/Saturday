/* Круг 4. Обратное направление: у крупных продажи и покупки КРУПНЕЕ (монета не умрёт — смелее докупать дно; продажи на страхе у крупных верны) */
const Z = require('./seg_big_sim.js'); const { K } = Z; const c = K.c;
const G = Z.load(); Z.addBig(G); const S = Z.BASE_S;
const rb = K.ev(G, S, false), bb = Z.bigStats(G, S);
const big = [c('isbig', '>', 0.5)];
const FEAR = [14, 15, 16, 17], QT = [21, 22, 23, 24], FUND = [19, 20], SELLS = [14, 15, 16, 17, 19, 20, 21, 22, 23, 24, 26, 27];
const PANIC = [0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 13];
const V = [];
for (const k of [1.25, 1.5, 2]) {
  V.push([`страх ×${k}`, Z.scale(S, FEAR, k, big)]);
  V.push([`тихие ×${k}`, Z.scale(S, QT, k, big)]);
  V.push([`фандинг ×${k}`, Z.scale(S, FUND, k, big)]);
  V.push([`все продажи ×${k}`, Z.scale(S, SELLS, k, big)]);
  V.push([`покупки дна/паники ×${k}`, Z.scale(S, PANIC, k, big)]);
}
for (const [t, s] of V) { const o = Z.cmp(G, s, rb, bb, t); console.log(o.txt); console.log('   по монетам full: ' + Z.BIG.map((nm) => `${nm} ${(o.bs[nm].full - bb[nm].full).toFixed(0)}`).join(' ') + (o.s.wy.length ? ' | хуже годы: ' + o.s.wy.slice(0, 10).join(', ') : '')); }
