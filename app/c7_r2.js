/* c7, круг 2: упрощение — копии правил заменить множителем‑политикой. (а) 64 правила + слои множителем; (б) 23 правила + сегменты и слои множителем.
   Критерий: доход к combo7 ≥ −0,005, строгая ✔, 100 новых не хуже; цель — ровно 0,000 (то же решение каждый день). Запуск: node c7_r2.js (лог scratchpad/c7/r2.txt) */
const C = require('./c7_lib.js'), { L, P } = C;
C.tee('r2');
console.log('мини:', C.mini.rules.length, 'правил');
C.mini.rules.forEach((r, k) => console.log(`  ${k + 1}. [${r.f}] ${r.act} ${r.conds.map((x) => x.ind + x.op + x.v).join(' & ')}`));
C.run('combo7 (133 правила)', C.S7);
C.run('ядро 64 + слои множителем', C.core, C.polM());
C.run('мини 23 + сегменты и слои множителем', C.mini, C.polM2());
// поштучная проверка: итог каждой монеты (все группы + 100 новых + монеты пользователя), сдвиги 0 и 1
let mx = 0, nm = ''; const G = L.G;
for (const g of ['sel', 'ex', 'rnd', 'n100', 'mine']) for (const X of G[g]) for (const lag of [0, 1]) for (const part of ['full', 'h1', 'h2']) {
  const a = P.edge(X, C.S7, lag, part, false, C.polW).e, b = P.edge(X, C.mini, lag, part, false, C.polM2()).e; const d = Math.abs(Math.log1p(a / 100) - Math.log1p(b / 100)); if (d > mx) { mx = d; nm = `${g}/${X.name}/${lag}/${part} ${a.toFixed(3)} vs ${b.toFixed(3)}`; } }
console.log('наибольшее расхождение лог‑итога монеты (мини против 133):', mx.toExponential(2), nm);
