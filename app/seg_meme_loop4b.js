/* Круг 4 (б): устойчивая мера плато P для малых групп — средний лог-прирост по мемам и число лучше/хуже. Запуск: node app/seg_meme_loop4b.js */
const M = require('./seg_meme_lib.js'), c = M.c;
const G = M.load(); M.flags(G); const b = M.evs(G, M.S0);
for (const W of [90, 180]) for (const X of [15, 20, 25, 30, 35, 40, 50, 60]) { const r = M.evs(G, M.pre(M.S0, M.isPanic, [...M.FL.meme, c('ddm' + W, '<', X)], 1)); console.log(`ddm${W}<${X}: ${M.rs(M.robust(r, b))}`); }
