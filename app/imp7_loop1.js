/* imp7, круг 1: разбор сделок основы (combo-best) по режимам рынка и циклам.
   Режимы (заданы заранее, по BTC): БЫК — BTC выше средней 200 и < 20% от максимума; МЕДВЕДЬ — ниже средней 200 и средняя 200 падает (наклон 30 дн < 0);
   ВОССТ — выше средней 200, но ≥ 40% ниже максимума (ранний восстановительный рост); БОК — остальное (коррекции/боковик).
   Для каждой сделки: доходность монеты через 90 и 180 дней после сделки (взвешено деньгами, лог), для покупок — цена к будущему 90-дн. минимуму.
   Запуск: node app/imp7_loop1.js */
const M = require('./imp7_sim.js');
const G = M.groups(['sel', 'ex', 'rnd']); M.prep(G);
const reg = (I, j) => { const b = I.rb200[j], a = I.rath[j], s = I.rsl[j]; if (isNaN(b)) return null; if (b > 1 && a < 20) return 'БЫК'; if (b < 1 && s < 0) return 'МЕДВЕДЬ'; if (b > 1 && a >= 40) return 'ВОССТ'; return 'БОК'; };
const cyc = (t) => (t < M.DAY('2018-01-01') ? null : t <= M.DAY('2019-12-31') ? 0 : t <= M.DAY('2022-12-31') ? 1 : 2);
const A = {};
for (const X of [...G.sel, ...G.ex, ...G.rnd]) {
  const tr = M.trades(X, M.B0), c = X.c;
  for (const x of tr) {
    if (Math.abs(x.s) !== 1) continue;
    const j = x.i - 1, rg = reg(X.ind, j), k = cyc(X.t[x.i]); if (!rg || k == null) continue;
    const kd = M.kind(x.rule), key = `${x.s > 0 ? 'B' : 'S'}:${kd}|${rg}`;
    const f90 = x.i + 90 < X.n ? Math.log(c[x.i + 90] / x.p) : NaN, f180 = x.i + 180 < X.n ? Math.log(c[x.i + 180] / x.p) : NaN;
    let mn = Infinity; for (let q = x.i; q < Math.min(X.n, x.i + 91); q++) mn = Math.min(mn, c[q]);
    const o = (A[key] = A[key] || [0, 1, 2].map(() => ({ w: 0, n: 0, f90: 0, w90: 0, f180: 0, w180: 0, ab: 0 })))[k];
    o.n++; o.w += x.amt; o.ab += x.amt * (x.p / mn - 1);
    if (!isNaN(f90)) { o.f90 += x.amt * f90; o.w90 += x.amt; }
    if (!isNaN(f180)) { o.f180 += x.amt * f180; o.w180 += x.amt; }
  }
}
const pct = (v) => ((Math.exp(v) - 1) * 100).toFixed(0).padStart(4);
console.log('сделка|режим: по циклам 2018–19 / 2020–22 / 2023–26 — n, доля денег, монета через 90 / 180 дн (%), покупки: выше будущего мин90 (%)');
const tot = [0, 1, 2].map((k) => Object.keys(A).filter((q) => q.startsWith('B')).reduce((s, q) => s + A[q][k].w, 0));
const tots = [0, 1, 2].map((k) => Object.keys(A).filter((q) => q.startsWith('S')).reduce((s, q) => s + A[q][k].w, 0));
for (const key of Object.keys(A).sort()) {
  const s = A[key].map((o, k) => o.n ? `${String(o.n).padStart(4)} ${(100 * o.w / (key[0] === 'B' ? tot[k] : tots[k])).toFixed(0).padStart(3)}% ${pct(o.f90 / o.w90)} ${pct(o.f180 / o.w180)}${key[0] === 'B' ? ' ' + (100 * o.ab / o.w).toFixed(0).padStart(3) : ''}` : '      —     ').join(' | ');
  console.log(key.padEnd(20), s);
}
