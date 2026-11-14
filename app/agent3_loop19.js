/* Агент 3, круг 19: итоговая проверка C4 по монетам и сохранение found/agent3-best.json.
   Гипотеза: выигрыш C4 не сосредоточен в одном периоде — он есть в обеих половинах истории и во всех группах (отбор, экзамен, 50 случайных,
   100 новых); метрики близости к дну/вершине не хуже W25. Плюс: как часто срабатывают усиленные продажи. Запуск: node app/agent3_loop19.js */
const A = require('./agent3_sim.js');
const fs = require('fs');
const G = A.groups(), w = A.ev(G, A.W25), r = A.ev(G, A.C4);
for (const [t, x] of [['W25', w], ['C4', r]]) {
  console.log(`\n== ${t}`);
  for (const [g, nm] of [['sel', 'отбор 17'], ['ex', 'экзамен 14'], ['rnd', '50 случайных'], ['n100', '100 новых']]) console.log(`  ${nm}: ${A.sh(x[g])}`);
  console.log(`  ${A.fmtM(x.m)}`);
}
console.log(`\nC4 к W25: строгая проверка ${A.passes(r, w) ? 'пройдена' : 'не пройдена — ' + A.why(r, w)}; доход ${A.d(r, w).toFixed(3)}`);
for (const g of ['sel', 'ex', 'rnd', 'n100']) { const [b, x] = A.bw(r, w, g); console.log(`  ${g}: лучше W25 на ${b}, хуже на ${x} из ${r[g].n}`); }
for (const part of ['h1', 'h2']) { const f = (S, g) => A.med(G[g].map((X) => A.E(X, S, part))); console.log(`  ${part === 'h1' ? '1-я' : '2-я'} половина истории, медиана W25 → C4: ` + ['sel', 'ex', 'rnd', 'n100'].map((g) => `${g} ${f(A.W25, g).toFixed(0)} → ${f(A.C4, g).toFixed(0)}`).join(', ')); }
// как часто срабатывают усиленные продажи (доля дней продаж, когда сработала копия с бетой) и сколько монет их видели
let up = 0, all = 0, coins = 0, n = 0;
for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of G[g]) { n++; const t = A.edge(X, A.C4, 0, 'full', true).tr.filter((q) => q.s < 0); const u = t.filter((q) => A.C4.rules[q.q].conds.some((cd) => cd.ind === 'beta180')).length; up += u; all += t.length; if (u) coins++; }
console.log(`  усиленные продажи: ${(100 * up / all).toFixed(1)}% дней продаж, у ${coins} из ${n} монет`);
fs.writeFileSync(__dirname + '/found/agent3-best.json', JSON.stringify(A.C4));
console.log('\nсохранено: app/found/agent3-best.json (' + A.C4.rules.length + ' правил)');
