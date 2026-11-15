/* imp1, круг 3. Гипотеза (заранее): разворот общий для рынка (BTC +20% за 30 дней), но каждая монета встречает его в своём месте.
   Если монета к дню разворота уже далеко ушла от своего дна (рост от 90-дн. минимума up90 > X, собственный рост за 30 дней r30 > X,
   опережение BTC за 30 дней rel30 > X) — покупка резерва идёт по «выстрелившей» цене, и часть резерва лучше придержать (взнос или 50%).
   Обратная проверка — отстающие (rel30 < X, просадка монеты от 365-дн. максимума dd365 > X). Критерий: доход > +0,05 на 2 соседних порогах,
   строгая ✔, «выше 90-дн. минимума» ниже. Запуск: node app/imp1_loop3.js */
const K = require('./imp1_sim.js');
const G = K.groups(['sel', 'ex', 'rnd']);
const base = K.ev(G, K.S0, true);
console.log(K.HDR); console.log(K.show('основа', base, base));
const c = K.c;
const F = [];
for (const x of [50, 100, 200, 300]) F.push([`up90 > ${x}`, [c('up90', '>', x)]]);
for (const x of [30, 60, 100]) F.push([`r30 > ${x}`, [c('r30', '>', x)]]);
for (const x of [0, 20, 50]) F.push([`rel30 > ${x}`, [c('rel30', '>', x)]]);
for (const x of [-30, -15, 0]) F.push([`rel30 < ${x}`, [c('rel30', '<', x)]]);
for (const x of [50, 70, 85]) F.push([`dd365 > ${x}`, [c('dd365', '>', x)]]);
for (const x of [20, 35]) F.push([`dd365 < ${x}`, [c('dd365', '<', x)]]);
for (const [t, cs] of F) for (const a of [1, 1.5]) {
  const S = K.mapRev(K.S0, (r) => [{ act: a, conds: [...r.conds, ...cs] }, r]);
  const r = K.ev(G, S, true);
  console.log(K.show(`${t} → ${a === 1 ? 'взнос' : '50%'}`, r, base) + (K.passes(r, base) ? '' : '  ✘ ' + K.why(r, base)));
}
