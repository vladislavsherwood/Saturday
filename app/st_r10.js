/* st, круг 10 — устойчивость финалиста и выбор между A + B + F и AB + B + F (части — st_r9.js).
   (а) плато: каждый параметр ±шаг при остальных на месте; (б) по одному эпизоду: все вставки финалиста выключены в окне;
   (в) 100 новых по сегментам; (г) монеты пользователя (вся история; с 2024-01-01 с нуля); (д) запись found/st-best.json — отдельным шагом (st_final.js).
   Запуск: node st_r10.js */
const ST = require('./st_lib.js'), { c, L, T, S6, P, G } = ST;
const R6 = (x) => Math.round(x * 1e6) / 1e6;
const FEAR = [c('usdtd', '<', 7.6), c('fng', '<', 52)];
const isB9 = (r) => r.act > 1.0001 && S6.rules.slice(0, 9).some((q) => JSON.stringify(q) === JSON.stringify(r));
// части с параметрами и общим доп. условием ex (окно)
const A = ({ x = -38, ex = [] } = {}) => (S) => ST.ins([{ act: 1e-6, conds: [...FEAR, c('st_bxr90', '<', x), c('isbig', '<', 0.5), ...ex] }], 11, S);
const AB = ({ x = -30, y = -25, ex = [] } = {}) => (S) => ST.ins([{ act: 1e-6, conds: [...FEAR, c('btcr90', '<', y), c('st_bxr90', '<', x), ...ex] }], 11, S);
const B = ({ t = 1.5, m = 2, ex = [] } = {}) => (S) => ST.preMod(isB9, (r) => ({ act: R6(1 + (r.act - 1) * m), conds: [...r.conds, c('st_vixr', '>', t), ...ex] }), S);
const F = ({ v = 30, ex = [] } = {}) => (S) => ST.preMod((r) => r.act < 0 && r.conds.some((q) => q.ind === 'fund30') && !r.conds.some((q) => q.ind === 'st_vix'), (r) => ({ act: 1e-6, conds: [...r.conds, c('st_vix', '>', v), ...ex] }), S);
const mk = (...parts) => parts.reduce((S, p) => p(S), S6);
const go = (nm, S) => ST.ev(nm, S);
const fin = { 'A + B + F': (o = {}) => mk(A(o.A), B(o.B), F(o.F)), 'AB + B + F': (o = {}) => mk(AB(o.A), B(o.B), F(o.F)) };
console.log('(а) плато');
for (const [nm, f] of Object.entries(fin)) {
  go(nm, f());
  const xs = nm.startsWith('AB') ? [[-25, -25], [-35, -25], [-30, -20], [-30, -30], [-40, -25]] : [[-32], [-35], [-41], [-44]];
  for (const [x, y] of xs) go(`  ${nm}: A x ${x}${y ? ' y ' + y : ''}`, f({ A: { x, y } }));
  for (const t of [1.3, 1.4, 1.6, 1.8]) go(`  ${nm}: B порог ${t}`, f({ B: { t } }));
  for (const m of [1.5, 2.5]) go(`  ${nm}: B ×${m}`, f({ B: { m } }));
  for (const v of [22, 25, 35]) go(`  ${nm}: F VIX > ${v}`, f({ F: { v } }));
}
console.log('(б) по одному эпизоду: все вставки выключены в окне');
const W = [['2018', '2018-01-01', '2018-11-01'], ['2018-11…2019-02', '2018-11-01', '2019-03-01'], ['2019', '2019-03-01', '2020-01-01'], ['2020-03', '2020-02-15', '2020-06-15'], ['2021-01…04', '2021-01-01', '2021-05-01'],
  ['2021-05…08', '2021-05-01', '2021-09-01'], ['2022', '2022-01-01', '2023-01-01'], ['2024-08', '2024-07-15', '2024-09-15'], ['2025-03…05', '2025-03-01', '2025-06-01'], ['2025-10…2026-02', '2025-10-01', '2026-03-01']];
W.forEach(([, a, b], k) => L.addInd('st_x' + k, (X) => Float64Array.from(X.ind.t, (t) => (t >= T(a) && t < T(b) ? 1 : 0))));
for (const [nm, f] of Object.entries(fin)) W.forEach(([wn], k) => { const ex = [c('st_x' + k, '<', 0.5)]; go(`  ${nm} без ${wn}`, f({ A: { ex }, B: { ex }, F: { ex } })); });
console.log('(в) 100 новых по сегментам; (г) монеты пользователя');
const { BR } = P.baseline();
for (const [nm, f] of Object.entries(fin)) {
  const S = f(), B1 = P.evc(S6, ST.polW, ["n100"]), N1 = P.evc(S, ST.polW, ["n100"]);
  console.log(nm, '100н по сегментам:', ['big', 'alt', 'meme'].map((s) => { const q = L.Z.mlog(N1, B1, s, ["n100"]); return `${s} ${ST.sg(q.m, 4)} ${q.u}/${q.d}`; }).join(', '));
  console.log('   монеты пользователя (вся история):', ST.mineTxt(ST.mine(S)));
  const cut = (Y, from) => { const a = Y.ind.t.findIndex((t) => t >= T(from)); if (a < 0) return null; const Z = { ...Y, n: Y.n - a, c: Y.c.slice(a), h: Y.h.slice(a), l: Y.l.slice(a), ind: {} }; for (const k in Y.ind) Z.ind[k] = Y.ind[k].slice ? Y.ind[k].slice(a) : Y.ind[k]; return Z; };
  console.log('   с 2024-01-01:', ST.MINE.map((n) => { const Y = ST.BY[n] && cut(ST.BY[n], '2024-01-01'); if (!Y || Y.n < 30) return `${n} —`; const b = ST.E(Y, S6), x = ST.E(Y, S); return `${n} ${Math.round(b)}→${Math.round(x)}`; }).join(', '));
}
module.exports = { A, AB, B, F, mk, fin };
