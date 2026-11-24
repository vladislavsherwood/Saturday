/* au, круг 5в: «не продавать на страхе» (sg X, BTC < 200д) без одного года — держится ли на одном эпизоде. Запуск: node au_r5c.js */
const A = require('./au_lib.js'), { c, S6, T } = A;
A.L.addInd('agau30', (X) => Float64Array.from(X.ind.ag_r30, (v, i) => v - X.ind.au_r30[i]));
const fear = (q) => q >= 11 && q <= 26;
const mk = (x, extra = []) => A.preMod(S6, (r, q) => fear(q), (r) => ({ act: 1, conds: [...r.conds, c('agau30', '<', -x), c('btc200', '<', 1), ...extra] }));
for (const y of [2018, 2020, 2021, 2022]) { A.L.addInd('au_y' + y, (X) => Float64Array.from(X.ind.t, (t) => (t >= T(y + '-01-01') && t < T(y + 1 + '-01-01') ? 1 : 0)));
  for (const x of [5, 6, 7]) A.run(`sg ${x} без ${y}`, mk(x, [c('au_y' + y, '<', 0.5)])); A.run(`sg 6 только ${y}`, mk(6, [c('au_y' + y, '>', 0.5)])); }
