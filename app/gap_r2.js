/* gap, разбор лет: какой семье правил обязаны провалы 2019, 2023, 2026 (и успехи 2018, 2022) — убрать семью и посмотреть прирост ln(капитал/DCA) по годам.
   81 монета, сдвиг 0. Запуск: node gap_r2.js */
const L = require('./r4_lib.js'), { P, G } = L;
const S0 = { ...L.clone(), rules: require('./found/combo4-best.json').rules.map((r) => JSON.parse(JSON.stringify(r))) };
const R = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const FAM = [['капитуляция 1', [1]], ['покупки после выноса/ликвидаций 2–3', [2, 3]], ['паника в стейблах 4–9', R(4, 9)], ['охрана 10', [10]], ['сильный страх → продать 11–18', R(11, 18)],
  ['страх → продать 19–26', R(19, 26)], ['разворот BTC 27', [27]], ['фандинг 28–30', R(28, 30)], ['тихие вершины 31–50', R(31, 50)], ['возврат 51', [51]], ['памп 52–54', R(52, 54)], ['альтсезон 55', [55]], ['эйфория 56–57', [56, 57]]];
const UNIT = 10, FEE = 0.001, YS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
function years(S) {
  const out = {}; for (const y of YS) out[y] = [];
  for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) {
    const pol = { ...L.pol0, trace: [] }; P.edge(X, S, 0, 'full', false, pol); const T = pol.trace, c = X.c, n = X.n; let du = 0, prev = null;
    for (let i = 0; i < n; i++) { du += (UNIT * (1 - FEE)) / c[i]; const y = +L.day(X.ind.t[i]).slice(0, 4), last = i === n - 1 || +L.day(X.ind.t[i + 1]).slice(0, 4) !== y; if (!last) continue;
      const e = Math.log((T[i][1] + T[i][2] * c[i]) / (du * c[i])); if (prev !== null && i > 120 && out[y]) out[y].push([X.name, e - prev]); prev = e; }
  }
  return out;
}
const med = (v) => { const a = v.slice().sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : NaN; };
const B = years(S0);
const sg = (x) => (x >= 0 ? '+' : '') + x.toFixed(2);
console.log('медиана прироста ln(капитал/DCA) за год; ниже — изменение медианы, если убрать семью (+ значит семья в этот год мешала)');
console.log('год'.padEnd(36) + YS.map((y) => String(y).padStart(7)).join(''));
console.log('combo4'.padEnd(36) + YS.map((y) => sg(med(B[y].map((x) => x[1]))).padStart(7)).join(''));
for (const [nm, ids] of FAM) {
  const S = L.clone(S0); S.rules = S.rules.filter((_, i) => !ids.includes(i + 1)); const Y = years(S);
  console.log(('без: ' + nm).padEnd(36) + YS.map((y) => { const m = new Map(B[y]); return sg(med(Y[y].map(([k, v]) => v - m.get(k)))).padStart(7); }).join(''));
}
