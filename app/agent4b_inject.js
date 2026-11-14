/* Агент 4B: индикаторы для браузерного стенда (вызывать после inject/injLiq/injLs):
   up90 — рост монеты от минимума за 90 дней, % (как в agent_sim.js); ago_qt — дней с последней тихой вершины (узкой qt или широкой:
   BTC < 15% от максимума и доля альтов за 90 дн > +1 п.п.). */
const injB = () => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.ago_qt) continue;
    const add = (key, v) => { IND[key] = { v, step: 1, min: 0, max: 1, short: key, name: key }; };
    const c = H.c;
    add('up90', c.map((x, i) => { let m = Infinity; for (let j = Math.max(0, i - 89); j <= i; j++) if (c[j] < m) m = c[j]; return (x / m - 1) * 100; }));
    const q = IND.qt.v, ba = IND.btcath.v, o9 = IND.oth90.v; let s = NaN;
    add('ago_qt', q.map((x, i) => (s = x > 0.5 || (ba[i] < 15 && o9[i] > 1) ? 0 : s + 1)));
  }
  setup(cur, true);
};
module.exports = { injB };
