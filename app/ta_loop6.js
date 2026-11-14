/* Агент ТА, круг 6: продажа на «вершине-выбросе» (blow-off top) по недельному RSI монеты и медвежьему расхождению — новое правило (в).
   Гипотеза (заранее): пропущенные крупные вершины типа (б) у агента 4B — у максимума BTC при жадности 70–90 без тихой вершины (BONK, FARTCOIN 2025-07,
   NPC/RGT 2024-11) — это вершины-выбросы самой монеты: недельный RSI > 80/85 (перекупленность на недельном таймфрейме, а не дневном, как у агента 1)
   и подтверждение разворота на дневке: медвежье расхождение RSI (новый 30-дн. максимум цены при RSI ниже прошлого максимума на 5+) или
   длинная верхняя тень (> 0,5) при объёме > 1,5 × среднего. Правило «вершина-выброс → продать 5/10%» стоит перед правилами разворота BTC
   (в такой день продаём, а не покупаем) — или в конце списка. Сравнение: только недельный RSI (без подтверждения) → 2/5%.
   Критерий общий + пропущено крупных вершин меньше основы (7%). Запуск: node app/ta_loop6.js <out.json> > log */
const T = require('./ta_sim.js');
const { c } = T;
const G = T.load();
const base = T.ev(G, T.BASE), out = [];
const run = (t, S) => { const r = T.ev(G, S); out.push({ t, d: T.K.d(r, base), pass: T.K.passes(r, base), n100: r.n100.med, n100pos: r.n100.pos, n100h: r.n100.hpos, bw: T.K.bw(r, base, 'n100'), m: r.m }); console.log(T.rowS(t, r, base)); return r; };
console.log(T.K.HDR); console.log(T.rowS('основа', base, base));
for (const g in G) for (const X of G[g]) { const I = X.ind, a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = I.t_uwick[i] > 0.5 && I.vol && I.vol[i] > 1.5 ? 1 : 0; I.t_shoot = a; }
const iRev = T.BASE.rules.findIndex(T.isRev);
const ins = (S, rule, at) => { const R = [...S.rules]; R.splice(at === 'end' ? R.length : iRev, 0, rule); return { ...S, rules: R }; };
for (const w of [75, 80, 85]) {
  for (const s of [0.05, 0.1]) {
    run(`нед. RSI > ${w} + медвежье расхождение → продать ${s * 100}%`, ins(T.BASE, { act: -s, conds: [c('t_wrsi', '>', w), c('t_bdvg', '>', 0.5)] }));
    run(`нед. RSI > ${w} + верхняя тень с объёмом → продать ${s * 100}%`, ins(T.BASE, { act: -s, conds: [c('t_wrsi', '>', w), c('t_shoot', '>', 0.5)] }));
  }
  run(`нед. RSI > ${w} → продать 2% (каждый день)`, ins(T.BASE, { act: -0.02, conds: [c('t_wrsi', '>', w)] }));
  run(`нед. RSI > ${w} + расхождение → 10%, в конце списка`, ins(T.BASE, { act: -0.1, conds: [c('t_wrsi', '>', w), c('t_bdvg', '>', 0.5)] }, 'end'));
}
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out));
