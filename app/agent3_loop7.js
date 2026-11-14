/* Агент 3, круг 7: продавать ближе к вершине и не пропускать вершины — разовые продажи на ПЕРВОМ дне перегрева (не каждый день, как у агента 1).
   H7a: лесенка фиксации на росте самой монеты: рост от 90-дн. минимума впервые за 60 дней > 100% / 200% / 400% → продать x% (каждая ступень раз);
   H7b: то же, только у высокобетовой монеты (бета > 1,2) или при жадности рынка > 60;
   H7c: перегрев рынка: MVRV BTC впервые за 60 дней > 3 / 3,5; BTC выше своей средней 200 в 2 / 2,4 раза (Майер) → продать x%.
   Место правила: перед разворотом BTC (после продаж на страхе) или в конце. База — C4. Критерий: строгая проверка к C4 + доход > +0,03 + плато.
   Запуск: node app/agent3_loop7.js <out.json> > log */
const A = require('./agent3_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.C4), out = [];
console.log(A.HDR); console.log(A.row('C4', base, base));
// «впервые за cool дней»: условие сегодня есть, а в предыдущие cool дней его не было
const edgeOf = (X, f, cool) => { const a = new Float64Array(X.n); let last = -1e9; for (let i = 0; i < X.n; i++) { const on = f(i); if (on && i - last > cool) a[i] = 1; if (on) last = i; } return a; };
const POS = { 'перед разворотом': (S) => S.rules.findIndex((r) => r.act === 2 && r.conds.length === 1 && r.conds[0].ind === 'btcr30'), 'в конце': (S) => S.rules.length };
const rec = (t, S) => { const r = A.ev(G, S); console.log(A.row(t, r, base)); out.push({ tag: t, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m }); };
const ins = (S, pos, rules) => { const p = POS[pos](S), R = [...S.rules]; R.splice(p, 0, ...rules); return { ...S, rules: R }; };
// H7a/H7b: лесенка по росту от 90-дн. минимума
for (const u of [100, 200, 400]) A.addInd(G, `pu${u}`, (X) => edgeOf(X, (i) => X.ind.up90[i] > u, 60));
const LAD = { '100/200/400%': [100, 200, 400], '200/400%': [200, 400], '400%': [400], '100%': [100] };
for (const lad in LAD) for (const x of [0.1, 0.2, 0.3]) for (const pos in POS) for (const [ft, extra] of [['', []], [' и бета > 1,2', [A.c('beta180', '>', 1.2)]], [' и жадность > 60', [A.c('fng', '>', 60)]]]) {
  const rules = LAD[lad].slice().reverse().map((u) => ({ act: -x, conds: [A.c(`pu${u}`, '>', 0.5), ...extra] }));
  rec(`H7 рост от 90-дн. мин. ${lad}${ft}: продать ${x * 100}%, ${pos}`, ins(A.C4, pos, rules));
}
// H7c: перегрев рынка
A.addInd(G, 'mv3', (X) => edgeOf(X, (i) => X.ind.mvrv[i] > 3, 60)); A.addInd(G, 'mv35', (X) => edgeOf(X, (i) => X.ind.mvrv[i] > 3.5, 60));
A.addInd(G, 'my2', (X) => edgeOf(X, (i) => X.ind.bsma200[i] > 2, 60)); A.addInd(G, 'my24', (X) => edgeOf(X, (i) => X.ind.bsma200[i] > 2.4, 60));
for (const [ft, key] of [['MVRV > 3', 'mv3'], ['MVRV > 3,5', 'mv35'], ['BTC > 2× средней 200', 'my2'], ['BTC > 2,4× средней 200', 'my24']]) for (const x of [0.1, 0.2, 0.3]) for (const pos in POS)
  rec(`H7c ${ft} (впервые за 60 дн): продать ${x * 100}%, ${pos}`, ins(A.C4, pos, [{ act: -x, conds: [A.c(key, '>', 0.5)] }]));
fs.writeFileSync(process.argv[2], JSON.stringify(out));
