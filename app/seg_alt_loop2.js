/* Агент «АЛЬТЫ», круг 2: плато и форма «тихая вершина крупнее у альтов».
   Гипотеза (заранее): выигрыш — продажи альтов в начале альтсезона (BTC у максимума, доля альтов растёт); плато ×1,25…×2 по размеру,
   держится и на узкой, и на широкой ступени; фильтр «монета не в собственном росте» (rel180 или rel90 < 0) уберёт провал XMR 2022–26
   на экзамене; то же правило на всех монетах вредит крупным и мемам (значит, правило — только для альтов).
   Запуск: node app/seg_alt_loop2.js <out.json> */
const Q = require('./seg_alt_sim.js');
const fs = require('fs');
const { c } = Q;
const G = Q.load(); Q.addAltFlag(G);
const B = Q.BASE, rb = Q.evs(G, B);
const QT = [21, 22, 23, 24], NARROW = [21, 22], WIDE = [23, 24];
const sc = (r, k) => Math.max(-1, +(r.act * k).toFixed(6));
// копия правил qs с размером ×k и условиями extra перед исходным
const up = (S, qs, k, extra) => ({ ...S, rules: S.rules.flatMap((r, q) => (qs.includes(q) ? [{ act: sc(r, k), conds: [...r.conds, ...extra] }, r] : [r])) });
const ALT = [c('isalt', '>', 0.5)];
const L = [];
for (const k of [1.25, 1.5, 1.75, 2]) {
  L.push([`альты: вся тихая вершина ×${k}`, up(B, QT, k, ALT)]);
  L.push([`альты: только широкая ×${k}`, up(B, WIDE, k, ALT)]);
  L.push([`альты: только узкая ×${k}`, up(B, NARROW, k, ALT)]);
  L.push([`ВСЕ монеты: вся тихая вершина ×${k}`, up(B, QT, k, [])]);
}
for (const k of [1.5, 2]) for (const [nm, f] of [['rel180<0', [c('rel180', '<', 0)]], ['rel90<0', [c('rel90', '<', 0)]], ['rel180<50', [c('rel180', '<', 50)]], ['sma200<1.2', [c('sma200', '<', 1.2)]], ['up90<100', [c('up90', '<', 100)]]]) {
  L.push([`альты + ${nm}: вся ×${k}`, up(B, QT, k, [...ALT, ...f])]);
  L.push([`ВСЕ + ${nm}: вся ×${k}`, up(B, QT, k, f)]);
}
// группа по поведению вместо списка: бета/корреляция/волатильность
for (const k of [1.5]) for (const [nm, f] of [['beta180>0.8', [c('beta180', '>', 0.8)]], ['corr180<0.7', [c('corr180', '<', 0.7)]], ['vol180>70', [c('vol180', '>', 70)]], ['rdd365>50', [c('rdd365', '>', 50)]]]) L.push([`ВСЕ + ${nm}: вся ×${k}`, up(B, QT, k, f)]);
const out = [];
for (const [t, S] of L) { const r = Q.evs(G, S); console.log(Q.row(t, r, rb)); out.push({ t, ...Q.pack(r, rb) }); }
fs.writeFileSync(process.argv[2], JSON.stringify(out));
