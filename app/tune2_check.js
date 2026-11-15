/* tune2 круг 0: сборщик повторяет combo2 один в один; пересчёт usdt с окном 200 ≈ исходный ряд; время одного расчёта */
const T = require('./tune2_sim.js');
const S = T.build(T.P0);
console.log('правил', S.rules.length, 'совпадают с combo2:', JSON.stringify(S.rules) === JSON.stringify(T.CB.rules));
let t0 = Date.now(); const G = T.load(['sel', 'ex', 'rnd', 'n100']); console.log('загрузка', Date.now() - t0, 'мс');
t0 = Date.now(); const B = T.ev(G, T.P0); console.log('расчёт', Date.now() - t0, 'мс');
console.log(T.row('combo2', B, B));
// окно 200 пересчитанное: подменяем имя индикатора
T.addUsdt(G, 200);
const S2 = JSON.parse(JSON.stringify(S).replace(/"usdt"/g, '"usdt200"'));
const R2 = T.Z.sum(T.Z.evc(G, S2, ['sel', 'ex', 'rnd']));
console.log(T.row('пересч.200', R2, B));
