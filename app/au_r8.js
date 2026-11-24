/* au, круг 8: корреляция BTC–золото как переключатель режима. Высокая корреляция (> X) — крипта торгуется как макро-актив ликвидности.
   (а) покупки паники 0–8 ×1,5 при корреляции > X; (б) то же при корреляции < X; (в) продажи на страхе 11–26 ×0 при корреляции > X;
   (г) продажи у вершины (широкая тихая 39–58, памп 60–68) ×1,5 / ×0,5 при корреляции > X. au_c90 / au_c30. Запуск: node au_r8.js > scratchpad/au/r8.txt */
const A = require('./au_lib.js'), { c, S6 } = A;
const rows = [];
const R = (nm, S) => { const r = A.run(nm, S); rows.push([nm, r]); return r; };
const mod = (pick, cond, f) => A.preMod(S6, (r, q) => pick(q), (r) => ({ act: +f(r.act).toFixed(6), conds: [...r.conds, ...cond] }));
const buy = (q) => q <= 8, fear = (q) => q >= 11 && q <= 26, top = (q) => (q >= 39 && q <= 58) || (q >= 60 && q <= 68);
for (const ind of ['au_c90', 'au_c30']) for (const x of [0.1, 0.2, 0.3]) {
  R(`${ind} > ${x}: паника ×1,5`, mod(buy, [c(ind, '>', x)], (a) => 1 + (a - 1) * 1.5));
  R(`${ind} < ${x - 0.2}: паника ×1,5`, mod(buy, [c(ind, '<', +(x - 0.2).toFixed(1))], (a) => 1 + (a - 1) * 1.5));
  R(`${ind} > ${x}: страх ×0`, mod(fear, [c(ind, '>', x)], () => 1));
  R(`${ind} > ${x}: вершина ×1,5`, mod(top, [c(ind, '>', x)], (a) => Math.max(-1, a * 1.5)));
  R(`${ind} > ${x}: вершина ×0,5`, mod(top, [c(ind, '>', x)], (a) => a * 0.5));
}
const ok = rows.filter(([, r]) => !r.w && r.dseg.all > 0 && r.n100 && r.n100.m > 0 && r.n100.u > r.n100.d && r.hv.h1 > -0.005 && r.hv.h2 > -0.005);
console.log('\nпрошли критерий 1, 2, 4:', ok.map(([nm, r]) => `${nm} ${A.sg(r.dseg.all)}`).join('; ') || 'нет');
