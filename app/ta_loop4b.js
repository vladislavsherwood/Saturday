/* Агент ТА, круг 4 (контроль): сжатие волатильности — это признак или просто «больше продаж»? Те же ×1,25 на страхе без условия
   и в дни противоположного признака (расширение), той же частоты. Запуск: node app/ta_loop4b.js > log */
const T = require('./ta_sim.js');
const { c } = T;
const G = T.load();
const base = T.ev(G, T.BASE);
const run = (t, S) => { const r = T.ev(G, S); console.log(T.rowS(t, r, base)); return r; };
const scaleF = (S, conds, k, which = T.isFearSell) => T.pre(S, which, conds, (r) => Math.max(-1, +(r.act * k).toFixed(6)));
// частота признаков в дни продаж на страхе (81 монета)
let n = 0; const f = { lo3: 0, lo4: 0, hi6: 0, hi7: 0 };
for (const X of [...G.sel, ...G.ex, ...G.rnd]) for (let i = 0; i < X.n; i++) if (X.ind.fng[i] < 52 && X.ind.usdtd[i] < 7.6) { n++; const v = X.ind.b_bbwp[i]; f.lo3 += v < 0.3; f.lo4 += v < 0.4; f.hi6 += v > 0.6; f.hi7 += v > 0.7; }
console.log('доля дней страха: bbwp<0,3', (f.lo3 / n).toFixed(2), '<0,4', (f.lo4 / n).toFixed(2), '>0,6', (f.hi6 / n).toFixed(2), '>0,7', (f.hi7 / n).toFixed(2));
run('страх ×1,25 всегда', scaleF(T.BASE, [], 1.25));
run('страх ×1,1 всегда', scaleF(T.BASE, [], 1.1));
run('страх ×1,25 при расширении BTC (bbwp > 0,6)', scaleF(T.BASE, [c('b_bbwp', '>', 0.6)], 1.25));
run('страх ×1,25 при расширении BTC (bbwp > 0,7)', scaleF(T.BASE, [c('b_bbwp', '>', 0.7)], 1.25));
run('страх ×1,25 при сжатии BTC (bbwp < 0,3)', scaleF(T.BASE, [c('b_bbwp', '<', 0.3)], 1.25));
