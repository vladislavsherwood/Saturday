/* imp1, круг 3b: плато «собственный рост монеты за 30 дней r30 > X → на развороте только взнос (или доля)», 100 новых, кто даёт худшую половину.
   Запуск: node app/imp1_loop3b.js */
const K = require('./imp1_sim.js');
const G = K.groups(['sel', 'ex', 'rnd', 'n100']);
const base = K.ev(G, K.S0, true);
console.log(K.HDR); console.log(K.show('основа', base, base));
const c = K.c;
const V = (x, a, ind = 'r30') => K.mapRev(K.S0, (r) => [{ act: a, conds: [...r.conds, c(ind, '>', x)] }, r]);
const worstHalf = (S, g) => { let w = [1e9, '']; for (const X of G[g]) for (const p of ['h1', 'h2']) { const e = K.E(X, S, p); if (e < w[0]) w = [e, X.name + ' ' + p]; } return w[1] + ' ' + w[0].toFixed(2); };
console.log('основа худшая половина: отбор', worstHalf(K.S0, 'sel'), '| экзамен', worstHalf(K.S0, 'ex'));
for (const [ind, xs] of [['r30', [20, 30, 40, 45, 50, 60, 80]], ['rel30', [10, 20, 30]]]) for (const x of xs) for (const a of [1, 1.25]) {
  const S = V(x, a, ind), r = K.ev(G, S, true);
  console.log(K.show(`${ind} > ${x} → ${a === 1 ? 'взнос' : '25%'}`, r, base) + ` | 100н лучше/хуже ${K.bw(r, base, 'n100').join('/')} | худш.пол. отбора ${worstHalf(S, 'sel')}` + (K.passes(r, base) ? '' : '  ✘ ' + K.why(r, base)));
}
