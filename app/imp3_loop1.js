/* imp3, круг 1: убывающая лесенка продаж на страхе внутри эпизода.
   Гипотеза: поздние дни длинного эпизода страха продают у дна; доля, зависящая от номера дня страха в эпизоде (fepn) или от того,
   сколько уже «продано по графику» (frem), при той же продаже в начале даст больше. Плюс обратная форма: начало эпизода крупнее.
   Запуск: node app/imp3_loop1.js <out.json> */
const Z = require('./imp3_sim.js');
const fs = require('fs');
const { c, K } = Z;
const G = Z.load();
for (const g of [7, 14, 30]) Z.addEp(G, g);
const base = Z.ev(G, Z.BASE), out = [], run = Z.runner(G, base, out);
console.log(Z.row('ОСНОВА', base, base));
for (const g of [7, 14, 30]) for (const N of [10, 20, 40, 80]) for (const k of [0.5, 0.25, 0]) run(`g${g}: день страха > ${N} → ×${k}`, Z.mod(Z.BASE, [[[c('fepn' + g, '>', N)], k]]));
for (const x of [0.1, 0.03, 0.01, 0.001]) for (const k of [0.5, 0]) run(`g14: осталось по графику < ${x} → ×${k}`, Z.mod(Z.BASE, [[[c('frem14', '<', x)], k]]));
for (const N of [3, 5, 10]) for (const k of [1.25, 1.5, 2]) run(`g14: первые ${N} дней страха ×${k}`, Z.mod(Z.BASE, [[[c('fepn14', '<', N + 0.5)], k]]));
for (const [N, k1, M, k2] of [[5, 1.5, 20, 0.5], [10, 1.25, 40, 0.5], [5, 1.5, 40, 0.75], [10, 1.5, 30, 0.75]]) run(`g14: первые ${N} ×${k1}, после ${M} ×${k2}`, Z.mod(Z.BASE, [[[c('fepn14', '<', N + 0.5)], k1], [[c('fepn14', '>', M)], k2]]));
// по календарной длительности эпизода
for (const D of [60, 120, 240]) for (const k of [0.5, 0]) run(`g14: эпизод старше ${D} дн → ×${k}`, Z.mod(Z.BASE, [[[c('fepd14', '>', D)], k]]));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
