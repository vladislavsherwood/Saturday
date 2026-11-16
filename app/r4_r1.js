/* r4, круг 1: упрощение — какие из 56 правил combo4 можно убрать без потери.
   Гипотеза: после отложенной паники и эйфории часть сегментных копий продаж стала лишней; правило убираем, если доход ≥ −0,005 и строгая ✔.
   Запуск: node r4_r1.js */
const L = require('./r4_lib.js'), { S0 } = L;
const txt = (r) => r.act + ' ' + r.conds.map((c) => c.ind + c.op + c.v).join(' & ');
L.run('combo4');
const res = [];
for (let i = 0; i < S0.rules.length; i++) { const S = L.clone(); S.rules.splice(i, 1); const r = L.run(`без #${i}: ${txt(S0.rules[i])}`.slice(0, 44), S, L.pol0, { quiet: true }); res.push({ i, d: r.d, ok: !r.w, r }); console.log(`#${String(i).padStart(2)} ${L.sg(r.d)} ${r.w ? '✗' : '✔'} ${txt(S0.rules[i]).padEnd(78)} ${r.w.slice(0, 120)}`); }
module.exports = { res };
