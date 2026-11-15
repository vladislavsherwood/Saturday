/* imp7: контроль — тот же множитель продаж/покупок без условия режима (флаг «всегда»), чтобы отделить эффект режима от эффекта размера.
   Запуск: node app/imp7_ctl.js */
const M = require('./imp7_sim.js');
const G = M.groups(['sel', 'ex', 'rnd']); M.prep(G);
M.addFlag(G, 'rgall', (I, i) => true);
const CS = M.cycSlices(G), base = M.ev(G, M.B0, false), cb = M.cycEv(CS, M.B0);
const V = [['qt', 1.25], ['qt', 1.5], ['fear', 1.25], ['fear', 1.5], ['fund', 1.5], ['panic', 1.5], ['panic', 0.5], ['rev', 0.5]];
for (const [kd, k] of V) {
  const S = M.scaleK(M.B0, 'rgall', k, (x) => x === kd), r = M.ev(G, S, false), cc = M.cycCmp(M.cycEv(CS, S), cb);
  console.log(`всегда | ${kd} ×${k} | ${M.d(r, base).toFixed(3)} | ${M.passes(r, base) ? '✔' : '· ' + M.why(r, base)} | ${M.cycStr(cc)} | ${M.sameSign(cc)}`);
}
