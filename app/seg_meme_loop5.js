/* Круг 5: пампы мемов при BTC у максимума не продаются. Продажа s в день, пока монета выше 90-дн. минимума > U% (при любом BTC), для мемов / всех / беты > 1,3;
   поверх основы и поверх P35. Запуск: node app/seg_meme_loop5.js */
const M = require('./seg_meme_lib.js'), c = M.c;
const G = M.load(); M.flags(G);
const b = M.evs(G, M.S0);
const P35 = M.pre(M.S0, M.isPanic, [...M.FL.meme, c('ddm90', '<', 35)], 1), bp = M.evs(G, P35);
const addPump = (S, f, U, s) => { const R = [...S.rules], i = R.findIndex(M.isPump); R.splice(i, 0, { act: -s, conds: [...M.FL[f], c('up90', '>', U)] }); return { ...S, rules: R }; };
for (const f of ['meme', 'all', 'b13']) for (const U of [200, 300, 500]) for (const s of [0.05, 0.1, 0.2]) {
  if (f !== 'meme' && s !== 0.1) continue;
  const r = M.evs(G, addPump(M.S0, f, U, s));
  console.log(M.line(`памп мема > ${U}% → продать ${s * 100}% [${f}] | ${M.rs(M.robust(r, b))}`, r, b));
  if (f === 'meme' && s === 0.1) { const rp = M.evs(G, addPump(P35, f, U, s)); console.log(`   поверх P35: ${M.rs(M.robust(rp, bp))}`); console.log('   ', M.diffMemes(r, b)); }
}
