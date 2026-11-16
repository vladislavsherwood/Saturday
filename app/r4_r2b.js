/* r4, круг 2 (продолжение): откуда обрыв. Лесенка с долей × 0,25 теряет почти столько же, сколько полная доля → дело не в деньгах, а в порядке правил:
   «первое подходящее» — день паники заслоняет продажи на страхе (fng < 52/40 и usdtd < 7,6) и разворот BTC (btcr30 > 20 → весь резерв).
   Порог othd переключает день между «купить» и «продать на страхе». Гипотеза: нейтральная буферная зона (usdt > 1,07 и 25 ≤ othd < B → только взнос / или пропуск к развороту)
   уменьшит чувствительность к сдвигу порога, не ухудшив итог. Критерий — как в r4_r2.js. Запуск: node r4_r2b.js */
const L = require('./r4_lib.js'), { S0, c } = L;
const txt = (r) => r.act + ' ' + r.conds.map((x) => x.ind + x.op + x.v).join(' & ');
const idx = (S, pred) => S.rules.findIndex(pred);
// что срабатывает в дни usdt>1.07 по зонам othd (BTC и медианный альт — счёт дней по правилам)
{ const P = L.P, X = L.G.sel.find((x) => x.name === 'ETH'), I = X.ind; const R = S0.rules.filter((r) => r.conds.every((cd) => I[cd.ind]));
  const dec = (j) => R.findIndex((r) => r.conds.every((cd) => (cd.op === '<' ? I[cd.ind][j] < cd.v : I[cd.ind][j] > cd.v)));
  const z = {}; for (let j = 0; j < X.n; j++) if (I.usdt[j] > 1.07 && isFinite(I.othd[j]) && L.day(X.t[j]) > '2019') { const zone = I.othd[j] < 23.75 ? 'A' : I.othd[j] < 25 ? 'B' : I.othd[j] < 27.5 ? 'C' : I.othd[j] < 30 ? 'D' : 'E'; const q = dec(j); const k = q < 0 ? 'взнос' : txt(R[q]).slice(0, 40); z[zone] = z[zone] || {}; z[zone][k] = (z[zone][k] || 0) + 1; }
  for (const k of Object.keys(z).sort()) console.log('ETH зона', k, JSON.stringify(z[k])); }
// буфер: после правил паники (перед охраной) — «usdt > 1,07 и othd < B → только взнос»
const buf = (B, S = S0) => { const T = L.clone(S); const i = idx(T, (r) => r.act === 1); T.rules.splice(i, 0, { act: 1, conds: [c('usdt', '>', 1.07), c('othd', '<', B)] }); return T; };
// буфер только от продаж: вставить после разворота BTC (btcr30 > 20 → 2), т. е. разворот не заслоняется
const bufS = (B, S = S0) => { const T = L.clone(S); const i = idx(T, (r) => r.act === 2 && r.conds.length === 1 && r.conds[0].ind === 'btcr30'); T.rules.splice(i + 1, 0, { act: 1, conds: [c('usdt', '>', 1.07), c('othd', '<', B)] }); return T; };
console.log('— буфер (только взнос) перед охраной —'); for (const B of [26.25, 27.5, 30, 100]) L.run(`буфер othd < ${B}`, buf(B));
console.log('— буфер только от продаж (после разворота BTC) —'); for (const B of [26.25, 27.5, 30, 100]) L.run(`буфер продаж othd < ${B}`, bufS(B));
console.log('— чувствительность: все пороги othd × f —');
for (const [nm, S] of [['combo4', S0], ['буфер 27,5', buf(27.5)], ['буфер продаж 27,5', bufS(27.5)], ['буфер продаж 30', bufS(30)]]) { const b = L.income(S); console.log(nm.padEnd(22), [0.9, 0.95, 0.98, 1.02, 1.05, 1.1].map((f) => `×${f} ${L.sg(L.income(L.shift(S, 'othd', (v) => v * f)) - b)}`).join('  ')); }
module.exports = { buf, bufS };
// буфер только от продаж на страхе: «usdt > 1,07, othd < B, btcr30 < 20 → только взнос» перед охраной (разворот BTC и охрана не заслоняются)
const buf2 = (B, S = S0) => { const T = L.clone(S); const i = idx(T, (r) => r.act === 1); T.rules.splice(i, 0, { act: 1, conds: [c('usdt', '>', 1.07), c('othd', '<', B), c('btcr30', '<', 20)] }); return T; };
console.log('— буфер от продаж на страхе (разворот BTC не заслоняется) —'); for (const B of [26.25, 27.5, 30]) L.run(`буфер страха othd < ${B}`, buf2(B));
{ const S = buf2(27.5), b = L.income(S); console.log('буфер страха 27,5'.padEnd(22), [0.9, 0.95, 0.98, 1.02, 1.05, 1.1].map((f) => `×${f} ${L.sg(L.income(L.shift(S, 'othd', (v) => v * f)) - b)}`).join('  ')); }
