/* Агент 4C: сделки W25 по одной монете (дата, правило, сумма, цена, признаки монеты). Запуск: node app/agent4c_trades.js ARIA [WFI ...] */
const A = require('./agent4c_sim.js');
const G = A.groups(['sel', 'ex', 'rnd', 'n100']);
const all = Object.values(G).flat();
for (const nm of process.argv.slice(2)) {
  const X = all.find((x) => x.name === nm); if (!X) { console.log('нет', nm); continue; }
  const r = A.edge(X, A.W25, 0, 'full', true);
  console.log(`== ${nm}: итог к DCA ${r.e.toFixed(0)}%, дней ${X.n}`);
  const d = (i) => new Date(X.t[i] * 864e5).toISOString().slice(0, 10);
  for (const t of r.tr) { const i = t.i, I = X.ind; console.log(`${d(i)} ${t.s > 0 ? 'BUY ' : 'SELL'} r${t.q} amt ${t.amt.toFixed(0).padStart(5)} p ${t.p.toPrecision(4)} | dd90 ${I.ddm90[i].toFixed(0)} pump180 ${I.pump180[i].toFixed(1)} sma200 ${I.sma200[i].toFixed(2)} pair ${I.pair[i].toFixed(2)} beta ${(I.beta90[i] || 0).toFixed(2)} r30 ${I.ret30[i].toFixed(0)} btcr30 ${I.btcr30[i].toFixed(0)}`); }
}
