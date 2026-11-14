/* Объединение: кандидаты для браузерного стенда (combo_lab.js). Запуск: node app/combo_cands.js <out.json> */
const K = require('./combo_sim.js');
const fs = require('fs');
const C = { W25: K.W25, F: K.F, 'F + C6': K.withC6(K.F), 'F + C1.25': K.withC(K.F, 1.25), 'F + C1.25 + C6': K.withC(K.withC6(K.F), 1.25),
  'F + C1.5 + C6': K.withC(K.withC6(K.F), 1.5), 'W25 + C1.25': K.withC(K.W25, 1.25) };
fs.writeFileSync(process.argv[2], JSON.stringify(C));
