/* dcaf, круг 1: фильтр обычного взноса. В день без сигнала (ни одно правило не сработало) — вместо покупки взноса копить его в резерв (act 0)
   или покупать половину (act 0,5) в «дорогих» режимах. Накопленное тратят штатные правила покупки (доля резерва) — больше резерв, больше покупка на дне.
   Правило-фильтр ставится последним (после эйфории), поэтому трогает только дни обычного взноса. Запуск: node dcaf_r1.js */
const L = require('./r4_lib.js'), { S0, c, P, G } = L;
const t0 = Date.now();
// доля дней обычного взноса
{ let n = 0, m = 0; for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) { const R = S0.rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])); for (let j = 0; j < X.n; j++) { m++; let hit = false; for (const r of R) if (r.conds.every((cd) => { const v = X.ind[cd.ind][j]; return cd.op === '<' ? v < cd.v : v > cd.v; })) { hit = true; break; } if (!hit) n++; } } console.log(`дней обычного взноса: ${(100 * n / m).toFixed(1)}%`); }
L.run('combo4', S0);
const F = (act, conds) => { const S = L.clone(); S.rules.push({ act, conds }); return S; };
const V = process.argv[2] || 'all';
if (V === 'all' || V === 'x') {
  L.run('крайность: никогда не взнос (act 0)', F(0, [c('age', '>', -1)]));
  L.run('крайность: всегда полвзноса (0,5)', F(0.5, [c('age', '>', -1)]));
}
console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} с]`);
