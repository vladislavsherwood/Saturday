/* imp3, круг 2: состояние монеты и BTC в момент продажи на страхе.
   Гипотеза: ошибки — продажи посреди собственного роста монеты (TON 2024, KAS 2023, XMR) и у дна, когда страх держится, а цена уже идёт вверх
   (весна 2019). Меньше продавать, если монета/BTC выросли от начала эпизода (fepc/fepb), монета сильнее BTC за 30/90 дней (rel30/rel90),
   монета в росте от 90-дн. минимума (up90), или уже глубоко упала (dd365, btcath); больше — если монета продолжает падать от начала эпизода.
   Запуск: node app/imp3_loop2.js <out.json> */
const Z = require('./imp3_sim.js');
const fs = require('fs');
const { c } = Z;
const G = Z.load();
Z.addEp(G, 14);
const base = Z.ev(G, Z.BASE), out = [], run = Z.runner(G, base, out);
console.log(Z.row('ОСНОВА', base, base));
const M = (cs, k) => Z.mod(Z.BASE, [[cs, k]]);
for (const x of [15, 30, 50, 100]) for (const k of [0.5, 0]) run(`монета от начала эпизода > +${x}% → ×${k}`, M([c('fepc14', '>', x)], k));
for (const x of [10, 20, 30]) for (const k of [0.5, 0]) run(`BTC от начала эпизода > +${x}% → ×${k}`, M([c('fepb14', '>', x)], k));
for (const w of [30, 90]) for (const x of [20, 50, 100]) for (const k of [0.5, 0]) run(`rel${w} > ${x} → ×${k}`, M([c('rel' + w, '>', x)], k));
for (const x of [100, 200, 400]) for (const k of [0.5, 0]) run(`up90 > ${x} → ×${k}`, M([c('up90', '>', x)], k));
for (const x of [70, 80, 90]) run(`dd365 > ${x} → ×0.5`, M([c('dd365', '>', x)], 0.5));
for (const x of [60, 70]) run(`btcath > ${x} → ×0.5`, M([c('btcath', '>', x)], 0.5));
for (const x of [-25, -40]) for (const k of [1.25, 1.5]) run(`монета от начала эпизода < ${x}% → ×${k}`, M([c('fepc14', '<', x)], k));
for (const x of [-10, -20]) for (const k of [1.25, 1.5]) run(`BTC от начала эпизода < ${x}% → ×${k}`, M([c('fepb14', '<', x)], k));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
