/* Агент 4A, круг 6: сила паники в стейблах как мера близости дна.
   Разбор дней покупок паники (agent4a_ev4.js): при сильной панике (usdt > 1,26 — верхняя треть) покупка всего на 13% выше будущего
   90-дн. минимума и +196% через 180 дней; при слабой (usdt < 1,13) — 40% и −15%. Круг 4 показал, что резать слабую панику нельзя
   (резерв нужен обороту). Гипотеза H6a: при сильной панике покупать крупнее (доля ×1,5/×2/весь резерв), слабую не трогать —
   деньги в сильную панику придут из резерва, который иначе ушёл бы позже. H6b: высокая доля стейблов на рынке (usdtd > 7,6/8/8,5 —
   продажи на страхе в эти дни уже не идут) без паники → 5/10/25% резерва в конце списка.
   Критерий (заранее): строгая ✔, доход > +0,03, соседние пороги в плюсе. Запуск: node app/agent4a_loop6.js <out.json> */
const A = require('./agent4a_sim.js');
const G = A.groups(), base = A.ev(G, A.W25), out = [];
console.log(A.HDR); console.log(A.row('W25', base, base));
const R = A.W25.rules;
const run = (tag, S) => { const r = A.ev(G, S); console.log(A.row(tag, r, base)); out.push({ tag, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m, sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med }); };
const sets = { '#3,5,9': [3, 5, 9], 'вся паника': [3, 4, 5, 6, 9, 10] };
for (const [sn, idx] of Object.entries(sets)) for (const T of [1.15, 1.2, 1.25, 1.3]) for (const k of [1.5, 2, 9]) {
  const S = { ...A.W25, rules: R.flatMap((r, q) => (!idx.includes(q) ? [r] : [{ act: 1 + Math.min(1, (r.act - 1) * k), conds: [...r.conds, A.c('usdt', '>', T)] }, r])) };
  run(`${sn}: сильная паника usdt > ${T} → ${k === 9 ? 'весь резерв' : '×' + k}`, S);
}
for (const T of [7.6, 8, 8.5]) for (const f of [0.05, 0.1, 0.25]) run(`стейблы usdtd > ${T} → ${f * 100}% (в конце)`, A.addRule(A.W25, { act: 1 + f, conds: [A.c('usdtd', '>', T)] }));
console.log('\nлучшие 12:'); for (const o of [...out].sort((a, b) => b.d - a.d).slice(0, 12)) console.log(`${o.pass ? '✔' : '·'} ${o.d.toFixed(3)} 100н ${o.n100.toFixed(0)} ${o.bw.join('/')} дно ${o.m.buyAbove90.toFixed(0)}/${o.m.zone15.toFixed(0)}/${o.m.bott3.toFixed(0)}/${o.m.buysPerBottom.toFixed(1)} | ${o.tag} | ${o.why}`);
A.save(out, process.argv[2] || '/dev/null');
