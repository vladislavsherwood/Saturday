/* Агент 4C, круг 5: «слабее рынка → продавать крупнее» только у монет нужного типа.
   Круг 4 показал: строгая проверка ломается на XMR (спокойная монета, низкая волатильность) и ARIA (молодая монета).
   Гипотеза (заранее): правило имеет смысл для спекулятивных монет со своей историей — фильтр «годовая волатильность за 180 дн > 60/80%»
   и/или «возраст монеты > 365/540 дней» сохранит доход и пройдёт строгую проверку. Ядра: к BTC за 180 дн < −15%; за 90 и 180 дн < −15%;
   за 90 дн < −20%; pair < 0,9 — все продажи ×1,5 (и ×1,25 для плато). Критерий: строгая ✔, доход > +0,03, соседи > 0.
   Запуск: node app/agent4c_loop5.js <out.json> > log */
const A = require('./agent4c_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.W25), out = [], rec = A.recorder(G, base, out);
console.log(A.HDR); console.log(A.row('W25', base, base));
const CORE = [['180<−15', (X, i) => X.ind.rel180[i] < -15], ['90и180<−15', (X, i) => X.ind.rel90[i] < -15 && X.ind.rel180[i] < -15], ['90<−20', (X, i) => X.ind.rel90[i] < -20], ['pair<0,9', (X, i) => (X.ind.pair || [])[i] < 0.9]];
const FIL = [['—', () => true], ['вол>60', (X, i) => X.ind.vol180[i] > 60], ['вол>80', (X, i) => X.ind.vol180[i] > 80], ['возраст>365', (X, i) => X.ind.age[i] > 365], ['возраст>540', (X, i) => X.ind.age[i] > 540], ['вол>60 и возраст>365', (X, i) => X.ind.vol180[i] > 60 && X.ind.age[i] > 365]];
CORE.forEach(([ct, cf], a) => FIL.forEach(([ft, ff], b) => {
  const key = `c5_${a}_${b}`; A.addInd(G, key, (X) => A.flagOf(X.n, (i) => cf(X, i) && ff(X, i)));
  for (const k of [1.25, 1.5]) rec(`${ct} | ${ft}: продажи ×${k}`, A.scale(A.W25, key, 1, k, A.isSell));
}));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
