/* h4: помесячный прирост ln(капитал/DCA) (медиана по монетам) и средняя доля кэша, для лет из аргументов; основа combo4 + фитили (nowick — без).
   Плюс разложение прироста месяца: «кэш» = вклад от доли кэша при росте цены (−кэш × ln(рост цены)), остальное — сделки.
   Запуск: node h4_month.js 2019 2020 2023 [nowick] [n100] */
const L = require('./r4_lib.js'), { P, G } = L;
const S = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const args = process.argv.slice(2), NW = args.includes('nowick'), N100 = args.includes('n100'), YS = args.filter((a) => /^\d{4}$/.test(a));
const lists = N100 ? ['n100'] : ['sel', 'ex', 'rnd'];
const med = (v) => { const a = v.filter(isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const M = {};
for (const g of lists) for (const X of G[g]) {
  const pol = { ...L.pol0, trace: [], ...(NW ? {} : { wick: { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' } }) };
  P.edge(X, S, 0, 'full', false, pol); const T = pol.trace, c = X.c, n = X.n, I = X.ind;
  let du = 0; const D = new Float64Array(n); for (let i = 0; i < n; i++) { du += (10 * 0.999) / c[i]; D[i] = du * c[i]; }
  const V = T.map(([i, cash, u]) => cash + u * c[i]);
  let prev = -1;
  for (let i = 0; i < n; i++) {
    const m = L.day(I.t[i]).slice(0, 7), last = i === n - 1 || L.day(I.t[i + 1]).slice(0, 7) !== m;
    if (!last) continue;
    if (prev >= 0 && i > 120 && YS.includes(m.slice(0, 4))) {
      let cs = 0; for (let k = prev + 1; k <= i; k++) cs += T[k - 1][1] / V[k - 1] * Math.log(c[k] / c[k - 1]);
      (M[m] = M[m] || []).push({ d: Math.log(V[i] / D[i]) - Math.log(V[prev] / D[prev]), cs: T[i][1] / V[i], cd: -cs, pr: Math.log(c[i] / c[prev]), nm: X.name });
    }
    prev = i;
  }
}
const sg = (x) => (x >= 0 ? '+' : '') + x.toFixed(3);
console.log(`помесячно (${lists.join('+')}, ${NW ? 'combo4' : 'combo4 + фитили'}): медиана прироста ln(V/DCA) | теряли | кэш на конец (медиана) | «вклад кэша» −Σ кэш×ln рост (медиана) | ln рост цены (медиана) | монет`);
for (const m of Object.keys(M).sort()) { const A = M[m]; console.log(`${m} ${sg(med(A.map((a) => a.d)))} ${String(A.filter((a) => a.d < -0.01).length).padStart(3)} кэш ${(100 * med(A.map((a) => a.cs))).toFixed(0).padStart(3)}% вклад кэша ${sg(med(A.map((a) => a.cd)))} цена ${sg(med(A.map((a) => a.pr)))} ${A.length}`); }
