/* Перепроверка «эйфории в стейблах» (wild, круг 9) на текущей combo4: отложенная паника для всех монет (A 0).
   Правило последним: usdt < 0,9, age > 540, не мем, beta180 > 0,9 → продать 5%. Плюс соседи (порог usdt, доля, бета). Запуск: node euph_check.js */
const P2 = require('./panicx_p2.js'), P = P2.P;
const pol = P2.Boost(2, { k: 0, A: 0 });
P.setBaseline(P.base, pol);
const V = (u = 0.9, s = 0.05, b = 0.9) => { const S = P.clone(P.base); S.rules.push({ act: -s, conds: [{ ind: 'usdt', op: '<', v: u }, { ind: 'age', op: '>', v: 540 }, { ind: 'meme', op: '<', v: 0.5 }, { ind: 'beta180', op: '>', v: b }] }); return S; };
P.report('combo4 (A 0)', P.base, pol, { n100: true });
P.report('эйфория 0,9 / 5% / бета 0,9', V(), pol, { n100: true });
for (const [u, s, b] of [[0.85, 0.05, 0.9], [0.92, 0.05, 0.9], [0.9, 0.03, 0.9], [0.9, 0.08, 0.9], [0.9, 0.05, 1.0], [0.9, 0.05, 0.8]]) P.report(`сосед usdt ${u} / ${s * 100}% / бета ${b}`, V(u, s, b), pol);
