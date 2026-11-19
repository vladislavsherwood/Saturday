/* dcaf: «ловушка для фитилей» по монетам пользователя — доход к DCA с ловушкой и без (вся история, худший из сдвигов 0/1). Запуск: node dcaf_r8.js */
const L = require('./r4_lib.js'), { S0, P, G } = L;
const pol = (e) => ({ ...L.pol0, wick: { lv: [[0.25, 0.1], [0.4, 0.2], [0.6, 0.3]], age: 60, every: e } });
const mine = ['BTC', 'ETH', 'SOL', 'DOGE', 'PEPE', 'ENA', 'ZEC', 'PENGU', 'HYPE', 'PUMP', 'XMR', 'FARTCOIN', 'USELESS', 'LIT'];
const E = (X, p) => Math.min(P.edge(X, S0, 0, 'full', false, p).e, P.edge(X, S0, 1, 'full', false, p).e);
console.log('монета (список, с)       combo4   +фитили(1д)  +фитили(3д)');
for (const g of ['sel', 'ex', 'rnd', 'n100']) for (const X of G[g]) if (mine.includes(X.name)) console.log(`${X.name.padEnd(9)} ${g.padEnd(5)} ${L.day(X.ind.t[0])}  ${E(X, L.pol0).toFixed(0).padStart(7)}% ${E(X, pol(1)).toFixed(0).padStart(9)}% ${E(X, pol(3)).toFixed(0).padStart(9)}%`);
