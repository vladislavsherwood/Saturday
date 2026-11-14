/* imp1, круг 1. Гипотеза (заранее): разворот BTC (+20% за 30 дней) в «молодом медвежьем рынке» — через D1…D2 дней после максимума BTC —
   это медвежье ралли (2018-04, 2018-07, 2021-10, 2022-03, 2026-08 — все плохие), и покупать там весь резерв дорого. Замена «весь резерв»
   на «только взнос» (или часть a) в окне D1 < bdays < D2 даст доход > +0,05 к основе на плато соседних окон, строгая проверка ✔,
   и снизит «выше 90-дн. минимума». Запуск: node app/imp1_loop1.js */
const K = require('./imp1_sim.js');
const G = K.groups(['sel', 'ex', 'rnd']); K.prep(G); K.prep1(G);
const base = K.ev(G, K.S0, true);
console.log(K.HDR); console.log(K.show('основа', base, base));
const c = K.c;
const win = (D1, D2, a) => K.mapRev(K.S0, (r) => [{ act: a, conds: [...r.conds, c('bdays', '>', D1), c('bdays', '<', D2)] }, r]);
const out = [];
for (const a of [1, 1.25, 1.5]) for (const D1 of [30, 60, 90, 120]) for (const D2 of [300, 365, 450, 540]) {
  const r = K.ev(G, win(D1, D2, a), true); const t = `окно ${D1}…${D2} дн, доля ${a}`;
  console.log(K.show(t, r, base) + (K.passes(r, base) ? '' : '  ✘ ' + K.why(r, base)));
  out.push({ t, d: K.d(r, base), pass: K.passes(r, base) });
}
