/* Агент 3, круг 4: крупнее продавать высокобетовые монеты, но не ту, что сама обгоняет биткоин (HYPE, NPC в круге 3).
   Фильтры (только прошлое): pair (монета/BTC к своей средней 200) < x; монета к своей средней 200 < s; рост монеты от 90-дн. минимума < u%;
   относительная доходность к BTC за 90 дней < 0; монета старше 365 дней. Множитель продаж ×1,5/×2 при бете180 > 1,1/1,2/1,3.
   Критерий: строгая проверка к W25 + доход > +0,03 + плато по соседним клеткам. Запуск: node app/agent3_loop4.js <out.json> > log */
const A = require('./agent3_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.W25), out = [];
console.log(A.HDR); console.log(A.row('W25', base, base));
A.addInd(G, 'rel90', (X) => { const a = new Float64Array(X.n), b = X.ind.btcp; for (let i = 0; i < X.n; i++) a[i] = i >= 90 ? ((X.c[i] / X.c[i - 90]) / (b[i] / b[i - 90]) - 1) * 100 : NaN; return a; });
const FI = [['без фильтра', () => true]];
for (const x of [0.9, 1.0, 1.1, 1.2]) FI.push([`pair < ${x}`, (X, i) => X.ind.pair[i] < x]);
for (const s of [1.0, 1.2, 1.5]) FI.push([`монета < ${s} средней 200`, (X, i) => X.ind.sma200[i] < s]);
for (const u of [50, 100, 200]) FI.push([`рост от 90-дн. мин. < ${u}%`, (X, i) => X.ind.up90[i] < u]);
for (const u of [0, 25, 50]) FI.push([`к BTC за 90 дн < ${u}%`, (X, i) => X.ind.rel90[i] < u]);
FI.push(['старше 365 дн', (X, i) => i >= 365]);
for (const b of [1.1, 1.2, 1.3]) FI.forEach(([ft, ff], q) => {
  const key = `f4_${b}_${q}`; A.addInd(G, key, (X) => A.flagOf(X.n, (i) => X.ind.beta180[i] > b && ff(X, i)));
  for (const k of [1.5, 2]) {
    const t = `бета > ${b}, ${ft}: продажи ×${k}`, r = A.ev(G, A.scale(A.W25, key, 1, k, (rr) => rr.act < 0));
    console.log(A.row(t, r, base)); out.push({ tag: t, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m, r: { sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med } });
  }
});
fs.writeFileSync(process.argv[2], JSON.stringify(out));
