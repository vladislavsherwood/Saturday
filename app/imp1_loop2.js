/* imp1, круг 2. Гипотеза (заранее): возврат частями на подтверждениях. В первый день эпизода разворота (BTC +20% за 30 дней) покупается
   доля a резерва, остальной резерв — только если BTC продолжил рост: выше закрытия дня начала эпизода на x% в течение D дней
   (вредные 2022-03, 2023-03, 2026-08 угасли сразу, полезные 2019-04, 2021-07, 2024-02, 2024-11 продолжились). Режим 'day' — доля a только
   в первый день, дальше держим; 'each' — доля a в каждый день импульса до подтверждения. Критерий: доход > +0,05 на плато (2 соседних x и a),
   строгая ✔, «выше 90-дн. минимума» ниже. Запуск: node app/imp1_loop2.js */
const K = require('./imp1_sim.js');
const G = K.groups(['sel', 'ex', 'rnd']); K.prep(G); K.prepEp(G); for (const x of [5, 10, 15, 25]) for (const D of [60, 120]) K.prepX(G, x, D);
const base = K.ev(G, K.S0, true);
console.log(K.HDR); console.log(K.show('основа', base, base));
const c = K.c;
function V(a, x, D, mode) {
  const S = K.mapRev(K.S0, (r) => [
    { act: 2, conds: [...r.conds, c('epr', '>', x)] },
    { act: 1 + a, conds: mode === 'day' ? [...r.conds, c('epd', '<', 0.5)] : [...r.conds] },
    { act: 1, conds: [...r.conds] }]);
  // отдельное подтверждение (один день — первый, когда BTC выше начала эпизода на x%, не позже D дней): сразу после последнего правила разворота
  const R = [...S.rules], k = R.map((r) => K.isRev(r)).lastIndexOf(true);
  R.splice(k + 1, 0, { act: 2, conds: [c(`epx${x}_${D}`, '>', 0.5)] });
  return { ...S, rules: R };
}
for (const mode of ['day', 'each']) for (const D of [60, 120]) for (const a of [0.25, 0.5, 0.75]) for (const x of [5, 10, 15, 25]) {
  const r = K.ev(G, V(a, x, D, mode), true);
  console.log(K.show(`${mode} a=${a} x=${x} D=${D}`, r, base) + (K.passes(r, base) ? '' : '  ✘ ' + K.why(r, base)));
}
