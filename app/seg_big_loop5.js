/* Круг 5. Тихие ×1,5 и страх ×1,25: общее ли это свойство всех монет, сочетание, признак поведения вместо списка */
const Z = require('./seg_big_sim.js'); const { K } = Z; const c = K.c;
const G = Z.load(); Z.addBig(G); const S = Z.BASE_S;
const rb = K.ev(G, S, false), bb = Z.bigStats(G, S);
const big = [c('isbig', '>', 0.5)];
const FEAR = [14, 15, 16, 17], QT = [21, 22, 23, 24];
// вставка копий: сначала страх, потом тихие (индексы основы сохраняются: scale по исходным индексам применяется к S, затем к результату — поэтому собираем вручную)
function both(kq, kf, cond) {
  return { ...S, rules: S.rules.flatMap((r, q) => { const k = QT.includes(q) ? kq : FEAR.includes(q) ? kf : 1; return k === 1 ? [r] : [{ act: Math.max(-1, r.act * k), conds: [...r.conds, ...cond] }, r]; }) };
}
const V = [];
V.push(['ВСЕ монеты: тихие ×1,5', both(1.5, 1, [])]);
V.push(['ВСЕ монеты: страх ×1,25', both(1, 1.25, [])]);
V.push(['ВСЕ монеты: тихие ×1,5 + страх ×1,25', both(1.5, 1.25, [])]);
for (const [kq, kf] of [[1.5, 1.25], [1.25, 1.25], [2, 1.25], [1.5, 1.5], [1.5, 1]]) V.push([`крупные (список): тихие ×${kq} + страх ×${kf}`, both(kq, kf, big)]);
const B = { 'corr>0,7 и vol<90': [c('corr180', '>', 0.7), c('vol180', '<', 90)], 'corr>0,7 и vol<80': [c('corr180', '>', 0.7), c('vol180', '<', 80)], 'corr>0,75 и vol<100': [c('corr180', '>', 0.75), c('vol180', '<', 100)],
  'corr>0,65 и vol<90': [c('corr180', '>', 0.65), c('vol180', '<', 90)], 'vol<80': [c('vol180', '<', 80)], 'corr>0,75': [c('corr180', '>', 0.75)] };
for (const nm in B) { V.push([`поведение ${nm}: тихие ×1,5 + страх ×1,25`, both(1.5, 1.25, B[nm])]); V.push([`поведение ${nm}: тихие ×1,5`, both(1.5, 1, B[nm])]); }
for (const [t, s] of V) { const o = Z.cmp(G, s, rb, bb, t); const bw = (g) => K.bw(o.r, rb, g).join('/');
  console.log(o.txt + ` | лучше/хуже: отбор ${bw('sel')}, экз ${bw('ex')}, 50сл ${bw('rnd')}`); console.log('   по монетам full: ' + Z.BIG.map((nm) => `${nm} ${(o.bs[nm].full - bb[nm].full).toFixed(0)}`).join(' ')); }
