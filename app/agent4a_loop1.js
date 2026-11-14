/* Агент 4A, круг 1: покупать на панике только на новых минимумах монеты.
   Гипотеза: основная паника (#3, 42% денег резерва) тратит резерв по ходу всего падения вдвое выше дна. Если крупные правила паники
   срабатывают только в дни, когда монета у своего минимума (цена ≤ минимума за 30/90 дней + X%, или lo90 — новый 90-дн. минимум за 7 дней),
   покупки сместятся к дну и распределятся по ступеням падения (каждый новый минимум — ступень).
   Режимы: 'dca' — в остальные дни паники только взнос (резерв бережётся); 'fall' — правило пропускается (день уходит ниже по списку).
   Наборы правил: только #3; #3,#5,#9 (паника с выносом); вся паника (#3–#6, #9, #10).
   Критерий (заранее): строгая ✔, доход > +0,03, соседи в плюсе, «в зоне» не меньше 13%. Запуск: node app/agent4a_loop1.js <out.json> */
const A = require('./agent4a_sim.js');
const G = A.groups(), base = A.ev(G, A.W25), out = [];
console.log(A.HDR); console.log(A.row('W25', base, base));
const R = A.W25.rules;
const sets = { '#3': [3], '#3,5,9': [3, 5, 9], 'вся паника': [3, 4, 5, 6, 9, 10] };
const F = [];
for (const x of [5, 10, 15, 25]) F.push([`монета ≤ мин30 +${x}%`, A.c('cmin30', '<', x)]);
for (const x of [10, 20, 35]) F.push([`монета ≤ мин90 +${x}%`, A.c('cmin90', '<', x)]);
F.push(['новый 90-дн. минимум за 7 дней (lo90)', A.c('lo90', '>', 0.5)]);
for (const [sn, idx] of Object.entries(sets)) for (const [fn, fc] of F) for (const mode of ['dca', 'fall']) {
  const S = { ...A.W25, rules: R.flatMap((r, q) => (!idx.includes(q) ? [r] : mode === 'dca' ? [{ ...r, conds: [...r.conds, fc] }, { act: 1, conds: r.conds }] : [{ ...r, conds: [...r.conds, fc] }])) };
  const r = A.ev(G, S), tag = `${sn}: ${fn}, иначе ${mode === 'dca' ? 'только взнос' : 'правило пропускается'}`;
  console.log(A.row(tag, r, base));
  out.push({ tag, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m, sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med });
}
console.log('\nлучшие 10:'); for (const o of [...out].sort((a, b) => b.d - a.d).slice(0, 10)) console.log(`${o.pass ? '✔' : '·'} ${o.d.toFixed(3)} 100н ${o.n100.toFixed(0)} ${o.bw.join('/')} дно ${o.m.buyAbove90.toFixed(0)}/${o.m.zone15.toFixed(0)}/${o.m.bott3.toFixed(0)} | ${o.tag} | ${o.why}`);
A.save(out, process.argv[2] || '/dev/null');
