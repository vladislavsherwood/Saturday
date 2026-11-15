/* Круг 9. Правило-антипод паники: «эйфория в стейблах». Паника — USDT.D к 200-дн. средней > 1,07 (деньги бегут в стейблы → покупать).
   Зеркало: usdt < L (стейблы массово тратятся на покупки) → продать x% монеты в день. Диагностика BTC: usdt < 0,8 — BTC через 180 дн. −7% (обычно +29%),
   просадка до минимума 28%; combo4 в эти дни продаёт только в ~24% дней.
   Размещение: 'end' — последним правилом (только когда ничего другого не сработало), 'top' — сразу после охраны (перед всеми продажами).
   Доп. условие g: только при жадности fng > 52. Запуск: node wild_r9.js > scratchpad/wild/r9.log */
const W = require('./wild_sim.js');
function S9({ L, x, at = 'end', greed = false, seg = false, A = 0, nobig = false, fit = null, fit2 = null, nomeme = false }) {
  const S = W.clone(W.BASE), conds = [{ ind: 'usdt', op: '<', v: L }];
  if (A) conds.push({ ind: 'age', op: '>', v: A }); // возраст монеты (как фильтр отложенной паники)
  if (nobig) conds.push({ ind: 'isbig', op: '<', v: 0.5 });
  if (fit2) conds.push({ ind: fit2[0], op: '>', v: fit2[1] });
  if (nomeme) conds.push({ ind: 'meme', op: '<', v: 0.5 });
  if (fit) conds.push({ ind: fit[0], op: '>', v: fit[1] }); // светофор внутри правила: только монеты, следующие за рынком (corr180 или beta180)
  if (greed) conds.push({ ind: 'fng', op: '>', v: 52 });
  const rs = [{ act: -x, conds }];
  // seg: как у других продаж — отстающая монета (rel180 < −15) × 1,25 и мем-отстающая × 2 (копии перед основным правилом)
  if (seg) rs.unshift({ act: -Math.min(1, 2 * x), conds: [...conds, { ind: 'rel180', op: '<', v: -15 }, { ind: 'meme', op: '>', v: 0.5 }] }, { act: -Math.min(1, 1.25 * x), conds: [...conds, { ind: 'rel180', op: '<', v: -15 }] });
  if (at === 'end') S.rules.push(...rs); else S.rules.splice(10, 0, ...rs);
  return S;
}
module.exports = { S9 };
if (require.main === module) {
  const arg = process.argv[2] || 'grid';
  W.report('combo4');
  if (arg === 'grid') {
    for (const L of [0.8, 0.85, 0.9]) for (const x of [0.02, 0.05, 0.1]) W.report(`usdt<${L} → −${x * 100}% (в конце)`, S9({ L, x }));
    for (const L of [0.8, 0.85]) for (const x of [0.02, 0.05]) W.report(`usdt<${L} → −${x * 100}% (перед продажами)`, S9({ L, x, at: 'top' }));
    for (const L of [0.85, 0.9]) W.report(`usdt<${L} & fng>52 → −5% (в конце)`, S9({ L, x: 0.05, greed: true }));
  }
  if (arg === 'age') {
    for (const A of [365, 540, 730]) for (const L of [0.8, 0.85, 0.9]) for (const x of [0.02, 0.05]) W.report(`A${A} usdt<${L} → −${x * 100}%`, S9({ L, x, A }));
    for (const L of [0.85, 0.9]) for (const x of [0.02, 0.05]) W.report(`A540 без крупных usdt<${L} → −${x * 100}%`, S9({ L, x, A: 540, nobig: true }));
  }
  if (arg === 'fit') {
    for (const fit of [['corr180', 0.4], ['corr180', 0.5], ['corr180', 0.6], ['beta180', 0.7], ['beta180', 0.9], ['beta180', 1.1]]) for (const [L, x] of [[0.85, 0.02], [0.9, 0.02], [0.9, 0.05]]) W.report(`A540 ${fit.join('>')} usdt<${L} → −${x * 100}%`, S9({ L, x, A: 540, fit }));
  }
  if (arg === 'meme') { // как убрать провал PEPE: без мемов / бета + корреляция
    for (const [L, x] of [[0.85, 0.02], [0.9, 0.02], [0.9, 0.05]]) {
      W.report(`β>0.9 без мемов usdt<${L} → −${x * 100}%`, S9({ L, x, A: 540, fit: ['beta180', 0.9], nomeme: true }));
      W.report(`β>0.9 & corr>0.6 usdt<${L} → −${x * 100}%`, S9({ L, x, A: 540, fit: ['beta180', 0.9], fit2: ['corr180', 0.6] }));
      W.report(`β>0.9 & corr>0.5 usdt<${L} → −${x * 100}%`, S9({ L, x, A: 540, fit: ['beta180', 0.9], fit2: ['corr180', 0.5] }));
    }
  }
  if (arg === 'plateau') { // плато «эйфория» для зелёных монет без мемов
    for (const b of [0.8, 0.9, 1.0]) for (const L of [0.85, 0.88, 0.9, 0.92]) for (const x of [0.02, 0.03, 0.05, 0.08]) W.report(`β>${b} A540 без мемов usdt<${L} → −${x * 100}%`, S9({ L, x, A: 540, fit: ['beta180', b], nomeme: true }));
    for (const A of [365, 730]) W.report(`β>0.9 A${A} без мемов usdt<0.9 → −5%`, S9({ L: 0.9, x: 0.05, A, fit: ['beta180', 0.9], nomeme: true }));
    W.report(`β>0.9 A0 без мемов usdt<0.9 → −5%`, S9({ L: 0.9, x: 0.05, fit: ['beta180', 0.9], nomeme: true }));
  }
  console.log(W.summary());
}
