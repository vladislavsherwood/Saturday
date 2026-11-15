/* tune1 круг 4: края плоских плато отложенной (окно 20 — правый край плато 14–20, мин. толпы 0,9 — правый край 0,80–0,90).
   Двумерная сетка окно × мин. толпы и проверка на 100 новых: даёт ли середина (17, 0,85) тот же результат, и где края плато вместе.
   Запуск: node app/tune1_r4.js → scratchpad/tune1/r4.json */
const T = require('./tune1_sim.js'); const { c, S0 } = T; const fs = require('fs');
const OUT = (process.env.SCR || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad') + '/tune1';
const G = T.Z.load(); const GS = ['sel', 'ex', 'rnd', 'n100']; const B = T.ev(G, S0, GS);
const dlyR = (p) => { let k; T.prep(G, (X) => { if (X.ind.oidd30) k = T.dly(X, p); }); return { act: 1.5, conds: [c(k, '>', 0.5)] }; };
// число дней сигнала у BTC (отбор) — чтобы видеть, меняются ли сами дни
const btc = G.sel.find((X) => X.name.toUpperCase().startsWith('BTC'));
const days = (p) => { const k = T.dly(btc, p); let n = 0; for (let i = 0; i < btc.n; i++) n += btc.ind[k][i]; return n; };
const res = [];
const ws = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 24], ys = [0.8, 0.82, 0.84, 0.85, 0.86, 0.88, 0.9, 0.91, 0.92, 0.95];
console.log('окно \\ мин.толпы: доход (все группы ст.), n100 медиана/плюс/половины, дней сигнала у BTC');
for (const w of ws) {
  const row = [];
  for (const y of ys) {
    const A = T.ev(G, T.setBuy(S0, 1, dlyR({ w, y })), GS), o = T.cmp(A, B), n = A.S.n100.all;
    const x = { w, y, inc: +o.inc.all.toFixed(3), ok: o.ok, n100: [+n.med.toFixed(0), n.pos, n.hpos], d: days({ w, y }) }; res.push(x);
    row.push(`${x.inc >= 0 ? '+' : ''}${x.inc.toFixed(3)}${x.ok ? '✔' : '·'} ${x.n100.join('/')} d${x.d}`);
  }
  console.log(String(w).padStart(3), row.join(' | '));
}
console.log('ys:', ys.join(' '));
fs.writeFileSync(OUT + '/r4.json', JSON.stringify(res));
