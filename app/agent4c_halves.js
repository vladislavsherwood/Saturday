/* Агент 4C: какие половины истории хуже всего у варианта против W25 (диагностика строгой проверки).
   Использование: const H = require('./agent4c_halves.js'); H.worst(G, S, base, k) */
const A = require('./agent4c_sim.js');
function halves(G, S, g) { return G[g].flatMap((X) => [[X.name + ' h1', A.E(X, S, 'h1')], [X.name + ' h2', A.E(X, S, 'h2')]]); }
function worst(G, S, k = 4) { const o = []; for (const g of ['sel', 'ex', 'rnd']) { const a = halves(G, S, g), b = halves(G, A.W25, g); const s = a.map((x, i) => [x[0], x[1], b[i][1]]).sort((p, q) => p[1] - q[1]).slice(0, k); o.push(`${g}: ` + s.map((x) => `${x[0]} ${x[1].toFixed(1)} (W25 ${x[2].toFixed(1)})`).join(', ')); } return o.join('\n'); }
module.exports = { halves, worst };
