/* op, круг 5 — «страх только в крипте»: продажи на страхе × m, когда опционный рынок акций спокоен. Плато, размер, возраст, без эпизодов, дни срабатывания.
   Сетка: VIX < X (12…18), перцентиль VIX за 250 т.д. < p, VIX9D/VIX3M < X, DVOL < X; m 1,25 / 1,5; возраст монеты > 0 / 365 / 540.
   Без эпизода: условие копий дополняется «день не в эпизоде» (op_ep_<имя> < 0,5).
   Запуск: node op_r5.js [c6|c7] (лог scratchpad/op/r5_<основа>.txt) */
const O = require('./op_lib.js'), { c, T, L } = O;
const BK = process.argv[2] || 'c6'; O.tee('r5_' + BK);
const S0 = O.base(BK);
const pickF = (r) => ['fear', 'k4'].includes(O.famOf(r));
const mod = (conds, m, S = S0) => O.preMod(pickF, (r) => ({ act: O.sellAct(r.act, m), conds: [...r.conds, ...conds] }), S);
const EP = { '2020-03': ['2020-02-15', '2020-06-15'], '2022': ['2022-01-01', '2023-01-01'], '2024-08': ['2024-07-15', '2024-10-15'], '2025-04': ['2025-03-01', '2025-06-15'], '2025-10': ['2025-09-15', '2026-01-15'],
  '2017': ['2017-01-01', '2018-01-01'], '2019': ['2019-01-01', '2020-01-01'], '2023-24': ['2023-06-01', '2024-07-15'] };
for (const [k, [a, b]] of Object.entries(EP)) L.addInd('op_ep_' + k, (X) => Float64Array.from(X.ind.t, (t) => (t >= T(a) && t < T(b) ? 1 : 0)));
// дни срабатывания вставленных копий: первая сработавшая по порядку правило — копия (по монетам 181, по годам)
const holds = (X, r, j) => r.conds.every((cd) => { const v = X.ind[cd.ind][j]; return cd.op === '<' ? v < cd.v : v > cd.v; });
function fired(S, isNew) { const by = {}; let n = 0; for (const X of O.XS) for (let j = 0; j < X.n; j++) { for (const r of S.rules) { if (!holds(X, r, j)) continue; if (isNew(r)) { const y = O.day(X.ind.t[j]).slice(0, 4); by[y] = (by[y] || 0) + 1; n++; } break; } } return { n, by }; }
console.log(`основа ${BK}: ${S0.rules.length} правил`);
console.log('(а) плато VIX < X × m × возраст');
for (const age of [0, 365, 540]) for (const m of [1.25, 1.5]) for (const x of [12, 13, 14, 15, 16, 17, 18]) O.run(`VIX < ${x} ×${m}${age ? ' age>' + age : ''}`, mod([c('op_vix', '<', x), ...(age ? [c('age', '>', age)] : [])], m));
console.log('\n(б) относительные и крипто-опционные пороги ×1,25 / ×1,5, age > 365');
for (const m of [1.25, 1.5]) {
  for (const p of [0.1, 0.2, 0.3, 0.4]) O.run(`VIX перцентиль 250 < ${p} ×${m} age>365`, mod([c('op_vixp', '<', p), c('age', '>', 365)], m));
  for (const x of [0.8, 0.85, 0.9]) O.run(`VIX9D/VIX3M < ${x} ×${m} age>365`, mod([c('op_ts', '<', x), c('age', '>', 365)], m));
  for (const x of [45, 50, 55]) O.run(`DVOL < ${x} ×${m} age>365`, mod([c('op_dv', '<', x), c('age', '>', 365)], m));
}
console.log('\n(в) без эпизода (VIX < 13 / 14 / 15, ×1,25 / ×1,5, age > 365) и дни срабатывания');
for (const x of [13, 14, 15]) for (const m of [1.25, 1.5]) {
  const base = [c('op_vix', '<', x), c('age', '>', 365)], S = mod(base, m);
  const f = fired(S, (r) => r.conds.some((cd) => cd.ind === 'op_vix')); console.log(`  дни срабатывания VIX < ${x}: ${f.n} монето-дней; по годам ${Object.entries(f.by).map(([y, v]) => y + ':' + v).join(' ')}`);
  O.run(`VIX < ${x} ×${m} age>365`, S);
  for (const k of Object.keys(EP)) O.run(`   без ${k}`, mod([...base, c('op_ep_' + k, '<', 0.5)], m));
}
