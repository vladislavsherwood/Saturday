/* op, круг 9 — сборка кандидата и устойчивость.
   К-V: фандинг (29–31) → копить (act 1e-6), когда VVIX > 120 (круг 7; надмножество st F «VIX > 30»).
   К-D: продажи вершины и пампа (40–59, 61–69) × 1,5, когда перцентиль DVOL за 365 дней < 0,3 (круг 6; самоуспокоение на крипто-опционах).
   Проверки: на combo6 и combo7-draft — по отдельности и вместе; плато (VVIX 110/115/120/125/130 × перц. 0,2/0,3/0,4, множитель 1,25/1,5/2);
   без эпизода (2020-03, 2022, 2024-08, 2025-04, 2025-10, 2021, 2023-24); дни срабатывания по годам; монеты пользователя.
   Запуск: node op_r9.js [c6|c7] (лог scratchpad/op/r9_<основа>.txt) */
const O = require('./op_lib.js'), { c, T, L } = O;
const BK = process.argv[2] || 'c6'; O.tee('r9_' + BK);
const S0 = O.base(BK);
const EP = { '2020-03': ['2020-02-15', '2020-06-15'], '2021': ['2021-01-01', '2022-01-01'], '2022': ['2022-01-01', '2023-01-01'], '2023-24': ['2023-06-01', '2024-07-15'],
  '2024-08': ['2024-07-15', '2024-10-15'], '2025-04': ['2025-03-01', '2025-06-15'], '2025-10': ['2025-09-15', '2026-01-15'], '2018': ['2018-01-01', '2019-01-01'] };
for (const [k, [a, b]] of Object.entries(EP)) L.addInd('op_ep_' + k, (X) => Float64Array.from(X.ind.t, (t) => (t >= T(a) && t < T(b) ? 1 : 0)));
const isF = (r) => O.famOf(r) === 'fund', isTP = (r) => ['top', 'pump'].includes(O.famOf(r)) && r.act < 0;
function build({ v = 120, p = 0.3, m = 1.5, ex = null, kv = true, kd = true } = {}, S = S0) {
  const e = ex ? [c('op_ep_' + ex, '<', 0.5)] : [];
  let Q = S;
  if (kv) Q = O.preMod(isF, (r) => ({ act: 1e-6, conds: [...r.conds, c('op_vvix', '>', v), ...e] }), Q);
  if (kd) Q = O.preMod(isTP, (r) => ({ act: O.sellAct(r.act, m), conds: [...r.conds, c('op_dvp', '<', p), ...e] }), Q);
  return Q;
}
const holds = (X, r, j) => r.conds.every((cd) => { const v = X.ind[cd.ind][j]; return cd.op === '<' ? v < cd.v : v > cd.v; });
function fired(S, isNew) { const by = {}; let n = 0; for (const X of O.XS) for (let j = 0; j < X.n; j++) for (const r of S.rules) { if (!holds(X, r, j)) continue; if (isNew(r)) { const y = O.day(X.ind.t[j]).slice(0, 7); by[y] = (by[y] || 0) + 1; n++; } break; } return { n, by }; }
console.log(`основа ${BK}: ${S0.rules.length} правил`);
const RV = O.run('К-V (VVIX > 120 → фандинг копить)', build({ kd: false }));
const RD = O.run('К-D (перц. DVOL < 0,3 → вершина/памп ×1,5)', build({ kv: false }));
const RA = O.run('К-V + К-D', build());
const SF = O.preMod(isF, (r) => ({ act: 1e-6, conds: [...r.conds, c('op_vix', '>', 30)] }));
O.run('для сравнения st F (VIX > 30)', SF);
O.run('st F + К-D', build({ kv: false }, SF));
const fv = fired(build({ kd: false }), (r) => r.conds.some((cd) => cd.ind === 'op_vvix')), fd = fired(build({ kv: false }), (r) => r.conds.some((cd) => cd.ind === 'op_dvp'));
console.log(`дни срабатывания К-V: ${fv.n} монето-дней: ${Object.entries(fv.by).map(([y, k]) => y + ':' + k).join(' ')}`);
console.log(`дни срабатывания К-D: ${fd.n} монето-дней: ${Object.entries(fd.by).map(([y, k]) => y + ':' + k).join(' ')}`);
console.log('\nплато (К-V + К-D)');
for (const v of [110, 115, 125, 130]) O.run(`  VVIX > ${v}`, build({ v }));
for (const p of [0.1, 0.2, 0.4]) O.run(`  перц. DVOL < ${p}`, build({ p }));
for (const m of [1.25, 2]) O.run(`  множитель К-D ×${m}`, build({ m }));
console.log('\nбез эпизода (К-V + К-D)');
for (const k of Object.keys(EP)) O.run(`  без ${k}`, build({ ex: k }));
console.log('\nмонеты пользователя (вся история, итог к DCA %, лог-разница к основе):');
console.log('  ' + O.mineTxt(O.mine(build())));
require('fs').writeFileSync(O.LOG + 'r9_' + BK + '.json', JSON.stringify({ V: RV.s, D: RD.s, A: RA.s, fv, fd }));
