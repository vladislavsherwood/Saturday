/* Агент 3, круг 11: «лесенка по цене» — докупать резервом только ниже прошлой покупки (ближе к дну и «размазаннее»), продавать повторно только выше прошлой продажи.
   H11a покупки: если за win дней (30/60/120) была покупка резерва по цене P, а сегодня цена выше P·(1 − drop) (drop 0/5/10/20%), доля покупки ×k (0/0,25/0,5);
   якорь — последняя покупка или самая низкая за окно. H11b продажи: повторная продажа за win дней (30/60) только выше прошлой·(1 + rise) (0/5/10%), иначе ×k (0/0,5).
   Оценщик — копия agent_sim (agent3_edge.js), без лесенки совпадает до бита. База — C4. Критерий: строгая проверка к C4 + доход > +0,03 + плато;
   смотрю и метрики дна. Запуск: node app/agent3_loop11.js <out.json> > log */
const A = require('./agent3_sim.js'), E3 = require('./agent3_edge.js');
const fs = require('fs');
const G = A.groups(), base = E3.evalAll(G, A.C4, true), out = [];
console.log(A.HDR); console.log(A.row('C4', base, base));
const rec = (t, S) => { const r = E3.evalAll(G, S, true); console.log(A.row(t, r, base)); out.push({ tag: t, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m }); };
for (const keep of [false, true]) for (const win of [30, 60, 120]) for (const drop of [0, 0.05, 0.1, 0.2]) for (const k of [0, 0.25, 0.5])
  rec(`H11a покупка за ${win} дн только ниже ${keep ? 'мин.' : 'прошлой'}·(1−${drop * 100}%), иначе ×${k}`, { ...A.C4, bl: { drop, win, k, keep } });
for (const win of [30, 60]) for (const rise of [0, 0.05, 0.1]) for (const k of [0, 0.5])
  rec(`H11b продажа за ${win} дн только выше прошлой·(1+${rise * 100}%), иначе ×${k}`, { ...A.C4, sl: { rise, win, k } });
fs.writeFileSync(process.argv[2], JSON.stringify(out));
