/* au, круг 5б: плато и эпизоды правила «серебро хуже золота на X п.п., BTC < 200д → не продавать на страхе (правила 11–26)».
   Тонкая сетка X 4…9; месяцы, в которые правило отменило продажи (по всем 181 монетам: число отменённых продаж). Запуск: node au_r5b.js */
const A = require('./au_lib.js'), { c, S6, XS, day } = A;
A.L.addInd('agau30', (X) => Float64Array.from(X.ind.ag_r30, (v, i) => v - X.ind.au_r30[i]));
const fear = (q) => q >= 11 && q <= 26;
const mk = (x, extra = []) => A.preMod(S6, (r, q) => fear(q), (r) => ({ act: 1, conds: [...r.conds, c('agau30', '<', -x), c('btc200', '<', 1), ...extra] }));
for (const x of [4, 5, 6, 7, 8, 9]) A.run(`sg ${x} страх ×0 BTC<200`, mk(x));
for (const x of [5, 6, 7]) A.run(`sg ${x} страх ×0 BTC<200, не мемы`, mk(x, [c('meme', '<', 0.5)]));
// эпизоды: дни, когда хоть одно правило страха срабатывает и условие металла верно (по монетам из 81)
const M = {}; const cnt = {};
for (const g of ['sel', 'ex', 'rnd']) for (const X of A.G[g]) { const I = X.ind; for (let j = 0; j < X.n; j++) {
  if (!(I.agau30[j] < -6 && I.btc200[j] < 1)) continue;
  const hit = S6.rules.findIndex((r) => r.conds.every((cd) => I[cd.ind] && (cd.op === '<' ? I[cd.ind][j] < cd.v : I[cd.ind][j] > cd.v)));
  if (fear(hit)) { const m = day(I.t[j]).slice(0, 7); M[m] = (M[m] || 0) + 1; } } }
console.log('месяцы с отменёнными продажами на страхе (sg 6, монето-дни):', Object.entries(M).sort().map(([m, k]) => `${m}:${k}`).join(' '));
