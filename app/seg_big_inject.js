/* Агент «крупные монеты»: индикаторы для браузерного стенда (вызывать после inject/injLiq/injLs/injB/injC):
   corr180, vol180 — корреляция дневных лог-доходностей монеты с BTC и годовая волатильность монеты за 180 дней, % (как в agent4c_sim.js:
   не меньше 80% окна наблюдений, иначе NaN); isbig — 1 для BTC, ETH, BNB, XRP, SOL, TRX, ADA, LTC, BCH (по тикеру), иначе 0. */
const injBig = () => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  const BIG = ['BTC', 'ETH', 'BNB', 'XRP', 'SOL', 'TRX', 'ADA', 'LTC', 'BCH'];
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.corr180) continue;
    const add = (key, v) => { IND[key] = { v, step: 1, min: 0, max: 1, short: key, name: key }; };
    const c = H.c, n = c.length, b = (RAW.pair ? fill(RAW.pair) : RAW.c).slice(SKIP), w = 180;
    const corr = new Array(n).fill(NaN), vol = new Array(n).fill(NaN); let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, q = 0; const Q = [];
    for (let i = 0; i < n; i++) {
      let x = NaN, y = NaN;
      if (i > 0 && b[i] > 0 && b[i - 1] > 0 && c[i] > 0 && c[i - 1] > 0) { x = Math.log(b[i] / b[i - 1]); y = Math.log(c[i] / c[i - 1]); }
      Q.push([x, y]); if (!isNaN(x)) { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; q++; }
      if (Q.length > w) { const [x0, y0] = Q.shift(); if (!isNaN(x0)) { sx -= x0; sy -= y0; sxx -= x0 * x0; syy -= y0 * y0; sxy -= x0 * y0; q--; } }
      if (q >= w * 0.8) { const vx = sxx / q - (sx / q) ** 2, vy = syy / q - (sy / q) ** 2, cv = sxy / q - (sx / q) * (sy / q); vol[i] = Math.sqrt(Math.max(vy, 0) * 365) * 100; corr[i] = cv / Math.sqrt(vx * vy); }
    }
    add('corr180', corr); add('vol180', vol);
    const tk = String(RAW.ticker || '').toUpperCase().replace(/[-_/].*$/, '');
    add('isbig', c.map(() => (BIG.includes(tk) ? 1 : 0)));
  }
  setup(cur, true);
  return true;
};
module.exports = { injBig };
