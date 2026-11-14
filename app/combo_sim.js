/* Объединение находок агентов 4A–4E поверх W25 (быстрый оценщик agent_sim.js через agent4c_sim.js + индикатор ago_qt агента 4B).
   Сборка вариантов: F (агент 4B), C — продажи ×k у монет, отставших от BTC за 180 дней (агент 4C, rel180), C6 — сильная паника
   usdt > 1,2 → доли #3,#5,#9 ×1,5 (агент 4A).
   Использование: const K = require('./combo_sim.js'); const G = K.groups(); K.prep(G); const S = K.withC(K.F, 1.25) */
const A = require('./agent4c_sim.js');            // регистрирует rel7…rel180 и др. признаки монеты в agent2_sim.EXTRA
const B4 = require('./agent4b_cand.js');           // prep: ago_qt
const fs = require('fs');
const { c } = A;
const F = JSON.parse(fs.readFileSync(__dirname + '/found/agent4b-best.json', 'utf8'));
const W25 = A.W25;
const groups = (list = ['sel', 'ex', 'rnd', 'n100']) => A.groups(list);
const prep = (G) => B4.prep(G);
// C: перед каждым правилом продажи (act < 0), выбранным which, — копия с долей ×k и условием rel{w} < v
const isQt = (r) => r.conds.some((x) => x.ind === 'qt') || r.conds.some((x) => x.ind === 'oth90');
const isBP = (r) => r.conds.some((x) => x.ind === 'up90');
function withC(S, k, { w = 180, v = -15, which = () => true } = {}) {
  if (k === 1) return S;
  return { ...S, rules: S.rules.flatMap((r) => (r.act < 0 && which(r) ? [{ act: Math.max(-1, +(r.act * k).toFixed(6)), conds: [...r.conds, c('rel' + w, '<', v)] }, r] : [r])) };
}
// C6: доли покупки #3,#5,#9 (индексы W25) ×m при usdt > u — копия перед исходным правилом. Применять ДО withC (по индексам W25/F)
function withC6(S, m = 1.5, u = 1.2, idx = [3, 5, 9]) {
  return { ...S, rules: S.rules.flatMap((r, q) => (!idx.includes(q) ? [r] : [{ act: 1 + (r.act - 1) * m, conds: [...r.conds, c('usdt', '>', u)] }, r])) };
}
const strictWhy = (r, b) => (A.passes(r, b) ? '✔' : '· ' + A.why(r, b));
const hmed = (G, g, S, p) => A.med(G[g].map((X) => A.E(X, S, p)));
module.exports = { ...A, A, F, W25, groups, prep, withC, withC6, isQt, isBP, strictWhy, hmed, c };
