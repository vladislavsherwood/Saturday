/* imp4: ZEC (июнь 2026) — что делала основа перед обвалом монеты 2026-06-04 (−26%, на следующий день −15%) и после. */
const L = require('./imp4_lib.js'); const { K } = L;
const G = K.groups(['sel']); K.prep(G);
const X = L.zecX(G); const p = L.path(X, L.S0, 0);
console.log('ZEC: итог к DCA', K.E ? K.E(X, L.S0, 'full').toFixed(0) + '%' : '');
const i0 = X.t.indexOf(L.tOf('2026-06-04'));
for (let i = i0 - 20; i <= i0 + 14; i++) console.log(L.day(X.t[i]), X.c[i].toFixed(1), (100 * (X.c[i] / X.c[i - 1] - 1)).toFixed(1), 'доля', (100 * p.expo(i)).toFixed(0) + '%', 'правило', p.Q[i], 'act', p.A[i].toFixed(3), 'fng', X.ind.fng[i - 1], 'rel180', X.ind.rel180[i - 1].toFixed(0), 'up90', X.ind.up90[i - 1].toFixed(0));
const e = (k) => ((p.eq(i0 + k) - 10 * (k + 1)) / p.eq(i0 - 1) - 1) * 100, d = (k) => ((p.dca(i0 + k) - 10 * (k + 1)) / p.dca(i0 - 1) - 1) * 100;
console.log('потеря стратегии D/D+2/D+6', [0, 2, 6].map((k) => e(k).toFixed(1)).join('/'), '| DCA', [0, 2, 6].map((k) => d(k).toFixed(1)).join('/'));
