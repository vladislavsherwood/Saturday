/* Агент 3: бета монеты к BTC за 90/180 дней внутри страницы стенда (как в agent3_sim.js: дневные лог-доходности по видимому окну H,
   цена BTC — RAW.pair, выровненная по дням монеты; не меньше 80% окна наблюдений). Для BTC бета = 1. */
const injBeta = () => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.beta180) continue;
    const add = (key, v) => { IND[key] = { v, step: 1, min: 0, max: 1, short: key, name: key }; };
    const c = H.c, n = c.length, b = (RAW.pair ? fill(RAW.pair) : RAW.c).slice(SKIP);
    for (const w of [90, 180]) {
      const beta = new Array(n).fill(NaN); let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, q = 0; const Q = [];
      for (let i = 0; i < n; i++) {
        let x = NaN, y = NaN;
        if (i > 0 && b[i] > 0 && b[i - 1] > 0 && c[i] > 0 && c[i - 1] > 0) { x = Math.log(b[i] / b[i - 1]); y = Math.log(c[i] / c[i - 1]); }
        Q.push([x, y]); if (!isNaN(x)) { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; q++; }
        if (Q.length > w) { const [x0, y0] = Q.shift(); if (!isNaN(x0)) { sx -= x0; sy -= y0; sxx -= x0 * x0; syy -= y0 * y0; sxy -= x0 * y0; q--; } }
        if (q >= w * 0.8) { const vx = sxx / q - (sx / q) ** 2, cv = sxy / q - (sx / q) * (sy / q); beta[i] = cv / vx; }
      }
      add('beta' + w, beta);
    }
  }
  setup(cur, true);
  return true;
};
module.exports = { injBeta };
