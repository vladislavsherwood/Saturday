/* Агент 2, круг 10 (по монетам): финальная сводка W25 против основы на всех группах + метрики близости к дну и вершине;
   сохраняет лучший вариант в found/agent2-best.json. Запуск: node app/agent2_loop10.js <кандидаты.json> */
const A = require('./agent2_sim.js');
const fs = require('fs');
const C = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')), names = Object.keys(C);
const G = A.groups(), base = A.ev(G, A.MAIN);
const W = C[names[1]], w = A.ev(G, W);
for (const [t, r] of [['основа', base], [names[1], w]]) {
  console.log(`\n== ${t}`);
  for (const [g, nm] of [['sel', 'отбор 17'], ['ex', 'экзамен 14'], ['rnd', '50 случайных'], ['n100', '100 новых']]) console.log(`  ${nm}: ${A.sh(r[g])}`);
  console.log(`  ${A.fmtM(r.m)}`);
}
console.log(`\nстрогая проверка: ${A.passes(w, base) ? 'пройдена' : 'не пройдена — ' + A.why(w, base)}; доход ${A.d(w, base).toFixed(3)}`);
for (const g of ['sel', 'ex', 'rnd', 'n100']) console.log(`  ${g}: лучше основы на ${w[g].e.filter((v, i) => v > base[g].e[i] + 0.5).length}, хуже на ${w[g].e.filter((v, i) => v < base[g].e[i] - 0.5).length} из ${w[g].n}`);
// половины истории отдельно (медианы)
for (const part of ['h1', 'h2']) { const f = (S, g) => A.med(G[g].map((X) => A.E(X, S, part))); console.log(`  ${part === 'h1' ? '1-я' : '2-я'} половина, медиана: отбор ${f(A.MAIN, 'sel').toFixed(0)} → ${f(W, 'sel').toFixed(0)}, экзамен ${f(A.MAIN, 'ex').toFixed(0)} → ${f(W, 'ex').toFixed(0)}, 50 случ. ${f(A.MAIN, 'rnd').toFixed(0)} → ${f(W, 'rnd').toFixed(0)}, 100 новых ${f(A.MAIN, 'n100').toFixed(0)} → ${f(W, 'n100').toFixed(0)}`); }
fs.writeFileSync(__dirname + '/found/agent2-best.json', JSON.stringify(W));
console.log('\nсохранено: app/found/agent2-best.json');
