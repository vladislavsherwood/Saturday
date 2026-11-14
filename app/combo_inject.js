/* Объединение: индикатор rel180 агента 4C для браузерного стенда (вызывать после inject/injLiq/injLs/injB):
   rel180 — (монета / монета 180 дней назад) / (BTC / BTC 180 дней назад) − 1, %; для BTC — 0; нет 180 дней истории — NaN (условие не выполнено).
   Считается по полной истории страницы (до отсечки разогрева SKIP), затем обрезается, как остальные индикаторы. */
const injC = () => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.rel180) continue;
    const add = (key, v) => { IND[key] = { v, step: 1, min: 0, max: 1, short: key, name: key }; };
    const btc = RAW.pair ? fill(RAW.pair) : RAW.c, c = RAW.c;
    for (const w of [90, 180]) add('rel' + w, c.map((x, i) => (i >= w && btc[i] > 0 && btc[i - w] > 0 && c[i - w] > 0 ? ((x / c[i - w]) / (btc[i] / btc[i - w]) - 1) * 100 : NaN)).slice(SKIP));
  }
  setup(cur, true);
};
module.exports = { injC };
