/* h2, круг 12: соседи кандидата V1 «удержание после капитуляции» (страх < 15 был ≤ 60 дней назад, MVRV < 1, btcr30 < 20 → взнос, перед продажами на страхе)
   по одному параметру: порог страха q, срок N, порог MVRV m, фильтр возраста ряда монеты (age > 180: монеты моложе полугода падают сами по себе — TON в 06.2022).
   Обе основы: combo4 + фитили и combo4. Третий аргумент nm — во всех вариантах «не мем» (итоговый h2). Запуск: node h2_r12.js [wick|plain] [nm] */
const H = require('./h2_lib.js'), { L, c } = H;
const kind = process.argv[2] || 'wick', pol = H.base(kind);
console.log(`ОСНОВА: combo4 (57)${kind === 'wick' ? ' + фитили' : ''}`);
for (const q of [12, 13, 17, 18]) { const k = 'h2fd' + q; for (const g in H.G) for (const X of H.G[g]) { const I = X.ind, a = new Float64Array(X.n); let last = -1e9; for (let i = 0; i < X.n; i++) { if (I.fng[i] < q) last = i; a[i] = i - last; } I[k] = a; } }
const ext = (r) => { const m = H.m81(r); return `${r.s.slice(0, 150)} | 81 ${L.sg(m.m)} ${m.u}/${m.d}${r.w ? ' | ' + r.w.slice(0, 110) : ''}`; };
const NM = process.argv[3] === 'nm' ? [c('meme', '<', 0.5)] : [];
const V = (q = 15, N = 60, m = 1, age = 0) => ({ act: 1, conds: [c(q === 10 ? 'h2fd' : 'h2fd' + q, '<', N), c('mvrv', '<', m), ...(age ? [c('age', '>', age)] : []), ...NM, c('btcr30', '<', 20)] });
const go = (nm, r) => console.log(ext(H.run(nm, H.ins([r], 10), pol, { n100: true, quiet: true })));
for (const age of NM.length ? [180] : [0, 180]) {
  const a = age ? `, age>${age}` : '';
  go(`V1 страх<15 ≤60, mvrv<1${a}`, V(15, 60, 1, age));
  for (const q of [10, 12, 13, 17, 18, 20]) go(`  q: страх<${q} ≤60, mvrv<1${a}`, V(q, 60, 1, age));
  for (const N of [30, 45, 75, 90, 120]) go(`  N: страх<15 ≤${N}, mvrv<1${a}`, V(15, N, 1, age));
  for (const m of [0.9, 0.95, 1.05, 1.1]) go(`  m: страх<15 ≤60, mvrv<${m}${a}`, V(15, 60, m, age));
}
for (const age of [90, 365, 540]) go(`V1 + age>${age}`, V(15, 60, 1, age));
if (NM.length) for (const [q, N, m] of [[10, 120, 1], [15, 120, 1.05], [20, 90, 1.05], [12, 90, 0.95], [17, 45, 1.1]]) go(`  диаг.: страх<${q} ≤${N}, mvrv<${m}, age>180`, V(q, N, m, 180));
