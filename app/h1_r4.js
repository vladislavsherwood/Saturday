/* h1, круг 4: потолок резерва относительно позиции — излишек (резерв − k × позиция) тратить по r в день в дни без сигнала, если сигналов не было N дней;
   режим: всегда / бычий (монета и BTC выше 200д). Запуск: node h1_r4.js */
const H = require('./h1_lib.js');
H.head();
const bull = (X, j) => X.ind.sma200[j] > 1 && X.ind.btc200[j] > 1;
for (const when of [null, bull]) for (const N of [0, 30, 90]) for (const k of [0.5, 1, 2]) for (const r of [0.01, 0.03])
  H.ev(`потолок k ${k} r ${r * 100}% N ${N}${when ? ' бык' : ''}`, H.mk(H.cap({ k, r, N, when })));
