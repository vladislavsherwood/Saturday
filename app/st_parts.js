/* st: правила частей кандидата для проверки маржи (st_margin.py parts) → scratchpad/st/parts.json. Запуск: node st_parts.js */
const ST = require('./st_lib.js'), { c, S6 } = ST;
const R6 = (x) => Math.round(x * 1e6) / 1e6;
const FEAR = [c('usdtd', '<', 7.6), c('fng', '<', 52)];
const isB9 = (r) => r.act > 1.0001 && S6.rules.slice(0, 9).some((q) => JSON.stringify(q) === JSON.stringify(r));
const AB = (S) => ST.ins([{ act: 1e-6, conds: [...FEAR, c('btcr90', '<', -25), c('st_bxr90', '<', -30)] }], 11, S);
const AB1 = (S) => ST.ins([{ act: 1, conds: [...FEAR, c('btcr90', '<', -25), c('st_bxr90', '<', -30)] }], 11, S);
const B = (m = 2) => (S) => ST.preMod(isB9, (r) => ({ act: R6(1 + (r.act - 1) * m), conds: [...r.conds, c('st_vixr', '>', 1.5)] }), S);
const F = (S) => ST.preMod((r) => r.act < 0 && r.conds.some((q) => q.ind === 'fund30'), (r) => ({ act: 1e-6, conds: [...r.conds, c('st_vix', '>', 30)] }), S);
const o = { AB: AB(S6), B: B()(S6), 'B×1,5': B(1.5)(S6), F: F(S6), 'AB(взнос)': AB1(S6), 'AB + F': F(AB(S6)), 'AB(взнос) + B×1,5 + F': F(B(1.5)(AB1(S6))), 'B + F': F(B()(S6)) };
const out = {}; for (const k in o) out[k] = o[k].rules.map(({ act, conds }) => ({ act, conds }));
require('fs').writeFileSync('/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/st/parts.json', JSON.stringify(out));
for (const k in o) ST.ev(k, o[k]);
