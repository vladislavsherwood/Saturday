/* wk, круг 2: что делать после покупки на фитиле.
   (a) выход: лимит на продажу купленного на фитиле +X% от цены покупки / возврат к опорной цене (лот держится до N дней, потом — обычная позиция);
   (b) связь с отложенной паникой: не тратить долг owed / покупка фитиля гасит долг / без заявок, пока есть долг;
   (c) после крупного фитиля: N дней без новых заявок. Основа круга — B1 = −25/−40/−60 → 10/20/30, раз в 3 дня, once, place.
   Запуск: node wk_r2.js > scratchpad/wk/r2.log */
const W = require('./wk_lib.js'), { ev, pol } = W;
const B1 = { every: 3, once: 1, size: 'place' };
const LV = (m) => [[0.25, 0.1 * m], [0.4, 0.2 * m], [0.6, 0.3 * m]];
W.head();
for (const m of [1, 1.25]) {
  console.log(`=== доли × ${m} ===`);
  ev(`B1 ×${m}`, pol({ ...B1, lv: LV(m) }), { n100: true });
  console.log('— (a) выход из фитильной покупки —');
  for (const up of [0.15, 0.3, 0.5, 1]) ev(`выход +${up * 100}% (держать всегда)`, pol({ ...B1, lv: LV(m), exit: { up } }), { n100: true });
  for (const up of [0.3, 0.5]) for (const days of [30, 90]) ev(`выход +${up * 100}%, лот ${days} дн`, pol({ ...B1, lv: LV(m), exit: { up, days } }), { n100: true });
  ev('выход: возврат к опорной цене', pol({ ...B1, lv: LV(m), exit: { ref: 1 } }), { n100: true });
  ev('выход: возврат к опорной, лот 30 дн', pol({ ...B1, lv: LV(m), exit: { ref: 1, days: 30 } }), { n100: true });
  console.log('— (b) связь с отложенной паникой —');
  for (const pan of ['protect', 'spend', 'off']) ev(`паника: ${pan}`, pol({ ...B1, lv: LV(m), pan }), { n100: true });
  console.log('— (c) после исполнения N дней без заявок —');
  for (const cool of [3, 7, 14, 30, 60]) ev(`пауза ${cool} дн после исполнения`, pol({ ...B1, lv: LV(m), cool }), { n100: true });
}
