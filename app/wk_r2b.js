/* wk, круг 2 (продолжение): выход «возврат к опорной цене» на карте плато (масштаб уровней a × доли m × частота) против того же без выхода.
   Запуск: node wk_r2b.js > scratchpad/wk/r2b.log */
const W = require('./wk_lib.js'), { ev, pol } = W;
const LV = (a, m) => [[0.25, 0.1], [0.4, 0.2], [0.6, 0.3]].map(([k, f]) => [1 - Math.pow(1 - k, a), f * m]);
W.head();
const out = [];
for (const e of [3, 2]) for (const a of [0.9, 1, 1.1]) for (const m of [1, 1.25, 1.5]) {
  const b = ev(`e${e} a${a} m${m} держать`, pol({ every: e, once: 1, size: 'place', lv: LV(a, m) }), { n100: true, w: 30 });
  const x = ev(`e${e} a${a} m${m} выход к опорной`, pol({ every: e, once: 1, size: 'place', lv: LV(a, m), exit: { ref: 1 } }), { n100: true, w: 30 });
  out.push({ e, a, m, d: x.all - b.all, d81: x.m81 - b.m81, dn: x.n - b.n, okb: b.ok, okx: x.ok, nd: [b.nd, x.nd] });
}
for (const o of out) console.log(`e${o.e} a${o.a} m${o.m}: выход − держать: доход ${W.sg(o.d)} | 81 ${W.sg(o.d81)} | 100н ${W.sg(o.dn)} | хуже combo4 в 100н ${o.nd[0]}→${o.nd[1]} | строгая ${o.okb ? '✔' : '✗'}→${o.okx ? '✔' : '✗'}`);
const mn = (k) => out.reduce((t, x) => t + x[k], 0) / out.length;
console.log(`среднее по сетке: доход ${W.sg(mn('d'))} | 81 ${W.sg(mn('d81'))} | 100н ${W.sg(mn('dn'))}; выход лучше по доходу в ${out.filter((x) => x.d > 0).length}/${out.length}, по 81 в ${out.filter((x) => x.d81 > 0).length}, по 100н в ${out.filter((x) => x.dn > 0).length}`);
