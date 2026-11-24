/* au, круг 4б: усиление покупок 0–8 при «серебро хуже золота» — проверка возрастного порога монеты (age > A), снимающего ✗ строгой (WFI, монета 25 дней от листинга).
   Порог A — не подбор под WFI, а общее «у монеты есть история»: сетка 30/60/90/180/365, чтобы видеть плато. Запуск: node au_r4b.js > scratchpad/au/r4b.txt */
const A = require('./au_lib.js'), { c, S6 } = A;
A.L.addInd('agau30', (X) => Float64Array.from(X.ind.ag_r30, (v, i) => v - X.ind.au_r30[i]));
const rows = [];
const R = (nm, S) => { const r = A.run(nm, S); rows.push([nm, r]); return r; };
const boost = (cond, m) => A.preMod(S6, (r, q) => q <= 8, (r) => ({ act: +(1 + (r.act - 1) * m).toFixed(6), conds: [...r.conds, ...cond] }));
for (const x of [4, 6, 8, 10]) for (const m of [1.5, 2]) for (const age of [30, 60, 90, 180, 365]) R(`sg ${x} ×${m} age>${age}`, boost([c('agau30', '<', -x), c('age', '>', age)], m));
for (const x of [6, 8]) for (const age of [60, 90, 180]) R(`ag ${x} ×1.5 age>${age}`, boost([c('ag_r30', '<', -x), c('age', '>', age)], 1.5));
const ok = rows.filter(([, r]) => !r.w && r.dseg.all > 0 && r.n100 && r.n100.m > 0 && r.n100.u > r.n100.d && r.hv.h1 > -0.005 && r.hv.h2 > -0.005);
console.log('\nпрошли критерий 1, 2, 4:', ok.map(([nm, r]) => `${nm} ${A.sg(r.dseg.all)}`).join('; ') || 'нет');
