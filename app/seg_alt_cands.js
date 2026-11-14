/* Агент «АЛЬТЫ»: кандидаты (сборка правил) и запись в JSON для браузерного стенда.
   A1(k) — широкая тихая вершина ×k у альтов (копии правил #23, #24 основы с условием isalt > 0,5 перед исходными);
   AS(f, o, s) — альтсезон: альт, жадность > f и доля альтов за 90 дней > o п.п., в день без других сигналов (в конце списка) → продать s.
   Запуск: node app/seg_alt_cands.js <out.json> */
const Q = require('./seg_alt_sim.js');
const { c } = Q;
const ALT = c('isalt', '>', 0.5);
const A1 = (S, k) => (k === 1 ? S : { ...S, rules: S.rules.flatMap((r, q) => ([23, 24].includes(q) ? [{ act: Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, ALT] }, r] : [r])) });
const AS = (S, f = 65, o = 1, s = 0.1) => (s === 0 ? S : { ...S, rules: [...S.rules, { act: -s, conds: [ALT, c('fng', '>', f), c('oth90', '>', o)] }] });
const V = {
  'основа (combo-best)': Q.BASE,
  'ВЫБОР: A1 ×1,25 + AS 65/1/10%': AS(A1(Q.BASE, 1.25), 65, 1, 0.1),
  'СИЛЬНЕЕ: A1 ×1,5 + AS 65/1/10%': AS(A1(Q.BASE, 1.5), 65, 1, 0.1),
  'ОСТОРОЖНО: только AS 65/1/10%': AS(Q.BASE, 65, 1, 0.1),
  'A1 ×1,25 + AS 65/1/5%': AS(A1(Q.BASE, 1.25), 65, 1, 0.05)
};
if (require.main === module) require('fs').writeFileSync(process.argv[2], JSON.stringify(V));
module.exports = { A1, AS, V, ALT };
