/* h1: монеты пользователя (есть в группах стенда), к DCA, %, вся история, худший из сдвигов 0/1: combo4 → +фитили → + векселя на свободную часть → + векселя на весь резерв */
const H = require('./h1_lib.js'), { P, G, S57 } = H;
const V = [['combo4', H.polC], ['W', H.polW], ['W+вексл.своб.', H.mk(H.yFree(H.tbd))], ['W+вексл.весь', H.mk(H.yTB(1))], ['W+кэрри', H.mk(H.carry({ e: 0.9, cost: 0.0015 }))]];
console.log('монета'.padEnd(10) + V.map(([n]) => n.padStart(15)).join(''));
for (const nm of ['BTC', 'ETH', 'SOL', 'DOGE', 'PEPE', 'XMR', 'HYPE', 'PUMP', 'FARTCOIN', 'PENGU']) {
  let X = null; for (const g in G) for (const x of G[g]) if (x.name === nm && !X) X = x; if (!X) { console.log(nm, '— нет'); continue; }
  console.log(nm.padEnd(10) + V.map(([, p]) => Math.round(P.E(X, S57, 'full', p)).toString().padStart(15)).join(''));
}
