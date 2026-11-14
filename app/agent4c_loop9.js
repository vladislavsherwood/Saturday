/* Агент 4C, круг 9: что ещё дать «слабой к рынку» монете поверх кандидата C (W25 + к BTC за 180 дн < −15% → все продажи ×1,25/×1,5).
   H9a: покупки резерва у слабой монеты крупнее (×1,25/×1,5 — «круговорот»: продали больше, выкупили больше на панике) или меньше (×0,75).
   H9b: продавать слабую монету и без рыночного сигнала — в дни без правила (иначе обычный взнос) продать 1/2% позиции, если к BTC за 180 дн
   < −30/−50% и монета ниже 0,8 своей средней 200 («продавать раньше»). Критерий: к кандидату C — строгая ✔, доход > +0,03, соседи > 0.
   Запуск: node app/agent4c_loop9.js <out.json> > log */
const A = require('./agent4c_sim.js');
const fs = require('fs');
const G = A.groups();
A.addInd(G, 'weak180', (X) => A.flagOf(X.n, (i) => X.ind.rel180[i] < -15));
const out = [], base = A.ev(G, A.W25);
console.log(A.HDR); console.log(A.row('W25', base, base));
for (const k of [1.25, 1.5]) {
  const C = A.scale(A.W25, 'weak180', 1, k, A.isSell), rc = A.ev(G, C), rec = A.recorder(G, rc, out);
  console.log(A.row(`C${k} к W25`, rc, base) + ' | ' + A.why(rc, base));
  for (const kb of [0.75, 1.25, 1.5]) rec(`C${k} + покупки слабой ×${kb}`, A.scale(C, 'weak180', kb, 1, A.isBuy));
  for (const v of [-30, -50]) for (const f of [0.01, 0.02]) rec(`C${k} + без сигнала: к BTC 180 дн < ${v}% и < 0,8 средней 200 → продать ${f * 100}%`, A.addRule(C, { act: -f, conds: [A.c('rel180', '<', v), A.c('sma200', '<', 0.8)] }));
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
