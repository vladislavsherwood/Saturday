/* dcaf: act 0 ломает выдачу отложенной паники (release не вызывается в день без покупки) — копить взнос через act 1e-6 (покупка ≈ 0, выдача работает).
   Запуск: node dcaf_r3.js */
const L = require('./r4_lib.js'), { S0, c } = L;
const Z0 = 1e-6;
const F = (act, conds) => { const S = L.clone(); S.rules.push({ act, conds }); return S; };
const T = (nm, conds, acts = [Z0, 0.5]) => { for (const a of acts) { const r = L.run(`${nm} → ${a === Z0 ? 'копить' : a}`, F(a, conds), L.pol0, { quiet: true }); console.log(r.txt.slice(0, 150)); } };
L.run('combo4', S0);
T('всегда', [c('age', '>', -1)]);
for (const v of [0.6, 0.7, 0.8, 0.9, 1.0]) T(`монета/200д < ${v}`, [c('sma200', '<', v)]);
for (const v of [-20, -30, -50]) T(`рост 90д < ${v}%`, [c('ret90', '<', v)]);
for (const v of [0.8, 0.9, 1.0]) T(`BTC/200д < ${v}`, [c('btc200', '<', v)]);
for (const v of [30, 50, 70]) T(`от ATH > ${v}%`, [c('dd', '>', v)]);
for (const v of [65, 70]) T(`fng > ${v}`, [c('fng', '>', v)]);
for (const v of [1.5, 2]) T(`монета/200д > ${v}`, [c('sma200', '>', v)]);
for (const v of [0.9, 0.95]) T(`usdt < ${v}`, [c('usdt', '<', v)]);
