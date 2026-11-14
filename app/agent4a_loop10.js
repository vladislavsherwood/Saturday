/* Агент 4A, круг 10 (по монетам): итог по монетам — W25 против единственной правки, прошедшей строгую проверку
   (C6: сильная паника usdt > 1,2 → доля #3,5,9 ×1,5), на отборе/экзамене/50 случайных/100 новых, половины, метрики дна.
   Сохраняет found/agent4a-best.json: правила по монетам = W25 (ни одна правка не прошла заранее заданный критерий; новое — схема маржи).
   Запуск: node app/agent4a_loop10.js */
const A = require('./agent4a_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.W25), R = A.W25.rules;
const C6 = { ...A.W25, rules: R.flatMap((r, q) => (![3, 5, 9].includes(q) ? [r] : [{ act: 1 + (r.act - 1) * 1.5, conds: [...r.conds, A.c('usdt', '>', 1.2)] }, r])) };
const w = A.ev(G, C6);
for (const [t, r] of [['W25', base], ['C6', w]]) {
  console.log(`\n== ${t}`);
  for (const [g, nm] of [['sel', 'отбор 17'], ['ex', 'экзамен 14'], ['rnd', '50 случайных'], ['n100', '100 новых']]) console.log(`  ${nm}: ${A.sh(r[g])}`);
  console.log(`  ${A.fmtM(r.m)}`);
}
console.log(`\nC6: строгая проверка ${A.passes(w, base) ? 'пройдена' : 'не пройдена — ' + A.why(w, base)}; доход ${A.d(w, base).toFixed(3)}`);
for (const g of ['sel', 'ex', 'rnd', 'n100']) console.log(`  ${g}: лучше W25 на ${A.bw(w, base, g)[0]}, хуже на ${A.bw(w, base, g)[1]} из ${w[g].n}`);
for (const part of ['h1', 'h2']) { const f = (S, g) => A.med(G[g].map((X) => A.E(X, S, part))); console.log(`  ${part === 'h1' ? '1-я' : '2-я'} половина, медиана: отбор ${f(A.W25, 'sel').toFixed(0)} → ${f(C6, 'sel').toFixed(0)}, экзамен ${f(A.W25, 'ex').toFixed(0)} → ${f(C6, 'ex').toFixed(0)}, 50 случ. ${f(A.W25, 'rnd').toFixed(0)} → ${f(C6, 'rnd').toFixed(0)}, 100 новых ${f(A.W25, 'n100').toFixed(0)} → ${f(C6, 'n100').toFixed(0)}`); }
fs.writeFileSync(__dirname + '/found/agent4a-best.json', JSON.stringify(A.W25));
console.log('\nсохранено: app/found/agent4a-best.json (= W25)');
