/* Круг 2. Тихие вершины у крупных: широкая продаёт рано (цена через 60 дн выше у 9/9) — меньше продавать или больше возвращать? */
const Z = require('./seg_big_sim.js'); const { K } = Z; const c = K.c;
const G = Z.load(); Z.addBig(G); const S = Z.BASE_S;
const rb = K.ev(G, S, false), bb = Z.bigStats(G, S);
const big = [c('isbig', '>', 0.5)];
const WIDE = [23, 24], NARROW = [21, 22], RET = [25];
const V = [];
for (const k of [0, 0.25, 0.5, 0.75]) V.push([`широкая тихая ×${k}`, Z.scale(S, WIDE, k, big)]);
for (const k of [0.5, 0.75]) V.push([`узкая тихая ×${k}`, Z.scale(S, NARROW, k, big)]);
for (const k of [0.5]) V.push([`обе тихие ×${k}`, Z.scale(S, [...WIDE, ...NARROW], k, big)]);
for (const k of [2, 3, 5]) V.push([`возврат ×${k}`, Z.scale(S, RET, k, big)]);
// возврат с более длинным окном и без условия жадности для крупных
for (const D of [90, 180]) for (const r of [0.1, 0.25]) V.push([`доп. возврат ${r} резерва ≤${D} дн после тихой, новый 90-дн макс`, Z.ins(S, 25, [{ act: 1 + r, conds: [...big, c('ago_qt', '<', D + 0.5), c('ago_qt', '>', 0.5), c('fng', '>', 52), c('hi90', '>', 0.5)] }])]);
V.push(['широкая ×0,5 + возврат ×2', Z.scale(Z.scale(S, RET, 2, big), WIDE, 0.5, big)]);
for (const [t, s] of V) { const o = Z.cmp(G, s, rb, bb, t); console.log(o.txt); console.log('   по монетам full: ' + Z.BIG.map((nm) => `${nm} ${(o.bs[nm].full - bb[nm].full).toFixed(0)}`).join(' ') + (o.s.wy.length ? ' | хуже годы: ' + o.s.wy.slice(0, 10).join(', ') : '')); }
