/* au, круг 5: металлы падают вместе с криптой (общий вынос ликвидности) → отменить продажи на страхе (правила 11–26 combo6: usdtd < 7,6 и страх < 40/52).
   V1: копии правил 11–26 с условием металла и долей ×k (k 0 — не продавать, 0,5 — вполовину); V2: то же для всех продаж 11–76.
   Условие металла: серебро хуже золота на X п.п., серебро −X%, золото −X% за 30 дней; ± BTC < 200д. Запуск: node au_r5.js > scratchpad/au/r5.txt */
const A = require('./au_lib.js'), { c, S6 } = A;
A.L.addInd('agau30', (X) => Float64Array.from(X.ind.ag_r30, (v, i) => v - X.ind.au_r30[i]));
const rows = [];
const R = (nm, S) => { const r = A.run(nm, S); rows.push([nm, r]); return r; };
const SIG = { sg: (x) => [c('agau30', '<', -x)], ag: (x) => [c('ag_r30', '<', -x)], au: (x) => [c('au_r30', '<', -x)] };
const fear = (q) => q >= 11 && q <= 26, sells = (r, q) => r.act < 0;
const mod = (S, pick, cond, k) => A.preMod(S, (r, q) => pick(r, q), (r) => ({ act: k === 0 ? 1 : +(r.act * k).toFixed(6), conds: [...r.conds, ...cond] }));
for (const [s, xs] of [['sg', [6, 8, 10]], ['ag', [8, 10, 12]], ['au', [4, 5, 6]]]) for (const x of xs) {
  R(`${s} ${x} страх ×0`, mod(S6, (r, q) => fear(q), SIG[s](x), 0));
  R(`${s} ${x} страх ×0,5`, mod(S6, (r, q) => fear(q), SIG[s](x), 0.5));
  R(`${s} ${x} страх ×0 BTC<200`, mod(S6, (r, q) => fear(q), [...SIG[s](x), c('btc200', '<', 1)], 0));
  R(`${s} ${x} все продажи ×0`, mod(S6, sells, SIG[s](x), 0));
}
const ok = rows.filter(([, r]) => !r.w && r.dseg.all > 0 && r.n100 && r.n100.m > 0 && r.n100.u > r.n100.d && r.hv.h1 > -0.005 && r.hv.h2 > -0.005);
console.log('\nпрошли критерий 1, 2, 4:', ok.map(([nm, r]) => `${nm} ${A.sg(r.dseg.all)}`).join('; ') || 'нет');
