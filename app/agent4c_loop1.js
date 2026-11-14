/* Агент 4C, круг 1: мягкая защита резерва по признакам самой монеты (размер, а не запрет).
   Гипотеза (заранее): по кругу 0 покупки резерва у монет после пампа (рост ×10+ за год) и у монет, которые слабее BTC, через 180 дней
   хуже среднего; если в такие дни тратить меньше резерва (доля покупки ×0 / ×0,25 / ×0,5), остаток уйдёт в покупки ниже.
   Признаки (только прошлое): pump365/pump180 (макс/мин за окно) > 5/10/20; rel90 (монета к BTC за 90 дн) < −40/−60%;
   rdd365 (просадка отношения монета/BTC от максимума за год) > 70/85%; памп ×10 И слабее BTC за 90 дн.
   Критерий: строгая проверка к W25 ✔, доход > +0,03, соседние пороги тоже > 0. Запуск: node app/agent4c_loop1.js <out.json> > log */
const A = require('./agent4c_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.W25), out = [], rec = A.recorder(G, base, out);
console.log(A.HDR); console.log(A.row('W25', base, base));
const F = [];
for (const p of [5, 10, 20]) for (const w of [180, 365]) F.push([`памп${w} > ×${p}`, (X, i) => X.ind['pump' + w][i] > p]);
for (const v of [-40, -60]) F.push([`к BTC за 90 дн < ${v}%`, (X, i) => X.ind.rel90[i] < v]);
for (const v of [70, 85]) F.push([`монета/BTC ниже максимума года > ${v}%`, (X, i) => X.ind.rdd365[i] > v]);
for (const p of [5, 10]) F.push([`памп365 > ×${p} и к BTC за 90 дн < 0`, (X, i) => X.ind.pump365[i] > p && X.ind.rel90[i] < 0]);
F.forEach(([t, f], q) => { const key = 'c1_' + q; A.addInd(G, key, (X) => A.flagOf(X.n, (i) => f(X, i))); for (const kb of [0, 0.25, 0.5]) rec(`${t}: покупки резерва ×${kb}`, A.scale(A.W25, key, kb, 1)); });
fs.writeFileSync(process.argv[2], JSON.stringify(out));
