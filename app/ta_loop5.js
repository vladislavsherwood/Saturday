/* Агент ТА, круг 5: капитуляционная свеча (аномальный объём + длинная нижняя тень + перепроданность) — новое правило (в) и размер паники (б).
   Гипотеза (заранее, из круга 1): покупки в дни с длинной нижней тенью ближе к дну (29% над будущим минимумом против 42% у коротких теней,
   ◆ обе половины). День капитуляции монеты: объём > v × своей 20-дн. средней, нижняя тень > w диапазона дня, RSI14 < 35. Такой день —
   выброс продавцов, после него дно ближе. Формы: (в) новое правило «капитуляция → купить 10/25% резерва» — стоит перед продажами на страхе
   (в день капитуляции не продаём, а покупаем) и после правил паники; (б) в день капитуляции доли паники ×1,5. То же по свече BTC (для всех монет).
   Плато: v = 2/3, w = 0,4/0,6. Критерий общий + доньев с ≥ 3 днями покупок не хуже. Запуск: node app/ta_loop5.js <out.json> > log */
const T = require('./ta_sim.js');
const { c } = T;
const G = T.load();
const base = T.ev(G, T.BASE), out = [];
const run = (t, S) => { const r = T.ev(G, S); out.push({ t, d: T.K.d(r, base), pass: T.K.passes(r, base), n100: r.n100.med, n100pos: r.n100.pos, n100h: r.n100.hpos, bw: T.K.bw(r, base, 'n100'), m: r.m }); console.log(T.rowS(t, r, base)); return r; };
console.log(T.K.HDR); console.log(T.rowS('основа', base, base));
// флаги капитуляции
for (const v of [2, 3]) for (const w of [0.4, 0.6]) {
  const k = `cap${v}_${w * 10}`;
  for (const g in G) for (const X of G[g]) { const I = X.ind, a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = I.vol && I.vol[i] > v && I.t_wick[i] > w && I.t_rsi[i] < 35 ? 1 : 0; I[k] = a; }
  const kb = `bcap${v}_${w * 10}`;
  for (const g in G) for (const X of G[g]) { const I = X.ind, a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) a[i] = I.b_vol[i] > v && I.b_wick[i] > w && I.b_rsi[i] < 35 ? 1 : 0; I[kb] = a; }
}
{ let n = 0, m = 0, mb = 0; for (const X of [...G.sel, ...G.ex, ...G.rnd]) for (let i = 0; i < X.n; i++) { n++; m += X.ind.cap2_4[i]; mb += X.ind.bcap2_4[i]; } console.log(`частота: капитуляция монеты (v2, w0,4) ${(1000 * m / n).toFixed(1)} на 1000 дней, BTC ${(1000 * mb / n).toFixed(1)}`); }
const iFear = T.BASE.rules.findIndex(T.isFearSell);
const ins = (S, rule) => { const R = [...S.rules]; R.splice(iFear, 0, rule); return { ...S, rules: R }; };
const scaleP = (S, conds, k) => T.pre(S, T.isPanic, conds, (r) => 1 + Math.min(1, (r.act - 1) * k));
for (const v of [2, 3]) for (const w of [0.4, 0.6]) {
  const k = `cap${v}_${w * 10}`, kb = `bcap${v}_${w * 10}`;
  for (const a of [1.1, 1.25]) run(`капитуляция монеты (объём > ${v}, тень > ${w}, RSI < 35) → ${Math.round((a - 1) * 100)}% резерва`, ins(T.BASE, { act: a, conds: [c(k, '>', 0.5)] }));
  run(`капитуляция монеты v${v} w${w} → паника ×1,5`, scaleP(T.BASE, [c(k, '>', 0.5)], 1.5));
  run(`капитуляция BTC v${v} w${w} → 10% резерва`, ins(T.BASE, { act: 1.1, conds: [c(kb, '>', 0.5)] }));
}
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out));
