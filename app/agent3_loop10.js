/* Агент 3, круг 10: обратная сторона C4 — меньше продавать «спокойную» сильную монету (TRX: низкая бета, ровный рост). В круге 2 «бета < b →
   продажи ×0,5» было хуже (−0,04…−0,24), но тогда продажи урезались и в нисходящем тренде монеты. H10a: низкая бета (< 0,8/0,9/1,0) И монета
   сильная (выше своей средней 200 / pair > 1) → продажи ×0,5/×0,75; H10b: только продажи на страхе. База — C4. Запуск: node app/agent3_loop10.js <out.json> > log */
const A = require('./agent3_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.C4), out = [];
console.log(A.HDR); console.log(A.row('C4', base, base));
const rec = (t, S) => { const r = A.ev(G, S); console.log(A.row(t, r, base)); out.push({ tag: t, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m }); };
const isFear = (r) => r.act < 0 && r.conds.some((cd) => cd.ind === 'fng' && cd.v === 52) && !r.conds.some((cd) => cd.ind === 'beta180');
const sells = (r) => r.act < 0 && !r.conds.some((cd) => cd.ind === 'beta180');
for (const b of [0.8, 0.9, 1.0]) for (const [ft, cc] of [['выше средней 200', A.c('sma200', '>', 1)], ['pair > 1', A.c('pair', '>', 1)]]) for (const k of [0.5, 0.75]) for (const [wt, wh] of [['все', sells], ['страх', isFear]])
  rec(`бета < ${b} и ${ft}: продажи (${wt}) ×${k}`, A.scaleC(A.C4, [A.c('beta180', '<', b), cc], 1, k, wh));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
