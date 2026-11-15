/* imp9, круг 1: хедж вместо продажи по монетам (отбор, экзамен, 50 случайных). Запуск: node app/imp9_loop1.js */
const H = require('./imp9_sim.js');
const G = H.groups(['sel', 'ex', 'rnd']);
const t0 = Date.now();
const ref = H.K.ev(G, H.SB, false);
const base = H.evalH(G, H.SB, { mode: 'sell' });
console.log('проверка совпадения с оценщиком основы:', ['sel', 'ex', 'rnd'].map((g) => `${ref[g].med.toFixed(1)}=${base[g].med.toFixed(1)}`).join(' '));
console.log(H.row('основа: продажа', base, base));
for (const mode of ['own', 'btc', 'mix']) for (const cov of [0, 0.5, 1, 2, 3]) {
  const o = { mode, cov }; console.log(H.row(`${mode}, залог ${cov ? '≥ ' + cov + '× номинала' : 'без ограничения'}`, H.evalH(G, H.SB, o), base));
}
console.log(H.row('own, залог 1×, без фандинга', H.evalH(G, H.SB, { mode: 'own', cov: 1, fund: false }), base));
console.log(`[${((Date.now() - t0) / 1000).toFixed(0)} с]`);
