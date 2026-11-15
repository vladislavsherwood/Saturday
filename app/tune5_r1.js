/* tune5, круг 1: порог разворота BTC (btcr30 > T) — общий для правил 6, 7, 11 и по отдельности. Запуск: node app/tune5_r1.js [выход.json] */
const T = require('./tune5_sim.js'); const fs = require('fs');
const res = {}; const run = (tag, p) => { const o = T.evalS(T.rev(p)); res[tag] = { p, ...o }; console.log(T.fmt(tag, o)); };
console.log('--- общий порог T (шаг 0,5; около 19–21 шаг 0,25)');
for (let v = 17; v <= 25.001; v += 0.5) run('T=' + v, { T: v });
for (const v of [18.75, 19.25, 19.75, 20.25, 20.75, 21.25]) run('T=' + v, { T: v });
console.log('--- только правило 11 (исключения 6, 7 при 20)');
for (const v of [18.5, 19, 19.5, 20.5, 21, 21.5, 22]) run('T11=' + v, { T11: v });
console.log('--- только исключения 6 и 7 (правило 11 при 20)');
for (const v of [18, 19, 19.5, 20.5, 21, 22, 23]) run('T6,7=' + v, { T6: v, T7: v });
for (const v of [18, 19, 21, 22]) run('T6=' + v, { T6: v });
for (const v of [18, 19, 21, 22]) run('T7=' + v, { T7: v });
if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(res));
