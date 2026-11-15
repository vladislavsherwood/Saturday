/* imp7: признаки режима BTC для браузерного стенда (после inject/injLiq/…): rb200 (BTC / средняя 200 по полной истории BTC) и rsl (наклон средней 200
   за 30 дней, %), по номеру дня из ряда, посчитанного imp7_sim.regimeMap() по полной истории BTC (иначе у молодых монет средняя считается
   только по дням страницы — так устроен btc200 стенда). */
const injR = (EX) => {
  const cur = SETS.order.find((k) => SETS.sets[k] === RAW);
  for (const k of SETS.avg) {
    setup(k, true);
    if (IND.rb200) continue;
    const add = (key, v) => { IND[key] = { v, step: 1, min: 0, max: 1, short: key, name: key }; };
    const at = {}; EX.t.forEach((t, i) => (at[t] = i));
    for (const key of ['rb200', 'rsl']) add(key, H.t.map((t) => { const i = at[t]; return i == null || EX[key][i] == null ? NaN : EX[key][i]; }));
  }
  setup(cur, true);
};
module.exports = { injR };
