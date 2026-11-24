/* au, круг 10б: К2 («металлы падают вместе с криптой, BTC < 200д → не продавать на страхе») поверх К1+К4 — плато порога и без одного года. Запуск: node au_r10b.js */
process.argv[2] = 'quiet';
const A = require('./au_lib.js'), { c, T } = A;
const origLog = console.log; console.log = () => {}; const { build } = require('./au_r10.js'); console.log = origLog;
const K1 = { x: 6, m: 1.5, age: 365 }, K4 = { x: 3, m: 1.5, age: 365 };
for (const x of [4, 5, 6, 7, 8, 10]) A.run(`К1+К4+К2 ${x}`, build({ k1: K1, k4: K4, k2: { x } }));
A.run('К1+К4+К2 6, только монеты > 365 дн.', (() => { const S = build({ k1: K1, k4: K4, k2: { x: 6 } }); S.rules.forEach((r) => { if (r.au && r.au.family.startsWith('К2')) r.conds.push(c('age', '>', 365)); }); return S; })());
for (const y of [2018, 2020, 2021, 2022]) { A.L.addInd('au_z' + y, (X) => Float64Array.from(X.ind.t, (t) => (t >= T(y + '-01-01') && t < T(y + 1 + '-01-01') ? 1 : 0)));
  const S = build({ k1: K1, k4: K4, k2: { x: 6 } }); S.rules.forEach((r) => { if (r.au && r.au.family.startsWith('К2')) r.conds.push(c('au_z' + y, '<', 0.5)); }); A.run(`К1+К4+К2 6, К2 без ${y}`, S); }
