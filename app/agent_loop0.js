/* Круг 0 (база): стратегия B и B с размерами лучшей схемы плеча — доход по группам и метрики близости к дну/вершине.
   Запуск: node app/agent_loop0.js */
const S = require('./agent_sim.js');
const B = S.B, set = (acts) => ({ ...B, rules: B.rules.map((r, i) => (acts[i] != null ? { ...r, act: acts[i] } : r)) });
const L = [['B (сейчас)', B], ['B с размерами схемы плеча (дно 25%, паника ×1,5, разворот 50%)', set({ 0: 1.25, 1: 1.25, 2: 1.375, 3: 1.75, 6: 1.75, 5: 1.5, 9: 1.5 })]];
const G = S.groups(['sel', 'ex', 'rnd', 'n100']);
for (const [t, St] of L) {
  const r = S.evalAll(G, St, true);
  console.log(`${t}\n  отбор: ${S.sh(r.sel)}\n  экзамен: ${S.sh(r.ex)}\n  50 случайных: ${S.sh(r.rnd)}\n  100 новых: ${S.sh(r.n100)}\n  ${S.fmtM(r.m)}\n`);
}
// какие правила дают покупки резерва в зоне дна, а какие — далеко от дна
const A = [...G.sel, ...G.ex, ...G.rnd], agg = {};
for (const X of A) { const { tr } = S.edge(X, B, 0, 'full', true); const n = X.n, c = X.c;
  for (const t of tr) { let mf = Infinity; for (let j = t.i; j <= Math.min(n - 1, t.i + 90); j++) mf = Math.min(mf, c[j]); let mw = Infinity, mx = 0; for (let j = Math.max(0, t.i - 180); j <= Math.min(n - 1, t.i + 180); j++) mw = Math.min(mw, c[j]); for (let j = Math.max(0, t.i - 90); j <= Math.min(n - 1, t.i + 90); j++) mx = Math.max(mx, c[j]);
    const g = (agg[t.q] = agg[t.q] || { n: 0, amt: 0, above: 0, zone: 0, top: 0 }); g.n++; g.amt += t.amt; if (t.s > 0) { g.above += t.amt * (t.p / mf - 1); if (t.p <= 1.15 * mw) g.zone += t.amt; } else g.top += t.amt * t.p / mx; } }
console.log('по правилам B (сделок, доля денег, выше 90-дн. минимума / в зоне дна или цена к вершине):');
const tot = { b: 0, s: 0 }; for (const q in agg) (B.rules[q].act > 0 ? (tot.b += agg[q].amt) : (tot.s += agg[q].amt));
for (const q in agg) { const g = agg[q], r = B.rules[q]; console.log(`  #${q} ${r.conds.map((x) => x.ind + x.op + x.v).join(' & ')} → ${r.act}: сделок ${g.n}, доля ${(100 * g.amt / (r.act > 0 ? tot.b : tot.s)).toFixed(0)}%, ` + (r.act > 0 ? `выше мин. ${(100 * g.above / g.amt).toFixed(0)}%, в зоне дна ${(100 * g.zone / g.amt).toFixed(0)}%` : `цена к вершине ${(100 * g.top / g.amt).toFixed(0)}%`)); }
