/* Агент 4A, круг 2: «зона глубокой стоимости» — мелкие ежедневные покупки резерва внутри зоны дна.
   Гипотеза: признаки цикла (MVRV биткоина < 1 — рынок ниже средней цены покупки; botm — сколько из 4 признаков дна горит: TVL −59%,
   доля стейблов > 6,5%, BTC −57,5% от максимума, MVRV < 1,3) отмечают зону дна на месяцы. Покупка 3/5/10% резерва каждый день в зоне
   размазывает резерв по дну по построению (доля от остатка — геометрическая лесенка), а не тратит его на одном сигнале.
   Место правила: перед продажами на страхе (в зоне дна не продаём, а покупаем) или в конце списка (только в «пустые» дни).
   Критерий (заранее): строгая ✔, доход > +0,03, соседние пороги/размеры в плюсе, метрики дна лучше W25 (в зоне > 13%).
   Запуск: node app/agent4a_loop2.js <out.json> */
const A = require('./agent4a_sim.js');
const G = A.groups(), base = A.ev(G, A.W25), out = [];
console.log(A.HDR); console.log(A.row('W25', base, base));
const R = A.W25.rules, iSell = R.findIndex((r) => r.act < 0);
const Z = [];
for (const v of [0.9, 1, 1.1, 1.2]) Z.push([`MVRV < ${v}`, [A.c('mvrv', '<', v)]]);
for (const v of [3, 4]) Z.push([`botm ≥ ${v}`, [A.c('botm', '>', v - 0.5)]]);
for (const [zn, zc] of Z) for (const f of [0.03, 0.05, 0.1]) for (const pos of ['перед продажами', 'в конце']) {
  const S = A.addRule(A.W25, { act: 1 + f, conds: zc }, pos === 'в конце' ? 'end' : iSell);
  const r = A.ev(G, S), tag = `${zn} → ${f * 100}% каждый день, ${pos}`;
  console.log(A.row(tag, r, base));
  out.push({ tag, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m, sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med });
}
console.log('\nлучшие 10:'); for (const o of [...out].sort((a, b) => b.d - a.d).slice(0, 10)) console.log(`${o.pass ? '✔' : '·'} ${o.d.toFixed(3)} 100н ${o.n100.toFixed(0)} ${o.bw.join('/')} дно ${o.m.buyAbove90.toFixed(0)}/${o.m.zone15.toFixed(0)}/${o.m.bott3.toFixed(0)} | ${o.tag} | ${o.why}`);
A.save(out, process.argv[2] || '/dev/null');
