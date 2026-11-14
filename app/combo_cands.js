/* Объединение: кандидаты для браузерного стенда (combo_lab.js) и портфеля. Запуск: node app/combo_cands.js <out.json> [c4] */
const K = require('./combo_sim.js');
const fs = require('fs');
const { c } = K;
const C4c = [c('beta180', '>', 1.2), c('sma200', '<', 1)], Cc = [c('rel180', '<', -15)];
const scaleSells = (S, L) => ({ ...S, rules: S.rules.flatMap((r) => (r.act < 0 ? [...L.map(([cs, k]) => ({ act: Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, ...cs] })), r] : [r])) });
const F6 = K.withC6(K.F);
const C = require.main !== module ? {} : process.argv[3] === 'c4'
  ? { W25: K.W25, F: K.F, 'F + C6': F6, 'F + C6 + C1.25': scaleSells(F6, [[Cc, 1.25]]), 'F + C6 + C4': scaleSells(F6, [[C4c, 1.5]]),
    'F + C6 + max(C4 ×1,5, C ×1,25)': scaleSells(F6, [[C4c, 1.5], [Cc, 1.25]]), 'W25 + C4': scaleSells(K.W25, [[C4c, 1.5]]) }
  : { W25: K.W25, F: K.F, 'F + C6': F6, 'F + C1.25': K.withC(K.F, 1.25), 'F + C1.25 + C6': K.withC(F6, 1.25), 'F + C1.5 + C6': K.withC(F6, 1.5), 'W25 + C1.25': K.withC(K.W25, 1.25) };
if (require.main === module) fs.writeFileSync(process.argv[2], JSON.stringify(C));
module.exports = { scaleSells, C4c, Cc };
