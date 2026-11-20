/* h4, круг 6: «вход после дна» — из каких событий выигрыш (окна дат), средний лог по 81 монете, по монетам 2019.
   Правило первым: btcath > A, btcup90 > 15, btc200 < 1 → взнос + 10% резерва; окно: только даты [d0, d1].
   Запуск: node h4_r6.js */
const H = require('./h4_lib.js'), { L, S57, polW, c, G } = H;
L.addInd('h4_t', (X) => Float64Array.from(X.ind.t));
H.setBase(S57, polW);
const T = (s) => Math.round(Date.parse(s) / 864e5);
const mk = (A, f, w) => H.insertAt(S57, 1, [{ act: 1 + f, conds: [c('btcath', '>', A), c('btcup90', '>', 15), c('btc200', '<', 1), ...(w ? [c('h4_t', '>', T(w[0]) - 1), c('h4_t', '<', T(w[1]) + 1)] : [])] }]);
for (const A of [70, 75]) {
  H.run(`A${A} всё`, mk(A, 0.1), polW, { n100: true });
  for (const w of [['2018-12-01', '2019-01-31'], ['2019-02-01', '2019-04-30'], ['2020-03-01', '2020-04-30'], ['2023-01-01', '2023-01-31']]) H.run(`A${A} только ${w[0]}…${w[1]}`, mk(A, 0.1, w), polW, { n100: true });
}
// по монетам: итог к основе (вся история), 2019 — изменение прироста
const r = H.rows.find((x) => x.nm === 'A70 всё').r, { BR } = H.P.baseline();
const out = [];
for (const g of ['sel', 'ex', 'rnd']) r.R[g].forEach((x, i) => { const b = BR[g][i]; out.push([x.name, g, x.seg, L.Z.L1(x.f) - L.Z.L1(b.f), r.Y[x.name] && r.Y[x.name][2019] ? r.Y[x.name][2019].tot : NaN]); });
const Yb = H.years(S57, polW); for (const o of out) if (Yb[o[0]] && Yb[o[0]][2019]) o[4] -= Yb[o[0]][2019].tot; else o[4] = NaN;
console.log('\nA70: монеты с изменением (лог к основе за всю историю; изменение прироста 2019):');
for (const o of out.filter((o) => Math.abs(o[3]) > 0.001).sort((a, b) => b[3] - a[3])) console.log(`  ${o[0].padEnd(9)} ${o[1].padEnd(4)} ${o[2].padEnd(5)} ${H.sg(o[3], 3)}  2019 ${isFinite(o[4]) ? H.sg(o[4], 3) : '—'}`);
