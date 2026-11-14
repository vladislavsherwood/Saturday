/* Агент 3, круг 4б: карта плато для «бета180 > b и монета слабая → все продажи ×k»: слабость — pair (монета/BTC к своей средней 200) < x
   или монета к своей средней 200 < x; b 1,0…1,4, k 1,25…2, x 0,95/1/1,05. Запуск: node app/agent3_loop4b.js <out.json> > log */
const A = require('./agent3_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.W25), out = [];
for (const ind of ['pair', 'sma200']) for (const x of [0.95, 1.0, 1.05]) for (const b of [1.0, 1.1, 1.2, 1.3, 1.4]) for (const k of [1.25, 1.5, 1.75, 2]) {
  const S = A.scaleC(A.W25, [A.c('beta180', '>', b), A.c(ind, '<', x)], 1, k, (r) => r.act < 0), r = A.ev(G, S, false);
  out.push({ ind, x, b, k, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100') });
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
for (const ind of ['pair', 'sma200']) for (const x of [0.95, 1.0, 1.05]) {
  console.log(`\n${ind} < ${x}: строки — порог беты, столбцы — множитель 1,25 / 1,5 / 1,75 / 2 (доход, ✔ — строгая проверка, 100 новых)`);
  for (const b of [1.0, 1.1, 1.2, 1.3, 1.4]) console.log(`  бета > ${b}: ` + out.filter((o) => o.ind === ind && o.x === x && o.b === b).map((o) => `${o.d >= 0 ? '+' : ''}${o.d.toFixed(2)}${o.pass ? '✔' : '·'} ${o.n100.toFixed(0)}`).join(' | '));
}
