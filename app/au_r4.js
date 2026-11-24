/* au, круг 4: серебро падает во время паники крипты → покупки паники крупнее. Копии правил покупки 0–8 перед исходными, доля резерва × m при условии серебра.
   Сетка: условие (серебро −X% за 30 д | серебро хуже золота на X п.п.), m 1,25/1,5/2, какие правила (все 0–8 | паника 3–8 | 0–2).
   Запуск: node au_r4.js > scratchpad/au/r4.txt */
const A = require('./au_lib.js'), { c, S6, P, Z } = A;
A.L.addInd('agau30', (X) => Float64Array.from(X.ind.ag_r30, (v, i) => v - X.ind.au_r30[i]));
const rows = [];
const R = (nm, S) => { const r = A.run(nm, S); rows.push([nm, r]); return r; };
R('combo6', S6);
const SIG = { ag: (x) => [c('ag_r30', '<', -x)], sg: (x) => [c('agau30', '<', -x)], au: (x) => [c('au_r30', '<', -x)] };
const boost = (cond, m, pick = (q) => q <= 8) => A.preMod(S6, (r, q) => pick(q), (r) => ({ act: +(1 + (r.act - 1) * m).toFixed(6), conds: [...r.conds, ...cond] }));
for (const [k, xs] of [['ag', [6, 8, 10, 12, 15]], ['sg', [4, 6, 8, 10, 12]]]) for (const x of xs) for (const m of [1.25, 1.5, 2]) R(`${k} ${x} ×${m} 0–8`, boost(SIG[k](x), m));
for (const [k, x] of [['ag', 8], ['sg', 8]]) { R(`${k} ${x} ×1.5 только 3–8 (usdt)`, boost(SIG[k](x), 1.5, (q) => q >= 3 && q <= 8)); R(`${k} ${x} ×1.5 только 0–2`, boost(SIG[k](x), 1.5, (q) => q <= 2)); }
// кто даёт ✗ «хп» у 50 случайных: худшие половины монет
const { BR } = P.baseline();
const r = rows.find(([nm]) => nm === 'sg 8 ×1.5 0–8')[1];
const worst = (RR) => RR.rnd.map((x) => [x.name, Math.min(x.h1, x.h2)]).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([n, v]) => `${n} ${v.toFixed(2)}`).join(', ');
console.log('\nхудшие половины 50 случ.: основа', worst(BR), '| sg 8 ×1,5', worst(r.R));
const ok = rows.filter(([, r]) => !r.w && r.dseg.all > 0 && r.n100 && r.n100.m > 0 && r.n100.u > r.n100.d && r.hv.h1 > -0.005 && r.hv.h2 > -0.005);
console.log('прошли критерий 1, 2, 4:', ok.map(([nm, r]) => `${nm} ${A.sg(r.dseg.all)}`).join('; ') || 'нет');
