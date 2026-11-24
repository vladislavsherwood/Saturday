/* au, круг 3: «металлы падают → покупать крипту». Правило покупки (взнос + f резерва), если золото −X% за 30 дн / серебро −X% / серебро хуже золота.
   Варианты места: 'end' — только в дни без сигнала combo6; 9 — после правил паники (перекрывает охрану и продажи); 'boost' — копии правил паники 0–8 с ×m доли.
   Фильтр по BTC (btc200 < 1) — по клеткам круга 2. Запуск: node au_r3.js > scratchpad/au/r3.txt */
const A = require('./au_lib.js'), { c, S6 } = A;
const rows = [];
const R = (nm, S) => { const r = A.run(nm, S); rows.push([nm, r]); return r; };
console.log('вариант'.padEnd(46), 'отбор/экз/50сл | доход к combo6 всё к а м строгая | 100 новых | половины | ср. лог 81');
R('combo6', S6);
const SIG = {
  au: (x) => [c('au_r30', '<', -x)],
  ag: (x) => [c('ag_r30', '<', -x)],
  sg: (x) => [c('agau30', '<', -x)],
};
A.L.addInd('agau30', (X) => Float64Array.from(X.ind.ag_r30, (v, i) => v - X.ind.au_r30[i]));
const TH = { au: [4, 5, 6], ag: [8, 10, 12], sg: [6, 8, 10] };
for (const k of ['au', 'ag', 'sg']) for (const x of TH[k]) for (const f of [0.05, 0.1, 0.2]) {
  R(`${k} ${x} end f${f}`, A.ins([{ act: 1 + f, conds: SIG[k](x) }], S6.rules.length));
  if (f === 0.1) {
    R(`${k} ${x} end f${f} btc<200`, A.ins([{ act: 1 + f, conds: [...SIG[k](x), c('btc200', '<', 1)] }], S6.rules.length));
    R(`${k} ${x} @9 f${f}`, A.ins([{ act: 1 + f, conds: SIG[k](x) }], 9));
    R(`${k} ${x} @9 f${f} btc<200`, A.ins([{ act: 1 + f, conds: [...SIG[k](x), c('btc200', '<', 1)] }], 9));
    // усиление паники: копии правил 0–8 с долей ×1,5
    R(`${k} ${x} boost паники ×1,5`, A.preMod(S6, (r, q) => q <= 8, (r) => ({ act: 1 + (r.act - 1) * 1.5, conds: [...r.conds, ...SIG[k](x)] })));
  }
}
const ok = rows.filter(([, r]) => !r.w && r.dseg.all > 0 && r.n100 && r.n100.m > 0 && r.n100.u > r.n100.d && r.hv.h1 > -0.005 && r.hv.h2 > -0.005);
console.log('\nпрошли критерий 1, 2, 4:', ok.map(([nm, r]) => `${nm} ${A.sg(r.dseg.all)}`).join('; ') || 'нет');
