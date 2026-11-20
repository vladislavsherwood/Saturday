/* h1: фандинг BTC по годам (fund7 — сумма за 7 дн, %): средний годовой доход шорта перпа, доля дней с отрицательным фандингом, худшая неделя; векселя для сравнения */
const H = require('./h1_lib.js');
const X = H.G.sel.find((x) => x.name === 'BTC'), I = X.ind, by = {};
for (let i = 0; i < X.n; i++) { const f = I.fund7[i]; if (!isFinite(f)) continue; const y = H.year(I.t[i]); (by[y] = by[y] || []).push(f); }
for (const y of Object.keys(by)) { const a = by[y], m = a.reduce((s, x) => s + x, 0) / a.length; console.log(`${y}: фандинг ${(m / 7 * 365).toFixed(1)}% годовых, недель с минусом ${(100 * a.filter((x) => x < 0).length / a.length).toFixed(0)}%, худшая неделя ${Math.min(...a).toFixed(2)}%, лучшая ${Math.max(...a).toFixed(2)}% | векселя ${H.TB[y]}%`); }
