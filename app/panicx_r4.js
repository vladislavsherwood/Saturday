/* Круг 4: разворот usdt вниз от пика → доля паники × m. Пик — в эпизоде (pupk) или скользящий за N дней (upkN = usdt / max usdt за N дней, проще вживую).
   Сетка порога и множителя, плато; разбор, какие монеты/половины портят строгую. Запуск: node panicx_r4.js [diag] */
const P = require('./panicx_sim.js'), { c } = P.Z;
const G = P.load();
for (const g in G) for (const X of G[g]) for (const N of [10, 20, 30]) {
  const u = X.ind.usdt, a = new Float64Array(X.n);
  for (let i = 0; i < X.n; i++) { let m = -Infinity; for (let k = Math.max(0, i - N + 1); k <= i; k++) if (u[k] > m) m = u[k]; a[i] = u[i] / m; }
  X.ind['upk' + N] = a;
}
const sc = (r, k) => +(1 + Math.min(1, (r.act - 1) * k)).toFixed(6);
const V = (ind, v, m, only) => P.mapP((r) => (!only || only(r) ? [{ act: sc(r, m), conds: [...r.conds, c(ind, '<', v)] }, r] : [r]));
const diag = (R) => { const { BR } = P.baseline(); for (const g of ['sel', 'ex', 'rnd']) R[g].forEach((x, i) => { const y = BR[g][i]; const w = ['f', 'h1', 'h2'].filter((k) => (y[k] > 0 && x[k] <= 0) || x[k] < y[k] - 5); if (w.length) console.log('   ', g, x.name, x.seg, w.map((k) => `${k} ${y[k].toFixed(1)}→${x[k].toFixed(1)}`).join(' ')); }); };
if (process.argv[2] === 'diag') { const r = P.report('pupk<0.97 ×2', V('pupk', 0.97, 2), null); diag(r.R); const r2 = P.report('upk20<0.97 ×2', V('upk20', 0.97, 2), null); diag(r2.R); return; }
P.report('основа', P.base, null);
for (const ind of ['pupk', 'upk10', 'upk20', 'upk30']) for (const v of [0.96, 0.97, 0.98]) for (const m of [1.5, 2, 3]) P.report(`${ind}<${v} ×${m}`, V(ind, v, m), null);
// фильтры: к каким правилам паники добавлять копию
if (process.argv[2] === 'only') {
  const has = (r, k) => r.conds.some((x) => x.ind === k);
  const F = { страх: (r) => has(r, 'fng'), безстраха: (r) => !has(r, 'fng'), OI: (r) => has(r, 'oidd30'), безOI: (r) => !has(r, 'oidd30'), '10%': (r) => Math.abs(r.act - 1.1) < 1e-9, сильная: (r) => r.conds.filter((x) => x.ind === 'usdt').length === 2, несильная: (r) => r.conds.filter((x) => x.ind === 'usdt').length === 1 };
  for (const [ind, v] of [['pupk', 0.97], ['upk10', 0.97]]) for (const fn in F) for (const m of [2, 3]) P.report(`${ind}<${v} ×${m} ${fn}`, V(ind, v, m, F[fn]), null);
  // разворот usdt и монета ниже старта эпизода
  for (const m of [2, 3]) P.report(`pupk<0.97&pdrop>0 ×${m}`, P.mapP((r) => [{ act: sc(r, m), conds: [...r.conds, c('pupk', '<', 0.97), c('pdrop', '>', 0)] }, r]), null);
}
