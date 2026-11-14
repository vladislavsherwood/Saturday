/* Агент 4C, круг 2: размер продаж по состоянию самой монеты.
   H2a (идея пользователя): монета слабее рынка — продавать крупнее (rel90 < −20/−40%; отношение монета/BTC ниже максимума года > 50/70%).
   H2b (по кругу 0): монета разогнана относительно своей истории — продавать крупнее (монета > 1,5/2/3 средней 200; памп за год ×5/×10 и
   монета > 1,2 средней 200; rel90 > +20/+50%). Множитель ×1,5/×2 для всех продаж или только для продаж на страхе.
   Критерий: строгая ✔ к W25, доход > +0,03, соседние пороги > 0. Запуск: node app/agent4c_loop2.js <out.json> > log */
const A = require('./agent4c_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.W25), out = [], rec = A.recorder(G, base, out);
console.log(A.HDR); console.log(A.row('W25', base, base));
const F = [];
for (const v of [-20, -40]) F.push([`H2a к BTC за 90 дн < ${v}%`, (X, i) => X.ind.rel90[i] < v]);
for (const v of [50, 70]) F.push([`H2a монета/BTC ниже макс. года > ${v}%`, (X, i) => X.ind.rdd365[i] > v]);
for (const s of [1.5, 2, 3]) F.push([`H2b монета > ${s} средней 200`, (X, i) => X.ind.sma200[i] > s]);
for (const p of [5, 10]) F.push([`H2b памп365 > ×${p} и монета > 1,2 средней 200`, (X, i) => X.ind.pump365[i] > p && X.ind.sma200[i] > 1.2]);
for (const v of [20, 50]) F.push([`H2b к BTC за 90 дн > +${v}%`, (X, i) => X.ind.rel90[i] > v]);
const WH = { все: A.isSell, страх: A.isFear };
F.forEach(([t, f], q) => { const key = 'c2_' + q; A.addInd(G, key, (X) => A.flagOf(X.n, (i) => f(X, i))); for (const k of [1.5, 2]) for (const wh in WH) rec(`${t}: продажи (${wh}) ×${k}`, A.scale(A.W25, key, 1, k, WH[wh])); });
fs.writeFileSync(process.argv[2], JSON.stringify(out));
