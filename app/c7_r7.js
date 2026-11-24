/* c7, круг 7: где слои combo7 проигрывают — по годам (2023: combo7 хуже combo6 у 70 из 77 монет, круг 1). Для каждого слоя: среднее по монетам прироста
   ln(капитал combo7 / капитал без слоя) за календарный год (сдвиг 0, 81 + 100 новых), лучше/хуже. Затем — попытка убрать проигрыш режимом.
   Запуск: node c7_r7.js [diag|fix] (лог scratchpad/c7/r7_<режим>.txt) */
const C = require('./c7_lib.js'), { L, P } = C;
const mode = process.argv[2] || 'diag';
C.tee('r7_' + mode);
const med = (v) => { const a = v.filter(isFinite).sort((x, y) => x - y); return a.length ? a[a.length >> 1] : NaN; };
if (mode === 'diag') {
  const VAR = { 'К1': { k1: 0 }, 'К4': { k4: 0 }, 'К-V': { kv: 0 }, 'К-D': { kd: 0 }, 'hv2 (множ.)': { hv: 0 } };
  const cap = (X, pol) => { const p = { ...pol, trace: [] }; P.edge(X, C.mini, 0, 'full', false, p); return p.trace.map(([i, cash, u]) => cash + u * X.c[i]); };
  const yrs = {};
  for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of L.G[g]) {
    const V = cap(X, C.polM2()); const y0 = (i) => +L.day(X.ind.t[i]).slice(0, 4);
    for (const [nm, o] of Object.entries(VAR)) { const W = cap(X, C.polM2(o)); let prev = 0;
      for (let i = 0; i < X.n; i++) { if (!(i === X.n - 1 || y0(i + 1) !== y0(i))) continue; const e = Math.log(V[i] / W[i]); const k = nm + '|' + y0(i); (yrs[k] = yrs[k] || []).push(e - prev); prev = e; } }
  }
  const Y = [...new Set(Object.keys(yrs).map((k) => k.split('|')[1]))].sort();
  console.log('вклад слоя по годам: среднее по монетам Δ ln(капитал с слоем / без) за год (лучше/хуже > ±0,01); Σ среднего'.padEnd(10));
  for (const nm of Object.keys(VAR)) console.log(nm.padEnd(12) + Y.map((y) => { const a = yrs[nm + '|' + y] || []; const s = a.reduce((p, q) => p + q, 0) / (a.length || 1); return `${y}: ${C.sg(s)} (${a.filter((x) => x > 0.01).length}/${a.filter((x) => x < -0.01).length})`; }).join('  '));
}
if (mode === 'fix') {
  // К4 (золото +3% за 30 дн и страх → продажи ×1,5) проигрывает в 2023 (6/72): золото росло вместе с BTC (банковский кризис 03.2023).
  // Гипотеза: «бегство в золото» — это когда BTC при этом отстаёт от золота / падает; доп. условие к К4.
  const K4 = (pred) => C.polM2({ k4: 0, extra: (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j; return f === 'fear' && I.au_r30[j] > 3 && I.age[j] > 365 && pred(I, j) ? C.sellAct(a, 1.5) : a; } });
  C.run('К4 как есть (контроль = combo7)', C.mini, K4(() => true));
  for (const v of [0, 10, 20]) C.run(`К4 и BTC/золото за 30 дн < ${v}%`, C.mini, K4((I, j) => I.bg_r30[j] < v));
  for (const v of [0, 10]) C.run(`К4 и BTC за 30 дн < ${v}%`, C.mini, K4((I, j) => I.btcr30[j] < v));
  for (const v of [1, 1.1]) C.run(`К4 и BTC / SMA200 < ${v}`, C.mini, K4((I, j) => I.btc200[j] < v));
  for (const v of [0.1, 0.3]) C.run(`К4 и корр. BTC–золото 30 дн < ${v}`, C.mini, K4((I, j) => I.au_c30[j] < v));
  for (const v of [-0.5, -1]) C.run(`К4 и ставка 90д > ${v} (не при снижении ставок)`, C.mini, K4((I, j) => I.c7_tnx90[j] > v));
  for (const v of [-2, -4]) C.run(`К4 и DXY 90д > ${v}%`, C.mini, K4((I, j) => I.c7_dxy90[j] > v));
}
