/* gap: где combo4 упускает деньги. Диагностика по дневному состоянию (pol.trace), сдвиг исполнения 0, вся история, 81 монета (отбор, экзамен, 50 случ.) + 100 новых.
   1) простой кэша: доля резерва в капитале монеты (в среднем; на росте и на падении);
   2) крупные дна (минимум ±180 дн, падение > 60% от максимума 365 дн): доля капитала в кэше на дне и сколько резерва потрачено за 60 дн до и 30 после;
   3) крупные вершины (максимум ±180 дн, затем −60% за год): доля монеты в капитале на вершине, сколько позиции продано за 60 дн до и 30 после;
   4) перевес над DCA по годам: где стратегия теряет. Запуск: node gap_r1.js [wick] */
const L = require('./r4_lib.js'), { P, G } = L;
const S = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const W = process.argv[2] === 'wick';
const mkpol = () => ({ ...L.pol0, trace: [], ...(W ? { wick: { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' } } : {}) });
const UNIT = 10, FEE = 0.001;
const lists = ['sel', 'ex', 'rnd', 'n100'];
const med = (v) => { const a = v.filter(isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const mean = (v) => v.reduce((a, b) => a + b, 0) / v.length;
const cashUp = [], cashDn = [], cashAll = [], bottoms = [], tops = [], yrs = {};
for (const g of lists) for (const X of G[g]) {
  const pol = mkpol(); P.edge(X, S, 0, 'full', false, pol); const T = pol.trace, c = X.c, n = X.n;
  const V = T.map(([i, cash, u]) => cash + u * c[i]), cs = T.map(([i, cash, u], k) => cash / V[k]);
  // режим: монета выше / ниже своей 200д
  let su = 0, nu = 0, sd = 0, nd = 0; for (let k = 200; k < n; k++) { const x = X.ind.sma200[k]; if (x > 1) { su += cs[k]; nu++; } else if (x < 1) { sd += cs[k]; nd++; } }
  if (g !== 'n100') { cashAll.push(mean(cs.slice(60))); if (nu) cashUp.push(su / nu); if (nd) cashDn.push(sd / nd); }
  // DCA по дням
  let du = 0; const D = new Float64Array(n); for (let i = 0; i < n; i++) { du += (UNIT * (1 - FEE)) / c[i]; D[i] = du * c[i]; }
  // по годам: прирост ln(V/DCA) за год
  const y0 = (i) => +L.day(X.ind.t[i]).slice(0, 4); let prev = null;
  for (let i = 0; i < n; i++) { const y = y0(i), last = i === n - 1 || y0(i + 1) !== y; if (!last) continue; const e = Math.log(V[i] / D[i]); if (prev !== null && i > 120) (yrs[y] = yrs[y] || { all: [], seg: {} }).all.push(e - prev); prev = e; }
  // дна и вершины
  for (let i = 180; i < n - 30; i++) {
    let isMin = true, isMax = true; for (let k = Math.max(0, i - 180); k <= Math.min(n - 1, i + 180); k++) { if (c[k] < c[i]) isMin = false; if (c[k] > c[i]) isMax = false; if (!isMin && !isMax) break; }
    if (isMin) { let mx = 0; for (let k = Math.max(0, i - 365); k < i; k++) mx = Math.max(mx, c[k]); if (c[i] < mx * 0.4) {
      const a = Math.max(0, i - 60), b = Math.min(n - 1, i + 30), ca = T[a][1], cb = T[b][1], inflow = (b - a) * UNIT;
      bottoms.push({ g, nm: X.name, d: L.day(X.ind.t[i]), cashShare: cs[i], cashBefore: ca, spent: (ca + inflow - cb) / (ca + inflow), dd: 1 - c[i] / mx }); } }
    if (isMax) { let mn = Infinity; for (let k = i; k < Math.min(n, i + 365); k++) mn = Math.min(mn, c[k]); if (mn < c[i] * 0.4) {
      const a = Math.max(0, i - 60), b = Math.min(n - 1, i + 30); let maxU = 0; for (let k = a; k <= i; k++) maxU = Math.max(maxU, T[k][2]);
      tops.push({ g, nm: X.name, d: L.day(X.ind.t[i]), coinShare: 1 - cs[i], sold: 1 - T[b][2] / maxU }); } }
  }
}
const pc = (x) => (x * 100).toFixed(0) + '%';
console.log(`ОСНОВА: combo4 (57 правил)${W ? ' + фитили' : ''}`);
console.log(`1) доля кэша (резерва) в капитале монеты, медиана по 81 монете: в среднем ${pc(med(cashAll))}; когда монета выше 200д ${pc(med(cashUp))}; ниже 200д ${pc(med(cashDn))}`);
const B81 = bottoms.filter((b) => b.g !== 'n100'), T81 = tops.filter((t) => t.g !== 'n100');
console.log(`2) крупные дна (${bottoms.length}, из них 81 монета: ${B81.length}): кэш на дне — медиана ${pc(med(bottoms.map((b) => b.cashShare)))}; потрачено резерва за [−60; +30] дн — медиана ${pc(med(bottoms.map((b) => b.spent)))}`);
const missB = bottoms.filter((b) => b.spent < 0.25 && b.cashShare > 0.3);
console.log(`   «упущенные дна» (кэш > 30% капитала, потрачено < 25%): ${missB.length} из ${bottoms.length}`);
for (const b of missB.slice(0, 40)) console.log(`     ${b.d} ${b.nm.padEnd(9)} падение ${pc(b.dd)} кэш ${pc(b.cashShare)} потрачено ${pc(b.spent)}`);
console.log(`3) крупные вершины (${tops.length}): доля монеты в капитале на вершине — медиана ${pc(med(tops.map((t) => t.coinShare)))}; продано позиции за [−60; +30] дн — медиана ${pc(med(tops.map((t) => t.sold)))}`);
const missT = tops.filter((t) => t.sold < 0.2);
console.log(`   «упущенные вершины» (продано < 20%): ${missT.length} из ${tops.length}`);
for (const t of missT.slice(0, 40)) console.log(`     ${t.d} ${t.nm.padEnd(9)} доля монеты ${pc(t.coinShare)} продано ${pc(t.sold)}`);
console.log('4) перевес над DCA по годам (медиана прироста ln(капитал/DCA) за год по монетам; монет с потерей):');
for (const y of Object.keys(yrs).sort()) { const a = yrs[y].all; console.log(`   ${y}: ${(med(a) >= 0 ? '+' : '') + med(a).toFixed(3)}  монет ${a.length}, теряли ${a.filter((x) => x < -0.02).length}`); }
