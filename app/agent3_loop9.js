/* Агент 3, круг 9: относительная сила монеты для размеров покупок (зеркало C4). В круге 2 бета/волатильность для покупок ничего не дали.
   H9a: в дни сигналов дна сильная монета (pair = монета/BTC к своей средней 200 > x, или монета выше своей средней 200) быстрее
   восстанавливается → покупать резервом крупнее (×1,5/×2); H9b: слабая (pair < x или ниже средней 200 в s раз) → мельче (×0,5);
   H9c: слабая и высокобетовая (как в C4) → покупки ×0,5. База — C4. Критерий: строгая проверка к C4 + доход > +0,03 + плато.
   Запуск: node app/agent3_loop9.js <out.json> > log */
const A = require('./agent3_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.C4), out = [];
console.log(A.HDR); console.log(A.row('C4', base, base));
const rec = (t, S) => { const r = A.ev(G, S); console.log(A.row(t, r, base)); out.push({ tag: t, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m }); };
const buys = (r) => r.act > 1;
for (const x of [1.0, 1.1, 1.2, 1.4]) for (const k of [1.5, 2]) rec(`H9a pair > ${x}: покупки ×${k}`, A.scaleC(A.C4, [A.c('pair', '>', x)], k, 1, buys));
for (const s of [1.0, 1.2]) for (const k of [1.5, 2]) rec(`H9a монета > ${s} средней 200: покупки ×${k}`, A.scaleC(A.C4, [A.c('sma200', '>', s)], k, 1, buys));
for (const x of [0.6, 0.8, 0.9, 1.0]) rec(`H9b pair < ${x}: покупки ×0,5`, A.scaleC(A.C4, [A.c('pair', '<', x)], 0.5, 1, buys));
for (const s of [0.3, 0.5, 0.7]) rec(`H9b монета < ${s} средней 200: покупки ×0,5`, A.scaleC(A.C4, [A.c('sma200', '<', s)], 0.5, 1, buys));
for (const b of [1.2, 1.4]) for (const s of [0.5, 0.7, 1.0]) rec(`H9c бета > ${b} и монета < ${s} средней 200: покупки ×0,5`, A.scaleC(A.C4, [A.c('beta180', '>', b), A.c('sma200', '<', s)], 0.5, 1, buys));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
