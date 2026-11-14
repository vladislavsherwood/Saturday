/* Круг 8: продажи слабого мема крупнее. C у мемов ×1,5/×2 вместо ×1,25 (rel180 < −15), C4 агента 3 для мемов (бета180 > 1,2 и ниже средней 200 → ×1,5),
   и «мем ниже средней 200 → продажи ×1,5» (без беты: у молодых мемов 100 новых бета низкая) — поверх P35. Запуск: node app/seg_meme_loop8.js */
const M = require('./seg_meme_lib.js'), c = M.c;
const G = M.load(); M.flags(G);
const b = M.evs(G, M.S0);
const P35 = M.pre(M.S0, M.isPanic, [...M.FL.meme, c('ddm90', '<', 35)], 1), bp = M.evs(G, P35);
// продажи: копия перед каждым правилом продажи без условия rel180 (исходные правила основы), доля ×k от исходной, условия conds
const isBase = (r) => r.act < 0 && !r.conds.some((x) => x.ind === 'rel180');
const sells = (S, conds, k) => M.pre(S, isBase, conds, (r) => Math.max(-1, +(r.act * k).toFixed(6)));
const V = [];
// C у мемов: копия перед правилами C (rel180 < −15, ×1,25) с долей ×k/1,25 — т. е. итог ×k к исходной
const isC = (r) => r.act < 0 && r.conds.some((x) => x.ind === 'rel180');
for (const k of [1.5, 1.75, 2, 2.5, 3]) V.push([`мем и rel180 < −15 → ×${k}`, M.pre(P35, isC, M.FL.meme, (r) => Math.max(-1, +(r.act * k / 1.25).toFixed(6)))]);
for (const k of [1.25, 1.5, 2]) V.push([`мем и бета180 > 1,2 и ниже средней 200 → ×${k} (C4)`, sells(P35, [...M.FL.meme, c('beta180', '>', 1.2), c('sma200', '<', 1)], k)]);
for (const k of [1.25, 1.5, 2]) V.push([`мем ниже средней 200 → ×${k}`, sells(P35, [...M.FL.meme, c('sma200', '<', 1)], k)]);
for (const k of [1.25, 1.5]) V.push([`мем ниже средней 200 на 20% → ×${k}`, sells(P35, [...M.FL.meme, c('sma200', '<', 0.8)], k)]);
for (const [t, S] of V) { const r = M.evs(G, S); console.log(M.line(`P35 + ${t} | ${M.rs(M.robust(r, bp))}`, r, bp)); console.log('   ', M.diffMemes(r, bp)); }
