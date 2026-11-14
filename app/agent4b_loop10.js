/* Агент 4B, круг 10 (по монетам): финальная сводка кандидата F против W25 и основы на всех группах, метрики дна/вершин,
   продажи по правилам, пропущенные вершины, половины истории, лучше/хуже по монетам; сохраняет found/agent4b-best.json.
   Гипотеза круга: F устойчиво лучше W25 на всех группах и на 100 новых, продаёт ближе к вершине и пропускает меньше вершин.
   Запуск: node app/agent4b_loop10.js */
const B = require('./agent4b_sim.js'), K = require('./agent4b_cand.js');
const fs = require('fs');
const { c } = B;
const G = B.groups(); K.prep(G);
const F = B.ins(K.R(0.5, 0.1, 45), [{ act: -0.1, conds: [c('btcath', '>', 20), c('up90', '>', 300)] }]);
const main = B.ev(G, B.MAIN), base = B.ev(G, B.W25), f = B.ev(G, F);
for (const [t, r] of [['основа', main], ['W25', base], ['F', f]]) {
  console.log(`\n== ${t}`);
  for (const [g, nm] of [['sel', 'отбор 17'], ['ex', 'экзамен 14'], ['rnd', '50 случайных'], ['n100', '100 новых']]) console.log(`  ${nm}: ${B.sh(r[g])}`);
  console.log(`  ${B.fmtM(r.m)}`);
}
console.log(`\nF к W25: строгая ${B.passes(f, base) ? '✔' : B.why(f, base)}; доход ${B.d(f, base).toFixed(3)}`);
console.log(`F к основе: строгая ${B.passes(f, main) ? '✔' : B.why(f, main)}; доход ${B.d(f, main).toFixed(3)}`);
for (const g of ['sel', 'ex', 'rnd', 'n100']) console.log(`  ${g}: лучше W25 на ${B.bw(f, base, g)[0]}, хуже на ${B.bw(f, base, g)[1]} из ${f[g].n}`);
for (const part of ['h1', 'h2']) { const m = (S, g) => B.med(G[g].map((X) => B.E(X, S, part))).toFixed(0); console.log(`  ${part === 'h1' ? '1-я' : '2-я'} половина, медиана W25 → F: отбор ${m(B.W25, 'sel')} → ${m(F, 'sel')}, экзамен ${m(B.W25, 'ex')} → ${m(F, 'ex')}, 50 случ. ${m(B.W25, 'rnd')} → ${m(F, 'rnd')}, 100 новых ${m(B.W25, 'n100')} → ${m(F, 'n100')}`); }
const arr = [...G.sel, ...G.ex, ...G.rnd];
const sb = B.sellsByRule(arr, F), tot = Object.values(sb).reduce((s, x) => s + x.amt, 0);
console.log('\nпродажи F по правилам (81 монета):');
for (const k in sb) { const r = F.rules[k]; console.log(`  #${k} ${r.act} ${r.conds.map((x) => x.ind + x.op + x.v).join(' & ')}: денег ${(100 * sb[k].amt / tot).toFixed(0)}%, сделок ${sb[k].n}, к вершине ${(100 * sb[k].top / sb[k].amt).toFixed(0)}%`); }
const mw = B.missed(arr, B.W25), mf = B.missed(arr, F), key = (m) => m.coin + m.d;
console.log(`\nпропущенные вершины: W25 ${mw.length}, F ${mf.length}; исправлены: ${mw.filter((m) => !mf.some((x) => key(x) === key(m))).map(key).join(', ')}; новые: ${mf.filter((m) => !mw.some((x) => key(x) === key(m))).map(key).join(', ')}`);
console.log(`100 новых: пропущено W25 ${B.missed(G.n100, B.W25).length}, F ${B.missed(G.n100, F).length}`);
fs.writeFileSync(__dirname + '/found/agent4b-best.json', JSON.stringify(F));
console.log('\nсохранено: app/found/agent4b-best.json');
