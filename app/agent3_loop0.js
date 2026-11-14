/* Агент 3, круг 0: пересчёт W25 (found/agent2-best.json) против основы (found/main-crypto.json): отбор, экзамен, 50 случайных, 100 новых,
   метрики близости к дну и вершине. Запуск: node app/agent3_loop0.js */
const A = require('./agent3_sim.js');
const t0 = Date.now();
const G = A.groups(), base = A.ev(G, A.MAIN), w = A.ev(G, A.W25);
console.log(`загрузка и две оценки: ${((Date.now() - t0) / 1000).toFixed(0)} с`);
for (const [t, r] of [['основа', base], ['W25', w]]) {
  console.log(`\n== ${t}`);
  for (const [g, nm] of [['sel', 'отбор 17'], ['ex', 'экзамен 14'], ['rnd', '50 случайных'], ['n100', '100 новых']]) console.log(`  ${nm}: ${A.sh(r[g])}`);
  console.log(`  ${A.fmtM(r.m)}`);
}
console.log(`\nW25 к основе: строгая проверка ${A.passes(w, base) ? 'пройдена' : 'не пройдена — ' + A.why(w, base)}; доход ${A.d(w, base).toFixed(3)}`);
for (const g of ['sel', 'ex', 'rnd', 'n100']) { const [b, x] = A.bw(w, base, g); console.log(`  ${g}: лучше основы на ${b}, хуже на ${x}`); }
console.log('\n' + A.HDR); console.log(A.show('основа', base, w)); console.log(A.show('W25', w, w));
