/* Агент 4C, круг 4: форма «слабее рынка → продавать крупнее», которая пройдёт строгую проверку.
   Круг 3: плато +0,10…+0,21 (окна 60–180 дн, пороги −10…−30%), но мимо строгой на волосок: худшая половина экзамена (XMR 2-я половина)
   и 50 случайных (ARIA 2-я половина). Гипотезы (заранее): H4a подтверждение «монета и сама ниже своей средней 200» (слабость не только
   к BTC, но и абсолютная); H4b устойчивая слабость — слабее BTC и за 90, и за 180 дней; H4c слабость как тренд отношения монета/BTC
   (pair — монета/BTC к своей средней 200 < 0,7/0,8/0,9); H4d H4c + H4a. Множитель всех продаж ×1,25/×1,5/×2.
   Критерий: строгая ✔, доход > +0,03, соседние пороги > 0. Запуск: node app/agent4c_loop4.js <out.json> > log */
const A = require('./agent4c_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.W25), out = [], rec = A.recorder(G, base, out);
console.log(A.HDR); console.log(A.row('W25', base, base));
const F = [];
for (const [w, v] of [[90, -15], [90, -20], [180, -15], [180, -20]]) F.push([`H4a к BTC за ${w} дн < ${v}% и монета < средней 200`, (X, i) => X.ind['rel' + w][i] < v && X.ind.sma200[i] < 1]);
for (const v of [-10, -15, -20, -30]) F.push([`H4b к BTC за 90 и 180 дн < ${v}%`, (X, i) => X.ind.rel90[i] < v && X.ind.rel180[i] < v]);
for (const x of [0.7, 0.8, 0.9]) F.push([`H4c pair < ${x}`, (X, i) => (X.ind.pair || [])[i] < x]);
for (const x of [0.7, 0.8, 0.9]) F.push([`H4d pair < ${x} и монета < средней 200`, (X, i) => (X.ind.pair || [])[i] < x && X.ind.sma200[i] < 1]);
F.forEach(([t, f], q) => { const key = 'c4_' + q; A.addInd(G, key, (X) => A.flagOf(X.n, (i) => f(X, i))); for (const k of [1.25, 1.5, 2]) rec(`${t}: продажи ×${k}`, A.scale(A.W25, key, 1, k, A.isSell)); });
fs.writeFileSync(process.argv[2], JSON.stringify(out));
