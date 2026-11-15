/* Круг 1: лесенка по глубине падения от старта эпизода паники (без долга, правила-копии).
   Для каждого правила паники: pdrop > d → доля × hi; иначе доля × lo. Запуск: node panicx_r1.js */
const P = require('./panicx_sim.js'), { c } = P.Z;
const sc = (r, k) => +(1 + Math.min(1, (r.act - 1) * k)).toFixed(6);
const L = (ind, d, lo, hi) => P.mapP((r) => [{ act: sc(r, hi), conds: [...r.conds, c(ind, '>', d)] }, { act: sc(r, lo), conds: r.conds }]);
P.report('основа', P.base, null);
for (const ind of ['pdrop', 'bdrop']) for (const d of [5, 10, 15]) for (const [lo, hi] of [[0.5, 1], [0.7, 1], [0.5, 1.5], [0.7, 1.5], [1, 1.5], [1, 2]]) P.report(`${ind}>${d} lo${lo} hi${hi}`, L(ind, d, lo, hi), null);
