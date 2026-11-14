/* Агент 4C, круг 0: эталон W25 и разбор — предсказывают ли признаки самой монеты в день покупки/продажи резерва, что будет дальше.
   Для каждой покупки резерва W25 (81 монета: отбор, экзамен, 50 случайных) — доходность монеты через 180 дней (только для оценки),
   средняя по деньгам в корзинах признака. Аналогично для продаж (ниже = продажа удачнее). Запуск: node app/agent4c_loop0.js */
const A = require('./agent4c_sim.js');
const G = A.groups(['sel', 'ex', 'rnd']);
const base = A.ev(G, A.W25);
console.log(A.HDR); console.log(A.row('W25', base, base));
const all = [...G.sel, ...G.ex, ...G.rnd], H = 180;
const T = [];
for (const X of all) { const r = A.edge(X, A.W25, 0, 'full', true); for (const t of r.tr) if (t.s === 1 || t.s === -1) { const k = Math.min(X.n - 1, t.i + H); if (t.i + 60 > X.n - 1) continue; T.push({ X, i: t.i, s: t.s, amt: t.amt, fwd: Math.log(X.c[k] / X.c[t.i]), fb: Math.log(X.ind.btcp[k] / X.ind.btcp[t.i]) }); } }
const F = { rel30: [-60, -30, -10, 10, 30, 1e9], rel90: [-70, -40, -10, 20, 60, 1e9], rdd365: [30, 50, 70, 85, 95, 101], ddm365: [30, 50, 70, 85, 95, 101], r7: [-30, -15, -5, 5, 1e9], sma200: [0.4, 0.6, 0.8, 1, 1.3, 1e9], pump365: [3, 5, 10, 30, 1e9], beta180: [0.8, 1, 1.2, 1.5, 1e9], vol180: [60, 90, 120, 160, 1e9], corr180: [0.4, 0.55, 0.7, 1.1], agei: [180, 365, 730, 1e9] };
for (const s of [1, -1]) {
  console.log(`\n=== ${s > 0 ? 'ПОКУПКИ резерва' : 'ПРОДАЖИ'}: доходность монеты через ${H} дн (по деньгам, лог→%), к BTC; доля денег`);
  const tot = T.filter((t) => t.s === s).reduce((a, t) => a + t.amt, 0);
  for (const f in F) {
    const ed = F[f]; let lo = -1e9; const parts = [];
    for (const hi of ed) { const B = T.filter((t) => t.s === s && t.X.ind[f][t.i] >= lo && t.X.ind[f][t.i] < hi); const w = B.reduce((a, t) => a + t.amt, 0); if (w > 0) { const m = B.reduce((a, t) => a + t.amt * t.fwd, 0) / w, mb = B.reduce((a, t) => a + t.amt * (t.fwd - t.fb), 0) / w; parts.push(`<${hi > 1e8 ? '∞' : hi}: ${(100 * Math.expm1(m)).toFixed(0)}%/${(100 * Math.expm1(mb)).toFixed(0)}% (${((100 * w) / tot).toFixed(0)}%)`); } lo = hi; }
    const na = T.filter((t) => t.s === s && isNaN(t.X.ind[f][t.i])).reduce((a, t) => a + t.amt, 0);
    console.log(`${f.padEnd(8)} ${parts.join(' | ')}${na ? ` | нет данных ${((100 * na) / tot).toFixed(0)}%` : ''}`);
  }
}
