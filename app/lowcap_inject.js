/* Агент «ЛОУКАП»: индикаторы для браузерного стенда (вызывать после inject/injLiq/injLs/injB/injC).
   Данные приходят снаружи по монете страницы (тикер) и дню: mcsh90 — доля монеты в капитализации рынка, средняя за 90 дн, б.п.;
   turn — оборот дня, % капитализации; cf7 — фандинг монеты за 7 дней, %. Нет данных — NaN (условие не выполнено).
   Готовит данные lowcapPayload(G, page) по рядам быстрого оценщика (lowcap_sim.js): у монеты страницы те же дни, что в выгрузке. */
const injLow = (D) => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.mcsh90) continue;
    const add = (key, v) => { IND[key] = { v, step: 1, min: 0, max: 1, short: key, name: key }; };
    const d = D[RAW.ticker], n = H.c.length;
    for (const key of ['mcsh90', 'turn', 'cf7']) {
      if (!d) { add(key, H.c.map(() => NaN)); continue; }
      const at = {}; d.t.forEach((t, i) => (at[t] = i));
      add(key, H.t.map((t) => { const i = at[t]; const v = i == null ? null : d[key][i]; return v == null ? NaN : v; }));
    }
  }
  setup(cur, true);
};
function lowcapPayload(A) {
  const o = {}, r = (v) => (isNaN(v) ? null : +v.toPrecision(5));
  for (const X of A) o[X.name] = { t: Array.from(X.t), mcsh90: Array.from(X.ind.mcsh90, r), turn: Array.from(X.ind.turn || [], r), cf7: Array.from(X.ind.cf7 || [], r) };
  return o;
}
module.exports = { injLow, lowcapPayload };
