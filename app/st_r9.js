/* st, круг 9 — сборка: что из найденного складывается и что даёт именно фондовый рынок (контроли без акций).
   Части: A — «не продавать на страхе, когда крипта сильно отстала от акций» (позиция 12: usdtd < 7,6 & fng < 52 & st_bxr90 < X & isbig < 0,5 → копить);
          A0 — то же по собственному падению BTC (btcr90 < −25, без акций);
          B — покупки 1–9 × 2 при всплеске VIX (VIX / SMA50 > 1,5);
          F — продажи на фандинге 29–31 → копить при VIX > 30.
   Запуск: node st_r9.js */
const ST = require('./st_lib.js'), { c, L, S6 } = ST;
const go = (nm, S) => ST.ev(nm, S);
const R6 = (x) => Math.round(x * 1e6) / 1e6;
const FEAR = [c('usdtd', '<', 7.6), c('fng', '<', 52)];
// сборка: по порядку применяет части к S
const A = (x = -38, big = 1) => (S) => ST.ins([{ act: 1e-6, conds: [...FEAR, c('st_bxr90', '<', x), ...(big ? [c('isbig', '<', 0.5)] : [])] }], 11, S);
const A0 = (x = -25) => (S) => ST.ins([{ act: 1e-6, conds: [...FEAR, c('btcr90', '<', x)] }], 11, S);
const AB = (S) => ST.ins([{ act: 1e-6, conds: [...FEAR, c('btcr90', '<', -25), c('st_bxr90', '<', -30)] }], 11, S);
const B = (t = 1.5, m = 2) => (S) => ST.preMod((r) => r.act > 1.0001 && S6.rules.slice(0, 9).some((q) => JSON.stringify(q) === JSON.stringify(r)), (r) => ({ act: R6(1 + (r.act - 1) * m), conds: [...r.conds, c('st_vixr', '>', t)] }), S);
const F = (v = 30) => (S) => ST.preMod((r) => r.conds.length === r.conds.filter((q) => q.ind !== 'st_vix').length && r.conds.some((q) => q.ind === 'fund30') && r.act < 0, (r) => ({ act: 1e-6, conds: [...r.conds, c('st_vix', '>', v)] }), S);
const mk = (...parts) => parts.reduce((S, p) => p(S), S6);
const R = {};
for (const [nm, parts] of [['A (BTC−NDX 90д < −38, не крупные)', [A()]], ['A (BTC−NDX 90д < −35, не крупные)', [A(-35)]], ['A0 (BTC за 90д < −25, без акций)', [A0()]], ['AB (BTC 90д < −25 И BTC−NDX 90д < −30)', [AB]],
  ['B (покупки ×2 при VIX/50д > 1,5)', [B()]], ['F (фандинг копить при VIX > 30)', [F()]], ['B + F', [B(), F()]], ['A + B', [A(), B()]], ['A + F', [A(), F()]], ['A + B + F', [A(), B(), F()]],
  ['A0 + B + F', [A0(), B(), F()]], ['AB + B + F', [AB, B(), F()]], ['A(−35) + B + F', [A(-35), B(), F()]]]) R[nm] = go(nm, mk(...parts));
// проверка сборки: сколько копий вставлено
const S = mk(A(), B(), F()); console.log(`правил в A + B + F: ${S.rules.length} (combo6 ${S6.rules.length})`);
console.log('монеты пользователя, A + B + F:', ST.mineTxt(ST.mine(S)));
console.log('монеты пользователя, A0 + B + F:', ST.mineTxt(ST.mine(mk(A0(), B(), F()))));
module.exports = { A, A0, AB, B, F, mk };
