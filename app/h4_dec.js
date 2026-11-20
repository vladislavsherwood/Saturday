/* h4: разложение годового прироста ln(капитал/DCA) на «наследство» и «действия года».
   B1 — пассивный двойник: состояние на начало года (кэш + монеты) держать без сделок, взносы года покупать как DCA.
   действия = ln(V_конец / B1_конец) — что дали сделки года против «ничего не делать»;
   наследство = прирост − действия (кэш на начале года при росте/падении цены и «разбавление»: стратегия впереди DCA, взносы одинаковые → отношение тянется к 1).
   Дополнительно B2: весь капитал на начало года в монете + DCA — сколько стоил кэш на начале года.
   Запуск: node h4_dec.js [nowick] [n100] */
const L = require('./r4_lib.js'), { P, G } = L;
const S = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const args = process.argv.slice(2), NW = args.includes('nowick'), N100 = args.includes('n100');
const lists = N100 ? ['n100'] : ['sel', 'ex', 'rnd'];
const med = (v) => { const a = v.filter(isFinite).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const mean = (v) => { const a = v.filter(isFinite); return a.reduce((x, y) => x + y, 0) / a.length; };
const Y = {};
function decomp(X, S_, pol) {
  const T = pol.trace, c = X.c, n = X.n, I = X.ind, o = {};
  let du = 0; const D = new Float64Array(n); for (let i = 0; i < n; i++) { du += (10 * 0.999) / c[i]; D[i] = du * c[i]; }
  const V = T.map(([i, cash, u]) => cash + u * c[i]);
  let a = 0; const yOf = (i) => +L.day(I.t[i]).slice(0, 4);
  while (a < n) {
    const y = yOf(a); let b = a; while (b + 1 < n && yOf(b + 1) === y) b++;
    if (a > 0 && b > 120) {
      let dy = 0; for (let i = a; i <= b; i++) dy += (10 * 0.999) / c[i];
      const cash0 = T[a - 1][1], u0 = T[a - 1][2], B1 = cash0 + (u0 + dy) * c[b], B2 = (cash0 / c[a - 1] + u0 + dy) * c[b];
      const tot = Math.log(V[b] / D[b]) - Math.log(V[a - 1] / D[a - 1]);
      o[y] = { tot, act: Math.log(V[b] / B1), inh: tot - Math.log(V[b] / B1), cashv: Math.log(B2 / B1), cs0: cash0 / V[a - 1], L0: Math.log(V[a - 1] / D[a - 1]) };
    }
    a = b + 1;
  }
  return o;
}
for (const g of lists) for (const X of G[g]) {
  const pol = { ...L.pol0, trace: [], ...(NW ? {} : { wick: { lv: [[0.25, 0.15], [0.4, 0.25], [0.6, 0.35]], age: 60, every: 3, once: 1, size: 'place' } }) };
  P.edge(X, S, 0, 'full', false, pol); const o = decomp(X, S, pol);
  for (const y in o) (Y[y] = Y[y] || []).push({ nm: X.name, ...o[y] });
}
const sg = (x) => (x >= 0 ? '+' : '') + x.toFixed(2);
console.log(`${lists.join('+')}, ${NW ? 'combo4' : 'combo4 + фитили'}, сдвиг 0. Медианы по монетам (в скобках — среднее):`);
console.log('год  монет | прирост (теряли) | действия года (теряли) | наследство | кэш на начало | цена кэша (B2/B1) | ln(V/DCA) на начало');
for (const y of Object.keys(Y).sort()) {
  const A = Y[y];
  console.log(`${y} ${String(A.length).padStart(4)} | ${sg(med(A.map((a) => a.tot)))} (${sg(mean(A.map((a) => a.tot)))}) ${A.filter((a) => a.tot < -0.02).length} | ${sg(med(A.map((a) => a.act)))} (${sg(mean(A.map((a) => a.act)))}) ${A.filter((a) => a.act < -0.02).length}`
    + ` | ${sg(med(A.map((a) => a.inh)))} | ${(100 * med(A.map((a) => a.cs0))).toFixed(0)}% | ${sg(med(A.map((a) => a.cashv)))} | ${sg(med(A.map((a) => a.L0)))}`);
}
module.exports = { decomp };
