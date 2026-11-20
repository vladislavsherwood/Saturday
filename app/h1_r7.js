/* h1, круг 7: финальная проверка кандидата «доход на резерв» — реальная кривая (векселя), доход на весь резерв и только на свободную от заявок фитилей часть (спот);
   100 новых, половины, соседи по ставке, доля резерва. Запуск: node h1_r7.js */
const H = require('./h1_lib.js');
H.head();
const fix = (a) => () => a / 100 / 365;
H.ev('W + векселя (весь резерв)', H.mk(H.yTB(1)), { n100: true });
H.ev('W + векселя, только свободная часть', H.mk(H.yFree(H.tbd)), { n100: true });
H.ev('W + 4,5%, только свободная часть', H.mk(H.yFree(fix(4.5))), { n100: true });
H.ev('W + 3%, только свободная часть', H.mk(H.yFree(fix(3))));
H.ev('W + векселя − 1%, весь резерв', H.mk(H.yTB(1, -1)));
H.ev('W + векселя × 0,25 (≈ свободная четверть)', H.mk(H.yTB(0.25)));
H.ev('C + векселя (без фитилей: весь резерв свободен)', H.mk(H.yTB(1), H.polC), { n100: true });
// сколько резерва свободно от заявок в среднем
{ const { P, G, S57 } = H; let a = [], b = []; for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) { const h = H.yFree(H.tbd), s = {}; const pol = H.mk({ grow: (X_, i) => h.grow(X_, i, s), end: (c) => { const r = h.end({ ...c, s }); if (c.cash > 0 && c.i > 60) { a.push(s.lock / c.cash); } return r; } }); P.edge(X, S57, 0, 'full', false, pol); }
  a.sort((x, y) => x - y); console.log(`доля резерва под заявками фитилей (дни-монеты, 81 монета): медиана ${(100 * a[a.length >> 1]).toFixed(0)}%, среднее ${(100 * a.reduce((t, x) => t + x, 0) / a.length).toFixed(0)}%`); }
