/* Круг 2б: мягкий долг (k 0,7/0,85) и долг только в середине эпизода (дни a…b, где покупки основы самые ранние). Запуск: node panicx_r2b.js */
const P = require('./panicx_sim.js');
const { CF } = { CF: { any: (I, j) => I.brsi[j] < 30 || I.bdrop[j] > 10 || I.pupk[j] < 0.95, bd10: (I, j) => I.bdrop[j] > 10, rsi30: (I, j) => I.brsi[j] < 30 } };
const D = (cf, k, a = 1, b = 1e9) => ({
  buy: ({ X, j, share }) => { const d = X.ind.pday[j]; return d < a || d > b || cf(X.ind, j) ? share : share * k; },
  release: ({ X, j }) => (cf(X.ind, j) || X.ind.pend[j] ? 1 : 0),
});
P.report('основа', P.base, null);
for (const cn in CF) for (const k of [0.7, 0.85]) P.report(`${cn} k${k}`, P.base, D(CF[cn], k));
for (const cn in CF) for (const [a, b] of [[8, 30], [4, 30], [8, 60]]) for (const k of [0, 0.5]) P.report(`${cn} k${k} дни ${a}-${b}`, P.base, D(CF[cn], k, a, b));
