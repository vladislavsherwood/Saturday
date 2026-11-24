/* au, круг 8б: проверка двух находок круга 8 — (1) вершина ×m при au_c90 > X (плато X, m; без одного года); (2) паника ×1,5 при au_c30 < X, монете > 180 дней.
   Запуск: node au_r8b.js > scratchpad/au/r8b.txt */
const A = require('./au_lib.js'), { c, S6, T } = A;
const mod = (S, pick, cond, f) => A.preMod(S, (r, q) => pick(q), (r) => ({ act: +f(r.act).toFixed(6), conds: [...r.conds, ...cond] }));
const buy = (q) => q <= 8, top = (q) => (q >= 39 && q <= 58) || (q >= 60 && q <= 68);
for (const x of [-0.1, 0, 0.05, 0.1, 0.15, 0.2]) for (const m of [1.25, 1.5, 2]) A.run(`c90 > ${x}: вершина ×${m}`, mod(S6, top, [c('au_c90', '>', x)], (a) => Math.max(-1, a * m)));
for (const y of [2017, 2018, 2021, 2024, 2025]) { A.L.addInd('au_y' + y, (X) => Float64Array.from(X.ind.t, (t) => (t >= T(y + '-01-01') && t < T(y + 1 + '-01-01') ? 1 : 0)));
  A.run(`c90 > 0.1 ×1,5 без ${y}`, mod(S6, top, [c('au_c90', '>', 0.1), c('au_y' + y, '<', 0.5)], (a) => Math.max(-1, a * 1.5))); }
for (const x of [-0.1, 0, 0.1, 0.2]) A.run(`c30 < ${x}: паника ×1,5, age>180`, mod(S6, buy, [c('au_c30', '<', x), c('age', '>', 180)], (a) => 1 + (a - 1) * 1.5));
// дни срабатывания вершины при c90 > 0.1 (по 81 монете, месяцы)
const M = {}; for (const g of ['sel', 'ex', 'rnd']) for (const X of A.G[g]) { const I = X.ind; for (let j = 0; j < X.n; j++) { if (!(I.au_c90[j] > 0.1)) continue; const q = S6.rules.findIndex((r) => r.conds.every((cd) => I[cd.ind] && (cd.op === '<' ? I[cd.ind][j] < cd.v : I[cd.ind][j] > cd.v))); if (top(q)) { const m = A.day(I.t[j]).slice(0, 7); M[m] = (M[m] || 0) + 1; } } }
console.log('месяцы продаж у вершины при c90 > 0,1:', Object.entries(M).sort().map(([m, k]) => `${m}:${k}`).join(' '));
