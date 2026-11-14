/* Агент 3, круг 2: признаки самой монеты для размеров покупок и продаж. Гипотеза: у монет с низкой бетой к BTC и ровным ростом (TRX:
   W25 в 7,5 раза лучше DCA) сигналы рынка надёжнее — им можно покупать резервом крупнее и продавать меньше; у высокобетовых и очень
   волатильных — наоборот (меньше покупок, крупнее продажи). Признаки за 180 дней (только прошлое): бета к BTC, годовая волатильность,
   корреляция с BTC. Размер: доля покупки резерва ×0,5/×1,5, доля продажи ×0,5/×1,5 — только в дни, когда признак выполнен.
   Критерий: строгая проверка к W25 + доход > +0,03 + соседние пороги в плюсе. Запуск: node app/agent3_loop2.js <out.json> > log */
const A = require('./agent3_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.W25), out = [];
console.log(A.HDR); console.log(A.row('W25', base, base));
const F = [];
for (const b of [0.7, 0.8, 0.9]) F.push([`бета < ${b}`, (X, i) => X.ind.beta180[i] < b]);
for (const b of [1.2, 1.4, 1.6]) F.push([`бета > ${b}`, (X, i) => X.ind.beta180[i] > b]);
for (const v of [100, 130, 160]) F.push([`волатильность > ${v}%`, (X, i) => X.ind.vol180[i] > v]);
for (const v of [60, 70, 80]) F.push([`волатильность < ${v}%`, (X, i) => X.ind.vol180[i] < v]);
for (const x of [0.4, 0.5, 0.6]) F.push([`корреляция < ${x}`, (X, i) => X.ind.corr180[i] < x]);
F.forEach(([tag, f], q) => {
  const key = 'f2_' + q; A.addInd(G, key, (X) => A.flagOf(X.n, (i) => f(X, i)));
  for (const [kb, ks] of [[0.5, 1], [1.5, 1], [1, 0.5], [1, 1.5], [1.5, 0.5], [0.5, 1.5]]) {
    const r = A.ev(G, A.scale(A.W25, key, kb, ks)), t = `${tag}: покупки ×${kb}, продажи ×${ks}`;
    console.log(A.row(t, r, base));
    out.push({ tag: t, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m });
  }
});
fs.writeFileSync(process.argv[2], JSON.stringify(out));
