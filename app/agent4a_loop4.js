/* Агент 4A, круг 4: признаки «дно ещё впереди» в дни паники — беречь резерв.
   Разбор дней покупок #3,5,9 (app/agent4a_ev4.js, 9556 покупок на 81 монете) показал, что дальше всего от дна и хуже всего через
   180 дней покупки: (F1) в первые ~2 месяца после максимума BTC (молодой медвежий рынок, btcdays — дней с максимума BTC): 44% над мин90,
   −24% через 180 дн; (F2) когда паника держится больше 30 дней подряд (panicd): 62% и −32%; (F3) толпа в лонгах во время паники (lsr > 1,28):
   −13% против +32% при толпе в шортах; (F4) слабая паника (usdt < 1,13): −15% против +196% у сильной; (F5) доминация BTC за 90 дней падает.
   Гипотеза: в такие дни крупные покупки паники заменить взносом (резерв ждёт второй волны) или уменьшить вдвое.
   Критерий (заранее): строгая ✔, доход > +0,03, соседние пороги в плюсе. Запуск: node app/agent4a_loop4.js <out.json> */
const A = require('./agent4a_sim.js');
const G = A.groups(), base = A.ev(G, A.W25), out = [];
console.log(A.HDR); console.log(A.row('W25', base, base));
const R = A.W25.rules, idx = [3, 5, 9];
const F = [];
for (const v of [30, 60, 90, 120]) F.push([`молодой медвежий рынок: < ${v} дн с максимума BTC`, A.c('btcdays', '<', v)]);
for (const v of [20, 30, 45, 60]) F.push([`паника дольше ${v} дн`, A.c('panicd', '>', v)]);
for (const v of [1.2, 1.3, 1.4]) F.push([`толпа в лонгах lsr > ${v}`, A.c('lsr', '>', v)]);
for (const v of [1.1, 1.12, 1.14]) F.push([`слабая паника usdt < ${v}`, A.c('usdt', '<', v)]);
for (const v of [-1, 0, 1]) F.push([`доминация BTC за 90 дн < ${v} п.п.`, A.c('btcd90', '<', v)]);
for (const [fn, fc] of F) for (const k of [0, 0.5]) {
  const S = { ...A.W25, rules: R.flatMap((r, q) => (!idx.includes(q) ? [r] : [{ act: 1 + (r.act - 1) * k, conds: [...r.conds, fc] }, r])) };
  const r = A.ev(G, S), tag = `${fn} → ${k ? 'покупка ×0,5' : 'только взнос'}`;
  console.log(A.row(tag, r, base));
  out.push({ tag, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m, sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med });
}
console.log('\nлучшие 12:'); for (const o of [...out].sort((a, b) => b.d - a.d).slice(0, 12)) console.log(`${o.pass ? '✔' : '·'} ${o.d.toFixed(3)} 100н ${o.n100.toFixed(0)} ${o.bw.join('/')} дно ${o.m.buyAbove90.toFixed(0)}/${o.m.zone15.toFixed(0)}/${o.m.bott3.toFixed(0)} | ${o.tag} | ${o.why}`);
A.save(out, process.argv[2] || '/dev/null');
