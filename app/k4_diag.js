/* Разбор К4 (страх в крипте + золото за 30 дн > +3% → продажи на страхе ×1,5): по месяцам, когда срабатывал, что было на рынке и что стало с BTC потом.
   Основа — текущий черновик combo7 (C7_BASE=combo7-draft.json). Запуск: C7_BASE=combo7-draft.json node k4_diag.js (лог scratchpad/c7/k4_diag.txt) */
const C = require('./c7_lib.js'), { L } = C;
C.tee('k4_diag');
const hits = {}; // месяц → { n, coins:Set }
const rec = (ctx, f, a) => {
  const I = ctx.X.ind, j = ctx.j;
  if (f === 'fear' && I.au_r30[j] > 3 && I.age[j] > 365 && a < 0) {
    const m = L.day(I.t[j]).slice(0, 7); const h = (hits[m] = hits[m] || { n: 0, coins: new Set(), days: new Set() }); h.n++; h.coins.add(ctx.X.name || ctx.X.sym); h.days.add(L.day(I.t[j]));
  }
  return a;
};
const pol = C.polM2({ extra: rec });
for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of L.G[g]) C.P.edge(X, C.mini, 0, 'full', false, pol);
const B = C.BY['BTC'], I = B.ind, idx = new Map(Array.from(I.t, (t, i) => [L.day(t), i]));
const f1 = (x, d = 1) => (isFinite(x) ? x.toFixed(d) : '—');
console.log('месяц | монето-дней | дней | BTC: от рекорда %, к SMA200, за 30д %, MVRV | золото 30д %, корр. BTC–золото 30д | DXY 30д %, 10-летние 30д п.п. | страх, доля USDT | BTC через 30/90/180 дн %');
for (const m of Object.keys(hits).sort()) {
  const h = hits[m]; const ds = [...h.days].sort(); const d = ds[Math.floor(ds.length / 2)]; const i = idx.get(d); if (i === undefined) continue;
  const fw = (k) => (i + k < B.n ? (B.c[i + k] / B.c[i] - 1) * 100 : NaN);
  console.log(`${m} | ${h.n} | ${ds.length} | ${f1((B.c[i] / I.ath[i] - 1) * 100, 0)}, ${f1(I.btc200[i], 2)}, ${f1(I.btcr30[i], 0)}, ${f1(I.mvrv[i], 2)} | ${f1(I.au_r30[i])}, ${f1(I.au_c30[i], 2)} | ${f1(I.c7_dxy30[i])}, ${f1(I.c7_tnx30[i], 2)} | ${f1(I.fng[i], 0)}, ${f1(I.usdtd[i], 2)} | ${f1(fw(30), 0)} / ${f1(fw(90), 0)} / ${f1(fw(180), 0)}`);
}
