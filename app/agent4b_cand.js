/* Агент 4B: кандидаты — R(s, r, D): W25 с широкой тихой вершиной s и возвратом r резерва в день при новом 90-дн. максимуме монеты
   в течение D дней после тихой вершины (узкой или широкой), при жадности > 52. Индикатор ago_qt — дней с последней тихой вершины.
   Использование: const K = require('./agent4b_cand.js'); K.prep(G); const S = K.R(0.5, 0.1, 45) */
const B = require('./agent4b_sim.js');
const { c } = B;
const I = (X) => X.ind;
function prep(G) { B.addInd(G, 'ago_qt', (X) => B.since(X.n, (i) => I(X).qt[i] > 0.5 || (I(X).btcath[i] < 15 && I(X).oth90[i] > 1))); }
const R0 = B.W25.rules, iW = R0.findIndex(B.isW);
const reentry = (r, D) => ({ act: 1 + r, conds: [c('ago_qt', '<', D + 0.5), c('ago_qt', '>', 0.5), c('fng', '>', 52), c('hi90', '>', 0.5)] });
const R = (s = 0.5, r = 0.1, D = 45) => B.ins({ ...B.W25, rules: R0.map((q, i) => (i === iW ? { ...q, act: -s } : q)) }, [reentry(r, D)]);
module.exports = { prep, R, reentry, iW };
