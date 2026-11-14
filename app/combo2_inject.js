/* Объединение 2: индикаторы для браузерного стенда (вызывать после inject/injLiq/injLs/injB/injC/injBeta/injBig):
   injSeg(L) — флаги сегмента по тикеру (единые списки combo2_sim.js): isbig (9 крупных; заменяет флаг injBig тем же списком), meme (18 мемов), isalt
   (не крупная, не мем, не стейбл); injTA(M) — b_bbwp и b_w20 BTC по полной истории BTC (считаются в node ta_sim.btcTA, передаются картой
   «день → [b_bbwp, b_w20]» и сопоставляются по дню H.t). */
const injSeg = (L) => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.meme && IND.isalt) continue;
    const tk = String(RAW.ticker || '').toUpperCase().replace(/[-_/].*$/, '');
    const s = L.BIG.includes(tk) ? 'big' : L.MEME.includes(tk) ? 'meme' : L.STABLE.includes(tk) ? 'stable' : 'alt';
    const add = (key, v) => { IND[key] = { v: H.c.map(() => v), step: 1, min: 0, max: 1, short: key, name: key }; };
    add('isbig', s === 'big' ? 1 : 0); add('meme', s === 'meme' ? 1 : 0); add('isalt', s === 'alt' ? 1 : 0);
  }
  setup(cur, true);
  return true;
};
const injTA = (M) => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.b_bbwp) continue;
    const get = (q) => H.t.map((t) => (M[t] ? M[t][q] : NaN));
    IND.b_bbwp = { v: get(0), step: 1, min: 0, max: 1, short: 'b_bbwp', name: 'b_bbwp' };
    IND.b_w20 = { v: get(1), step: 1, min: 0, max: 1, short: 'b_w20', name: 'b_w20' };
  }
  setup(cur, true);
  return true;
};
module.exports = { injSeg, injTA };
