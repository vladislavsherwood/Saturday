/* tune5, круг 2: доли разворота (правило 11 — весь резерв; исключение 7 — весь резерв; исключение 6 — только взнос) и порог исключения 7
   поверх круга 1 (T = 19,5). Доход и строгая — к combo2. Запуск: node app/tune5_r2.js [выход.json] */
const T = require('./tune5_sim.js'); const fs = require('fs');
const B = { T: 19.5 };
const res = {}; const run = (tag, p) => { const o = T.evalS(T.rev({ ...B, ...p })); res[tag] = { p, ...o }; console.log(T.fmt(tag, o)); };
run('круг 1 (T=19,5)', {});
console.log('--- доля правила 11 (резерв, %)');
for (const v of [80, 85, 88, 90, 92, 94, 95, 96, 97, 98, 98.5, 99, 99.5]) run('a11=' + v + '%', { a11: 1 + v / 100 });
console.log('--- доля исключения 7 (фандинг)');
for (const v of [80, 85, 90, 95, 97.5, 99]) run('a7=' + v + '%', { a7: 1 + v / 100 });
run('без исключения 7', { no7: true });
console.log('--- исключение 6 (страх): доля резерва вместо «только взнос»');
for (const v of [2.5, 5, 7.5, 10, 15, 20, 30, 50]) run('a6=' + v + '%', { a6: 1 + v / 100 });
run('без исключения 6', { no6: true });
console.log('--- порог исключения 7 (btcr30), правило 11 при 19,5');
for (const v of [16, 16.5, 17, 17.5, 18, 18.5, 19, 20, 21]) run('T7=' + v, { T7: v });
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res));
