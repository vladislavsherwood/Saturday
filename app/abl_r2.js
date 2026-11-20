/* abl, круг 2: точечные проверки по итогам разбора — перегретый фандинг без альтов (альтам он мешает, крупным и мемам помогает); без узкой тихой вершины; вместе.
   Основа — настоящая combo4 (57 правил) и combo4 + фитили. Запуск: node abl_r2.js */
const L = require('./r4_lib.js'), { P, c } = L;
const S0 = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const polW = { ...L.pol0, wick: { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' } };
const noAlt = (S, ids) => { for (const i of ids) S.rules[i - 1].conds.push(c('isalt', '<', 0.5)); return S; };
const drop = (S, ids) => { S.rules = S.rules.filter((_, i) => !ids.includes(i + 1)); return S; };
const R = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
for (const [bn, pol] of [['combo4', L.pol0], ['combo4 + фитили', polW]]) {
  P.setBaseline(S0, pol); console.log(`\n=== основа: ${bn} ===`);
  const V = [['фандинг (28–30) не для альтов', () => noAlt(L.clone(S0), R(28, 30))], ['без узкой тихой вершины (31–38)', () => drop(L.clone(S0), R(31, 38))],
    ['оба', () => drop(noAlt(L.clone(S0), R(28, 30)), R(31, 38))], ['без правила 6 (мёртвое)', () => drop(L.clone(S0), [6])]];
  for (const [nm, f] of V) console.log(L.run(nm, f(), pol, { quiet: true, n100: true }).txt.slice(0, 250));
}
