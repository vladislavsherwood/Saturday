/* Круг 7: возврат после тихой вершины у мемов (через 30 дней мем выше на 175%): доля возврата ×2/×3 (20/30% резерва в день) и окно 45 → 90 дней,
   и «возврат без жадности» — поверх P35, для мемов / беты > 1,3. Запуск: node app/seg_meme_loop7.js */
const M = require('./seg_meme_lib.js'), c = M.c;
const G = M.load(); M.flags(G);
const b = M.evs(G, M.S0);
const P35 = M.pre(M.S0, M.isPanic, [...M.FL.meme, c('ddm90', '<', 35)], 1), bp = M.evs(G, P35);
console.log(M.line(`P35 к основе | ${M.rs(M.robust(bp, b))}`, bp, b));
const ret = (S, f, mult, D, fng = true) => { const R = [...S.rules], i = R.findIndex(M.isRet), r0 = R[i];
  const conds = [c('ago_qt', '<', D + 0.5), c('ago_qt', '>', 0.5), ...(fng ? [c('fng', '>', 52)] : []), c('hi90', '>', 0.5), ...M.FL[f]];
  R.splice(i, 0, { act: 1 + (r0.act - 1) * mult, conds }); return { ...S, rules: R }; };
for (const f of ['meme', 'b13']) for (const [mult, D, fng] of [[2, 45, true], [3, 45, true], [1, 90, true], [2, 90, true], [1, 45, false], [2, 45, false]]) {
  const r = M.evs(G, ret(P35, f, mult, D, fng));
  console.log(M.line(`P35 + возврат ×${mult} окно ${D}${fng ? '' : ' без жадности'} [${f}] | ${M.rs(M.robust(r, bp))}`, r, bp));
  if (f === 'meme') console.log('   ', M.diffMemes(r, bp));
}
