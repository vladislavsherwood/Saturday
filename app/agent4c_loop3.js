/* Агент 4C, круг 3: «монета слабее рынка → продавать крупнее» — плато и форма.
   Гипотеза (заранее): находка круга 2 (rel90 < −20% → все продажи ×1,5: +0,18, не проходит только по худшей половине экзамена)
   держится на плато по окну (30/60/90/180 дн), порогу (−10/−15/−20/−30%) и множителю (×1,25/×1,5), а при части порогов/множителей
   проходит строгую проверку. Также: только продажи у вершины (не на страхе). Критерий: строгая ✔, доход > +0,03, соседи > 0.
   Запуск: node app/agent4c_loop3.js <out.json> > log */
const A = require('./agent4c_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.W25), out = [], rec = A.recorder(G, base, out);
console.log(A.HDR); console.log(A.row('W25', base, base));
const WH = { все: A.isSell, вершины: (r) => A.isSell(r) && !A.isFear(r) };
for (const w of [30, 60, 90, 180]) for (const v of [-10, -15, -20, -30]) {
  const key = `c3_${w}_${v}`; A.addInd(G, key, (X) => A.flagOf(X.n, (i) => X.ind['rel' + w][i] < v));
  for (const k of [1.25, 1.5]) for (const wh in WH) { if (wh === 'вершины' && k !== 1.5) continue; rec(`к BTC за ${w} дн < ${v}%: продажи (${wh}) ×${k}`, A.scale(A.W25, key, 1, k, WH[wh])); }
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
