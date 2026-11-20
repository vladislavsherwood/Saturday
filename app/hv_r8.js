/* hv, круг 8: проверка финалиста П+Ш+Э ×1,5 (hvv > 115, не крупная): края по доле, по периодам (правила только до / только с 2025-01-01),
   по монетам, левый край T 100–105 (PUMP), монеты пользователя. */
const H = require('./hv_lib.js'), { c, L1 } = H;
const { build } = require('./hv_r7.js');
H.head();
H.ev('combo5', H.S5);
const F = H.ev('финалист П+Ш+Э ×1,5', build({}));
console.log('  ', H.diff(F, 15));
for (const m of [1.75, 2.5, 3]) H.ev(`П+Ш+Э ×${m}`, build({ mp: m, mw: m, me: m }));
// по периодам: условие t на копиях (вставляется во все копии через доп. условие hvv — проще: отдельная сборка с условием t)
const t25 = H.T('2025-01-01');
const addT = (S, cond) => { const T = H.L.clone(S); for (const r of T.rules) if (r.conds.some((x) => x.ind === 'hvv')) r.conds.push(cond); return T; };
H.ev('финалист, правила только до 2025', addT(build({}), c('t', '<', t25)));
H.ev('финалист, правила только с 2025', addT(build({}), c('t', '>', t25 - 0.5)));
const t23 = H.T('2023-01-01');
H.ev('финалист, правила только до 2023', addT(build({}), c('t', '<', t23)));
H.ev('финалист, правила только с 2023', addT(build({}), c('t', '>', t23 - 0.5)));
// левый край: PUMP при T 105 / 115
for (const T of [100, 105, 110, 115]) { const S = build({ T }); const X = H.BY.PUMP; console.log(`T${T} PUMP:`, H.E(X, S, H.polW).toFixed(1), 'combo5', H.E(X, H.S5, H.polW).toFixed(1), '| сдвиг 0/1:', H.P.edge(X, S, 0, 'full', false, H.polW).e.toFixed(1), H.P.edge(X, S, 1, 'full', false, H.polW).e.toFixed(1)); }
// монеты пользователя
console.log('Монеты пользователя: combo5 → финалист (итог к DCA, %, худший из сдвигов 0/1)');
console.log(H.mineTxt(H.mine(build({}), H.polW)));
