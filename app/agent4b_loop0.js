/* Агент 4B, круг 0: пересчёт W25, разбор продаж по правилам (доля денег, цена к максимуму ±90 дн), список пропущенных крупных вершин.
   Запуск: node app/agent4b_loop0.js */
const B = require('./agent4b_sim.js');
const t0 = Date.now();
const G = B.groups(), base = B.ev(G, B.W25), main = B.ev(G, B.MAIN);
console.log(B.HDR); console.log(B.show('основа', main, base)); console.log(B.show('W25', base, base));
console.log(B.fmtM(base.m)); console.log('время', (Date.now() - t0) / 1000);
const arr = [...G.sel, ...G.ex, ...G.rnd];
const sb = B.sellsByRule(arr, B.W25), tot = Object.values(sb).reduce((s, x) => s + x.amt, 0);
console.log('\nпродажи по правилам W25 (81 монета):');
for (const k in sb) { const r = B.W25.rules[k]; console.log(`  #${k} ${r.act} ${r.conds.map((x) => x.ind + x.op + x.v).join(' & ')}: денег ${(100 * sb[k].amt / tot).toFixed(0)}%, сделок ${sb[k].n}, к вершине ${(100 * sb[k].top / sb[k].amt).toFixed(0)}%`); }
const ms = B.missed(arr, B.W25); console.log(`\nпропущенные крупные вершины (${ms.length}):`); for (const m of ms) console.log(' ', JSON.stringify(m));
const ms2 = B.missed(G.n100, B.W25); console.log(`\n100 новых: пропущено ${ms2.length} из ${G.n100.reduce((s, X) => s + B.prepM(X).top.length, 0)}`);
