/* h4, круг 7 (финал): кандидат «вход после дна» — A75 / A70, U15, f 0,1, первым правилом.
   Против combo4 + фитили и против combo4; 100 новых; сдвиг исполнения 2 дня; медианы годового прироста ln(V/DCA) и «действий года» 2018–2026 (81 и 100 новых).
   Запуск: node h4_r7.js */
const H = require('./h4_lib.js'), { L, S57, polW, c, G, P } = H;
const rule = (A) => ({ act: 1.1, conds: [c('btcath', '>', A), c('btcup90', '>', 15), c('btc200', '<', 1)] });
const C75 = H.insertAt(S57, 1, [rule(75)]), C70 = H.insertAt(S57, 1, [rule(70)]);
console.log('— к основе combo4 + фитили');
H.setBase(S57, polW);
H.run('combo4 + фитили (основа)', S57, polW, { n100: true });
H.run('кандидат A75 (+ фитили)', C75, polW, { n100: true });
H.run('вариант A70 (+ фитили)', C70, polW, { n100: true });
console.log('— к combo4 (без фитилей)');
H.setBase(S57, L.pol0);
H.run('combo4 + фитили', S57, polW, { n100: true });
H.run('кандидат A75 (+ фитили)', C75, polW, { n100: true });
H.run('вариант A70 (+ фитили)', C70, polW, { n100: true });
H.run('A75 без фитилей', C75, L.pol0, { n100: true });
// сдвиг исполнения 2 дня (решение по вчерашнему дню, исполнение через 2 дня): доход к основе при том же сдвиге
const incL = (S, pol, lags) => L.Z.inc(L.Z.sum(L.evLag(S, pol, lags)), 'all');
for (const lags of [[0], [1], [2], [3]]) { const b = incL(S57, polW, lags); console.log(`сдвиг ${lags}: A75 ${H.sg(incL(C75, polW, lags) - b, 3)}  A70 ${H.sg(incL(C70, polW, lags) - b, 3)}`); }
// медианы по годам
const med = H.med;
for (const lists of [['sel', 'ex', 'rnd'], ['n100']]) {
  const Y0 = H.years(S57, L.pol0, lists), Yb = H.years(S57, polW, lists), Yc = H.years(C75, polW, lists), Y7 = H.years(C70, polW, lists);
  console.log(`\nмедиана годового прироста ln(V/DCA) / «действий года» (${lists.join('+')}), сдвиг 0:`);
  console.log('год    combo4         + фитили        кандидат A75     вариант A70');
  for (const y of H.YS) { const f = (Y) => { const v = Object.values(Y).filter((r) => r[y]); return `${H.sg(med(v.map((r) => r[y].tot)))} / ${H.sg(med(v.map((r) => r[y].act)))} (${v.filter((r) => r[y].tot < -0.02).length}/${v.length})`; };
    console.log(`${y}  ${f(Y0).padEnd(15)} ${f(Yb).padEnd(15)} ${f(Yc).padEnd(16)} ${f(Y7)}`); }
}
