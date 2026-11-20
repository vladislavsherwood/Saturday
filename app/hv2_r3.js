/* hv2, круг 3: ранние продажи. Основная доля правила не меняется; добавка сверх combo5 — только на «первой слабости» (закрытие ниже максимума закрытий за N дней на k%):
   same — добавка только в день сигнала со слабостью; defer — добавка ждёт первой слабости ≤ W дн; half — половина сразу, половина на слабости.
   Пониженный порог пампа (копии) в режимах слабости срабатывает только в дни слабости. Мера — провалы добавочных продаж (×3 за год), по числу и по деньгам. */
const X = require('./hv2_lib.js'), { H } = X;
const base = { gf: X.ramp(100, 140), M: 2 };
const line = (nm, r, f) => console.log(`${nm.padEnd(34)} доход ${H.sg(r.all)} ${r.ok ? '✔' : '✗'} | БД ${H.sg(r.hvInc)} БД81 ${H.sg(r.hv81.m, 3)} (${r.hv81.u}/${r.hv81.d}) БД100н ${H.sg(r.nhv.m, 3)} (${r.nhv.u}/${r.nhv.d}) | 81 ${H.sg(r.m81.m, 3)} 100н ${H.sg(r.n.m, 3)} | PUMP ${r.pump.toFixed(0)} | провалы ${f.pc.toFixed(1)}% / ${f.pcUsd.toFixed(1)}% $ из ${f.n}${r.why ? ' | ' + r.why.slice(0, 60) : ''}`);
const go = (nm, o) => { const r = X.run('', o, { quiet: true }); line(nm, r, X.fails(r.V)); return r; };
go('hv (двоично T120, U200)', {});
for (const U of [250, 300]) {
  go(`U${U} сразу`, { ...base, U });
  for (const N of [5, 7, 10]) for (const k of [5, 10, 15]) go(`U${U} same N${N} k${k}`, { ...base, U, mode: 'same', N, k });
  for (const [N, k] of [[7, 5], [7, 10], [7, 15], [5, 10], [10, 10]]) go(`U${U} defer N${N} k${k} W30`, { ...base, U, mode: 'defer', N, k, W: 30 });
  for (const W of [14, 60]) go(`U${U} defer N7 k10 W${W}`, { ...base, U, mode: 'defer', N: 7, k: 10, W });
  for (const [N, k] of [[7, 10], [7, 5]]) go(`U${U} half N${N} k${k} W30`, { ...base, U, mode: 'half', N, k, W: 30 });
}
// для справки: провалы исходных правил тех же семей у combo5 (вся продажа; сдвиг 0)
{ let n = 0, bad = 0, usd = 0, bu = 0; for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const Y of X.G[g]) { const { tr } = X.P.edge(Y, H.S5, 0, 'full', true, H.polW);
    for (const t of tr) { if (t.s > 0 || !X.FAM(t.q)) continue; n++; usd += t.amt; let mx = 0; for (let q = t.i + 1; q < Math.min(Y.n, t.i + 366); q++) mx = Math.max(mx, Y.c[q]); if (mx >= 3 * t.p) { bad++; bu += t.amt; } } }
  console.log(`combo5, исходные правила тех же семей: продаж ${n}, провалов ${(100 * bad / n).toFixed(1)}% по числу, ${(100 * bu / usd).toFixed(1)}% по деньгам`); }
