/* st, проверка стенда: combo6 к самой себе (доход 0, ✔), значения рыночных индикаторов на известные даты. Запуск: node st_r0.js */
const ST = require('./st_lib.js'), { M, T0, T, BY } = ST;
const t0 = Date.now(); ST.ev('combo6 (основа)', ST.S6); console.log(`прогон ${((Date.now() - t0) / 1000).toFixed(1)} с`);
const keys = Object.keys(M);
for (const d of ['2018-12-24', '2020-03-16', '2021-11-10', '2022-06-18', '2022-11-21', '2024-08-05', '2025-04-08', '2025-10-10', '2026-11-12', '2026-11-23'])
  console.log(d, keys.map((k) => `${k.slice(3)} ${(+M[k][T(d) - T0]).toFixed(k.includes('c') && k.startsWith('st_bxc') ? 2 : 1)}`).join(' '));
const X = BY.BTC; console.log('BTC st_cxr90 / st_bxr90 последн.', X.ind.st_cxr90[X.n - 1].toFixed(1), X.ind.st_bxr90[X.n - 1].toFixed(1), 'cxc90', X.ind.st_cxc90[X.n - 1].toFixed(2), ST.day(X.ind.t[X.n - 1]));
console.log('монеты пользователя:', ST.MINE.map((n) => `${n}${BY[n] ? '' : '(нет)'}`).join(' '));
