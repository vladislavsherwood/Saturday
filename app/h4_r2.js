/* h4, круг 2: паника в затяжном падении альтов (2019 H2, 2025) — бюджет эпизода и ворота по слабости монеты/альтов.
   (а) бюджет: траты паники в эпизоде ≤ B × (резерв на старте + взносы эпизода);
   (б) ворота «отложить и не тратить» (долг ждёт открытия ворот, в конце эпизода сгорает): rel180 < R, oth90 < O, sma200 < M, dd365 > D;
   (в) мягче: на развороте выдача долга × 1 вместо × 2 у слабых; (г) урезать долю правил паники копией (rel180 < R → доля × 0,5).
   Основа: combo4 + фитили. Запуск: node h4_r2.js [a|b|c|d] */
const H = require('./h4_lib.js'), { L, S57, polW, c } = H;
H.setBase(S57, polW);
const part = process.argv[2] || 'abcd';
if (part.includes('a')) for (const B of [0.25, 0.5, 0.75, 1, 1.5, 2]) for (const pr of [0, 1]) H.run(`бюджет эпизода B ${B}${pr ? ', в конце тратить' : ''}`, S57, H.gatePol({ B, pendRel: pr }));
if (part.includes('b')) {
  for (const R of [-30, -50, -70]) H.run(`ворота rel180 < ${R}`, S57, H.gatePol({ gate: (I, j) => I.rel180[j] < R }));
  for (const O of [-1.5, -3, -5]) H.run(`ворота oth90 < ${O}`, S57, H.gatePol({ gate: (I, j) => I.oth90[j] < O }));
  for (const M of [0.5, 0.6, 0.7]) H.run(`ворота sma200 < ${M}`, S57, H.gatePol({ gate: (I, j) => I.sma200[j] < M }));
  for (const D of [70, 80, 90]) H.run(`ворота dd365 > ${D}`, S57, H.gatePol({ gate: (I, j) => I.dd365[j] > D }));
}
if (part.includes('c')) {
  for (const R of [-30, -50]) H.run(`выдача × 1 при rel180 < ${R}`, S57, H.gatePol({ relMult: (I, j) => (I.rel180[j] < R ? 1 : 2) }));
  for (const O of [-1.5, -3]) H.run(`выдача × 1 при oth90 < ${O}`, S57, H.gatePol({ relMult: (I, j) => (I.oth90[j] < O ? 1 : 2) }));
}
if (part.includes('d')) for (const R of [-30, -50]) for (const m of [0.5, 0]) H.run(`паника: rel180 < ${R} → доля × ${m}`, H.withCopies(S57, [4, 5, 6, 7, 8, 9], [c('rel180', '<', R)], (a) => (m ? 1 + (a - 1) * m : 1)), polW);
