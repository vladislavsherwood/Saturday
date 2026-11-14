/* Агент 3, круг 5: возврат в рынок по другим признакам импульса (не по цене BTC). Порог «BTC +20% за 30 дней» у края обрыва; агент 2
   перебрал ценовые формы (окна, рост от минимума, средние) — все хуже. Здесь — признаки денег и ширины рынка, как ДОПОЛНИТЕЛЬНЫЙ путь возврата:
   H5a отток из стейблов: доля USDT за 30 дней упала > x% и ниже своей средней 200 (usdt < 1);
   H5b «рывок ширины»: доля монет выше средней 200 за 60 дней была < 20…30%, сегодня > 50…60%;
   H5c BTC впервые выше средней 200 после ≥ 120 дней ниже (смена режима), окно 10 дней;
   H5d MVRV BTC за 60 дней был < 1, сегодня > 1,1.
   Покупка 25/50/100% резерва; место правила: перед разворотом BTC (после продаж на страхе) или в конце списка.
   База сравнения — C4 (круг 4). Критерий: строгая проверка к C4 + доход > +0,03 + плато. Запуск: node app/agent3_loop5.js <out.json> > log */
const A = require('./agent3_sim.js');
const fs = require('fs');
const G = A.groups(), base = A.ev(G, A.C4), w25 = A.ev(G, A.W25), out = [];
console.log(A.HDR); console.log(A.row('C4 к W25', base, w25)); console.log(A.row('C4', base, base));
const lag = (a, k, i) => (i >= k ? a[i - k] : NaN);
A.addInd(G, 'usdtd30', (X) => { const a = new Float64Array(X.n), u = X.ind.usdtd; for (let i = 0; i < X.n; i++) a[i] = (u[i] / lag(u, 30, i) - 1) * 100; return a; });
for (const w of [60]) A.addInd(G, 'brmin' + w, (X) => A.rollMin(X.ind.breadth.map((v) => (isNaN(v) ? 1e9 : v)), w));
A.addInd(G, 'mvmin60', (X) => A.rollMin(X.ind.mvrv.map((v) => (isNaN(v) ? 1e9 : v)), 60));
// BTC выше средней 200 впервые после ≥ N дней ниже: сколько дней подряд ниже было до последнего пересечения и сколько дней прошло с пересечения
A.addInd(G, 'bcross', (X) => { const b = X.ind.bsma200, a = new Float64Array(X.n); let below = 0, since = 1e9, lastBelow = 0; for (let i = 0; i < X.n; i++) { if (b[i] < 1) { below++; since = 1e9; } else { if (below > 0) { lastBelow = below; since = 0; } else since++; below = 0; } a[i] = since <= 10 ? lastBelow : 0; } return a; });
const POS = { 'перед разворотом': (S) => S.rules.findIndex((r) => r.act === 2 && r.conds.length === 1 && r.conds[0].ind === 'btcr30'), 'в конце': (S) => S.rules.length };
const H = [];
for (const x of [5, 10, 15]) H.push([`H5a доля USDT за 30 дн < −${x}% и usdt < 1`, [A.c('usdtd30', '<', -x), A.c('usdt', '<', 1)]]);
for (const lo of [20, 30]) for (const hi of [50, 60]) H.push([`H5b ширина за 60 дн < ${lo}%, сейчас > ${hi}%`, [A.c('brmin60', '<', lo), A.c('breadth', '>', hi)]]);
for (const nb of [120, 200]) H.push([`H5c BTC выше средней 200 после ≥ ${nb} дн ниже (10 дн)`, [A.c('bcross', '>', nb)]]);
for (const hi of [1.0, 1.1, 1.2]) H.push([`H5d MVRV за 60 дн < 1, сейчас > ${hi}`, [A.c('mvmin60', '<', 1), A.c('mvrv', '>', hi)]]);
for (const [ht, conds] of H) for (const pos in POS) for (const act of [1.25, 1.5, 2]) {
  const p = POS[pos](A.C4), R = [...A.C4.rules]; R.splice(p, 0, { act, conds }); const S = { ...A.C4, rules: R };
  const r = A.ev(G, S), t = `${ht}: ${(act - 1) * 100}% резерва, ${pos}`;
  console.log(A.row(t, r, base)); out.push({ tag: t, d: A.d(r, base), pass: A.passes(r, base), why: A.why(r, base), n100: r.n100.med, bw: A.bw(r, base, 'n100'), m: r.m });
}
fs.writeFileSync(process.argv[2], JSON.stringify(out));
