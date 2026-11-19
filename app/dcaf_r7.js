/* dcaf, круг 4: фильтр взноса + «ловушка для фитилей» вместе (больше резерв → больше покупок на фитилях); частота обновления заявок. Запуск: node dcaf_r7.js */
const L = require('./r4_lib.js'), { S0, c } = L;
const LV = [[0.25, 0.1], [0.4, 0.2], [0.6, 0.3]];
const W = (o = {}) => ({ ...L.pol0, wick: { lv: LV, age: 60, ...o } });
const F = (act, conds) => { const S = L.clone(); S.rules.push({ act, conds }); return S; };
const out = (r) => console.log(r.txt.slice(0, 190));
const Z0 = 1e-6;
L.run('combo4', S0);
out(L.run('фитили', S0, W(), { quiet: true }));
out(L.run('фитили + копить взнос всегда', F(Z0, [c('age', '>', -1)]), W(), { quiet: true }));
out(L.run('фитили + полвзноса всегда', F(0.5, [c('age', '>', -1)]), W(), { quiet: true }));
for (const v of [0.8, 0.9, 1.0]) out(L.run(`фитили + копить, если монета < ${v} своей 200д`, F(Z0, [c('sma200', '<', v)]), W(), { quiet: true }));
for (const v of [-20, -30]) out(L.run(`фитили + копить, если рост 90д < ${v}%`, F(Z0, [c('ret90', '<', v)]), W(), { quiet: true }));
for (const e of [2, 3, 7]) out(L.run(`фитили, заявки раз в ${e} дн`, S0, W({ every: e }), { quiet: true }));
