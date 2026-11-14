/* Агент 4A, круг 5: ступени по времени — не чаще одной покупки резерва в N дней на одном сигнале.
   Гипотеза: правила паники горят десятки дней подряд (#3 — 5791 покупка) и тратят резерв геометрически в первые дни (25% в день →
   за 5 дней ушло 76%). Пауза N дней между покупками одного правила (остальные дни — только взнос) растягивает те же деньги по времени
   на всё дно — «ступени по времени после первого сигнала». Чтобы общий объём не упал, на ступени можно покупать крупнее (×1/×2).
   (b) Возврат на развороте BTC (#13, весь резерв в первый день) — ступенями по дням: 25/50/75% в день, пока разворот держится.
   Индикатор паузы считается только по условиям правила (без кэша): день-ступень = условие выполнено и с прошлой ступени ≥ N дней.
   Критерий (заранее): строгая ✔, доход > +0,03, соседние N в плюсе, дней покупок на дно не меньше. Запуск: node app/agent4a_loop5.js <out.json> */
const A = require('./agent4a_sim.js');
const G = A.groups(), base = A.ev(G, A.W25), out = [];
console.log(A.HDR); console.log(A.row('W25', base, base));
const R = A.W25.rules;
const okAt = (X, conds, j) => conds.every((cd) => { const v = X.ind[cd.ind][j]; return cd.op === '<' ? v < cd.v : v > cd.v; });
function stepFlag(G, key, conds, N) { A.addInd(G, key, (X) => { const f = new Float64Array(X.n); let last = -1e9; for (let j = 0; j < X.n; j++) if (okAt(X, conds, j) && j - last >= N) { f[j] = 1; last = j; } return f; }); }
const run = (tag, S) => { const r = A.ev(G, S); console.log(A.row(tag, r, base)); out.push({ tag, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m, sel: r.sel.med, ex: r.ex.med, rnd: r.rnd.med }); };
const sets = { '#3': [3], '#3,5,9': [3, 5, 9], '#0,2 (капитуляция, вынос)': [0, 2], 'вся паника + #0,2': [0, 2, 3, 4, 5, 6, 9, 10] };
for (const [sn, idx] of Object.entries(sets)) for (const N of [3, 7, 14, 30]) for (const k of [1, 2]) {
  for (const q of idx) stepFlag(G, `st${q}_${N}`, R[q].conds, N);
  const S = { ...A.W25, rules: R.flatMap((r, q) => (!idx.includes(q) ? [r] : [{ act: 1 + Math.min(1, (r.act - 1) * k), conds: [...r.conds, A.c(`st${q}_${N}`, '>', 0.5)] }, { act: 1, conds: r.conds }])) };
  run(`${sn}: ступень раз в ${N} дн, размер ×${k}, иначе взнос`, S);
}
for (const a of [1.25, 1.5, 1.75]) run(`разворот BTC (#13) ${Math.round((a - 1) * 100)}% в день`, { ...A.W25, rules: R.map((r, q) => (q === 13 ? { ...r, act: a } : r)) });
console.log('\nлучшие 12:'); for (const o of [...out].sort((a, b) => b.d - a.d).slice(0, 12)) console.log(`${o.pass ? '✔' : '·'} ${o.d.toFixed(3)} 100н ${o.n100.toFixed(0)} ${o.bw.join('/')} дно ${o.m.buyAbove90.toFixed(0)}/${o.m.zone15.toFixed(0)}/${o.m.bott3.toFixed(0)}/${o.m.buysPerBottom.toFixed(1)} | ${o.tag} | ${o.why}`);
A.save(out, process.argv[2] || '/dev/null');
