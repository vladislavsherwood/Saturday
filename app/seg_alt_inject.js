/* Агент «АЛЬТЫ»: флаг isalt для браузерного стенда (вызывать после остальных inject): 1 — альт, 0 — крупная монета, мем или стейбл
   (списки LARGE/MEME/STABLE из seg_alt_sim.js передаются аргументом). Совпадает с Q.addAltFlag быстрого оценщика. */
const injAlt = (NOT) => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.isalt) continue;
    const v = NOT.includes(RAW.ticker) ? 0 : 1;
    IND.isalt = { v: H.c.map(() => v), step: 1, min: 0, max: 1, short: 'isalt', name: 'isalt' };
  }
  setup(cur, true);
};
module.exports = { injAlt };
