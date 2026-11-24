/* c7, круг 3 (проверка находки): К-D на эйфорию — перцентиль DVOL BTC за год < t → эйфория ×m. Без крупных (как hv2) / все; ×3; без эпизода; где срабатывает.
   Запуск: node c7_r3c.js (лог scratchpad/c7/r3c.txt) */
const C = require('./c7_lib.js'), { L } = C;
C.tee('r3c');
const E = (t, m, nb, win) => C.polM2({ extra: (ctx, f, a) => { const I = ctx.X.ind, j = ctx.j; if (f !== 'euph' || !(I.op_dvp[j] < t) || (nb && I.isbig[j] > 0.5) || (win && !I.c7_out[j])) return a; return C.sellAct(a, m); } });
for (const nb of [0, 1]) for (const m of [1.5, 2, 3]) for (const t of [0.2, 0.3, 0.4]) C.run(`${nb ? 'не крупные' : 'все'}: DVOL < ${t} → эйфория ×${m}`, C.mini, E(t, m, nb));
console.log('--- без эпизода (изменение выключено в окне) ---');
for (const [ep, [a, b]] of Object.entries({ ...C.EPS, '2023-24': ['2023-01-01', '2024-12-31'], '2025': ['2025-01-01', '2025-12-31'], '2026': ['2026-01-01', '2026-12-31'] })) { C.setWindow(a, b);
  for (const [nb, m] of [[1, 1.5], [1, 2]]) C.run(`без ${ep}: ${nb ? 'не крупные' : 'все'} ×${m}`, C.mini, E(0.3, m, nb, 1)); }
C.setWindow('1900-01-01', '1900-01-02');
// дни срабатывания: эйфория при DVOL < 0,3 (монето-дни по месяцам), 81 + 100 новых
const cnt = {}; const R = C.mini.rules.find((r) => r.f === 'euph');
for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of L.G[g]) { const I = X.ind; for (let j = 0; j < X.n; j++) if (I.op_dvp[j] < 0.3 && R.conds.every((cd) => (cd.op === '<' ? I[cd.ind][j] < cd.v : I[cd.ind][j] > cd.v))) { const m = C.O.A.day(I.t[j]).slice(0, 7); cnt[m] = (cnt[m] || 0) + 1; } }
console.log('эйфория при DVOL < 0,3 — монето-дни условия правила (до первых правил списка):', Object.entries(cnt).sort().map(([m, n]) => `${m}:${n}`).join(' '));
