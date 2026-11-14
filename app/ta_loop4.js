/* Агент ТА, круг 4: размер продаж на страхе по сжатию/расширению волатильности (полосы Боллинджера, ATR) — ограничение размера (б).
   Гипотеза (заранее, из круга 1): продажи на страхе, сделанные при сжатой волатильности BTC (перцентиль ширины полос за 180 дн < 0,24),
   стоят ближе к вершине (79%) и дальше цена падает (−8% за 90 дн); после расширения (> 0,53) — 58% от вершины и −2% (◆ обе половины).
   Значит продажи на страхе ×1,25/×1,5 при сжатии BTC и/или ×0,75 после расширения дадут доход. Сравнение: сжатие самой монеты (t_bbwp),
   ATR монеты (у волатильных монет продажи на страхе дальше от вершины и цена потом растёт: ×0,75 при ATR > 8/10/12%).
   Критерий: общий. Запуск: node app/ta_loop4.js <out.json> > log */
const T = require('./ta_sim.js');
const { c } = T;
const G = T.load();
const base = T.ev(G, T.BASE), out = [];
const run = (t, S) => { const r = T.ev(G, S); out.push({ t, d: T.K.d(r, base), pass: T.K.passes(r, base), n100: r.n100.med, n100pos: r.n100.pos, n100h: r.n100.hpos, bw: T.K.bw(r, base, 'n100'), m: r.m }); console.log(T.rowS(t, r, base)); return r; };
console.log(T.K.HDR); console.log(T.rowS('основа', base, base));
const scaleF = (S, conds, k, which = T.isFearSell) => T.pre(S, which, conds, (r) => Math.max(-1, +(r.act * k).toFixed(6)));
for (const x of [0.2, 0.3, 0.4]) for (const k of [1.25, 1.5]) run(`страх ×${k} при сжатии BTC (bbwp < ${x})`, scaleF(T.BASE, [c('b_bbwp', '<', x)], k));
for (const y of [0.5, 0.6, 0.7]) run(`страх ×0,75 после расширения BTC (bbwp > ${y})`, scaleF(T.BASE, [c('b_bbwp', '>', y)], 0.75));
for (const x of [0.2, 0.3]) run(`все продажи ×1,25 при сжатии BTC (bbwp < ${x})`, scaleF(T.BASE, [c('b_bbwp', '<', x)], 1.25, T.isSell));
for (const x of [0.2, 0.3]) run(`страх ×1,25 при сжатии монеты (t_bbwp < ${x})`, scaleF(T.BASE, [c('t_bbwp', '<', x)], 1.25));
for (const y of [8, 10, 12]) run(`страх ×0,75 при ATR монеты > ${y}%`, scaleF(T.BASE, [c('t_atrp', '>', y)], 0.75));
for (const y of [4, 5]) run(`страх ×0,75 при ATR BTC > ${y}%`, scaleF(T.BASE, [c('b_atrp', '>', y)], 0.75));
require('fs').writeFileSync(process.argv[2] || '/dev/null', JSON.stringify(out));
