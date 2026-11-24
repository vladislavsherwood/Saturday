/* au, круг 9в: «бегство в защиту» с тем же возрастным порогом, что и К1 (монете > 180 дней; сетка 90/180/365 для плато). Запуск: node au_r9c.js > scratchpad/au/r9c.txt */
const A = require('./au_lib.js'), { c, S6, T } = A;
const fear = (q) => q >= 11 && q <= 26;
const mk = (x, m, extra = []) => A.preMod(S6, (r, q) => fear(q), (r) => ({ act: +Math.max(-1, r.act * m).toFixed(6), conds: [...r.conds, c('au_r30', '>', x), ...extra] }));
const rows = [];
for (const age of [90, 180, 365]) for (const x of [1, 2, 3, 4, 5, 6]) for (const m of [1.25, 1.5, 2]) rows.push([`страх ×${m}, золото +${x}%, age>${age}`, A.run(`страх ×${m}, золото +${x}%, age>${age}`, mk(x, m, [c('age', '>', age)]))]);
for (const y of [2018, 2019, 2020, 2021, 2022, 2024, 2025]) { A.L.addInd('au_y' + y, (X) => Float64Array.from(X.ind.t, (t) => (t >= T(y + '-01-01') && t < T(y + 1 + '-01-01') ? 1 : 0)));
  A.run(`×1,5 +3% age>180 без ${y}`, mk(3, 1.5, [c('age', '>', 180), c('au_y' + y, '<', 0.5)])); }
const ok = rows.filter(([, r]) => !r.w && r.dseg.all > 0 && r.n100 && r.n100.m > 0 && r.n100.u > r.n100.d && r.hv.h1 > -0.005 && r.hv.h2 > -0.005);
console.log('\nпрошли критерий 1, 2, 4:', ok.length, 'из', rows.length, ':', ok.map(([nm, r]) => `${nm} ${A.sg(r.dseg.all)}`).join('; '));
