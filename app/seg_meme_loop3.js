/* Круг 3: резерв мемов уходит на рыночную панику, когда сам мем ещё не упал. Покупки паники (правила с usdt) → только взнос, если монета
   ближе X% к своему 90-дн. максимуму (ddm90 < X) или выше своей средней 200 в k раз. Для всех / мемов / беты > 1,3. Запуск: node app/seg_meme_loop3.js */
const M = require('./seg_meme_lib.js'), c = M.c;
const G = M.load(); M.flags(G);
const b = M.evs(G, M.S0);
const conds = { 'ddm90<15': [c('ddm90', '<', 15)], 'ddm90<25': [c('ddm90', '<', 25)], 'ddm90<35': [c('ddm90', '<', 35)], 'sma200>1.2': [c('sma200', '>', 1.2)], 'sma200>1.5': [c('sma200', '>', 1.5)] };
for (const f of ['all', 'meme', 'b13']) for (const k in conds) {
  const S = M.pre(M.S0, M.isPanic, [...M.FL[f], ...conds[k]], 1), r = M.evs(G, S);
  console.log(M.line(`паника → взнос при ${k} [${f}] | 100н мемы лучше/хуже ${M.bw(r, b, 'n100', (x) => x.meme).join('/')}, все ${M.bw(r, b, 'n100').join('/')}`, r, b));
  if (f === 'meme') console.log('   ', M.diffMemes(r, b));
}
