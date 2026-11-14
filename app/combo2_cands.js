/* Объединение 2: кандидаты для браузерного стенда и маржи (JSON {название: стратегия}). Запуск: node app/combo2_cands.js <выход.json> */
const Z = require('./combo2_sim.js'); const fs = require('fs');
const V = {
  'основа': {}, '+альты (A1+AS)': { a1: true, as: true }, '+мемы (CM2)': { cm2: true }, '+крупные B65': { b65: 'b' }, '+крупные список|B65': { b65: 'list' },
  'все три (B65)': { a1: true, as: true, cm2: true, b65: 'b' }, 'все три (список|B65)': { a1: true, as: true, cm2: true, b65: 'list' },
  'все три (список|B65) + TA': { a1: true, as: true, cm2: true, b65: 'list', ta: true },
};
fs.writeFileSync(process.argv[2], JSON.stringify(Object.fromEntries(Object.entries(V).map(([t, o]) => [t, Z.build(o)]))));
module.exports = { V };
