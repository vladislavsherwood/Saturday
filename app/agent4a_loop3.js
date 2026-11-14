/* Агент 4A, круг 3: размер покупки на панике по числу совпавших признаков дна цикла.
   Гипотеза: круг 2 показал, что резерв лучше держать для паники, чем тратить в «зоне» по дням. Значит, переносить деньги надо внутри
   самой паники: ранние паники медвежьего рынка (признаков цикла нет) — меньше, глубокие (botm ≥ k из 4: TVL −59%, стейблы > 6,5%,
   BTC −57,5%, MVRV < 1,3; или MVRV < v) — крупнее. В отличие от лесенки по btcath (агент 1, подгонка) — независимые признаки разной природы.
   Размер: доля покупки резерва ×w без совпадения, ×s при совпадении (не больше 100%). Наборы: #3,5,9 (паника с выносом) и вся паника.
   Критерий (заранее): строгая ✔, доход > +0,03, соседние k/v и размеры в плюсе, в зоне > 13%. Запуск: node app/agent4a_loop3.js <out.json> */
const A = require('./agent4a_sim.js');
const G = A.groups(), base = A.ev(G, A.W25), out = [];
console.log(A.HDR); console.log(A.row('W25', base, base));
const R = A.W25.rules;
const sets = { '#3,5,9': [3, 5, 9], 'вся паника': [3, 4, 5, 6, 9, 10] };
const Z = [];
for (const k of [1, 2, 3]) Z.push([`botm ≥ ${k}`, A.c('botm', '>', k - 0.5)]);
for (const v of [1, 1.3, 1.6]) Z.push([`MVRV < ${v}`, A.c('mvrv', '<', v)]);
const W = [[0.5, 1], [0.5, 1.5], [0.5, 2], [0.75, 1.5], [1, 1.5], [1, 2]];
for (const [sn, idx] of Object.entries(sets)) for (const [zn, zc] of Z) for (const [w, s] of W) {
  const S = { ...A.W25, rules: R.flatMap((r, q) => (!idx.includes(q) ? [r] : [{ act: 1 + Math.min(1, (r.act - 1) * s), conds: [...r.conds, zc] }, { act: 1 + (r.act - 1) * w, conds: r.conds }])) };
  const r = A.ev(G, S), tag = `${sn}: ${zn} → ×${s}, иначе ×${w}`;
  console.log(A.row(tag, r, base));
  out.push({ tag, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m, sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med });
}
console.log('\nлучшие 12:'); for (const o of [...out].sort((a, b) => b.d - a.d).slice(0, 12)) console.log(`${o.pass ? '✔' : '·'} ${o.d.toFixed(3)} 100н ${o.n100.toFixed(0)} ${o.bw.join('/')} дно ${o.m.buyAbove90.toFixed(0)}/${o.m.zone15.toFixed(0)}/${o.m.bott3.toFixed(0)} | ${o.tag} | ${o.why}`);
console.log('\nпрошли строгую:'); for (const o of out.filter((o) => o.pass).sort((a, b) => b.d - a.d)) console.log(`${o.d.toFixed(3)} 100н ${o.n100.toFixed(0)} ${o.bw.join('/')} дно ${o.m.buyAbove90.toFixed(0)}/${o.m.zone15.toFixed(0)}/${o.m.bott3.toFixed(0)} | ${o.tag}`);
A.save(out, process.argv[2] || '/dev/null');
