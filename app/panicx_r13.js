/* Круг 13: «копить, пока сигнал усиливается, тратить на развороте» для других ранних покупок (поверх кандидата k 0).
   (а) разворот BTC (btcr30 > 20 → весь резерв): пока BTC у 10-дн. максимума (цена ≥ max10 × (1 − 0,02)), правило тратит долю × kb, остальное — второй долг;
       выдача — на откате BTC от 10-дн. максимума > d% или через N дней после последней отсрочки.
   (б) волна ликвидаций (oidd30 < −28 → 50%): пока OI продолжает падать (oidd30 ниже вчерашнего), доля × kb; выдача — когда OI перестал падать (oidd30 выше вчерашнего на ≥ g) или через N дней.
   Запуск: node panicx_r13.js */
const H = require('./panicx_p2.js'), P = H.P;
H.init();
const G = H.G;
for (const g in G) for (const X of G[g]) { const b = X.ind.btcp, n = X.n, m = new Float64Array(n); for (let i = 0; i < n; i++) { let v = -Infinity; for (let k = Math.max(0, i - 9); k <= i; k++) if (b[k] > v) v = b[k]; m[i] = b[i] / v; } X.ind.bpk10 = m; }
const isRev = (r) => r.act > 1.5 && r.conds.length === 1 && r.conds[0].ind === 'btcr30';
const isLiq = (r) => r.act > 1 && r.conds.length === 1 && r.conds[0].ind === 'oidd30';
const base = H.Pol2({ k: 0 });
P.setBaseline(P.base, base); { const { BS, BM } = P.baseline(); console.log('кандидат k0 (новая основа круга)', ['sel', 'ex', 'rnd'].map((g) => P.f(BS[g].all)).join(' | '), `паника ${BM.fall.toFixed(1)}%/${BM.days}д монеты ${BM.fallC.toFixed(1)}%`); }
// точность «других» покупок: падение после покупки по деньгам
function otherFall(pol, which) {
  let W = 0, wf = 0, D = 0;
  for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) { const R = P.base.rules; const { tr } = P.edge(X, P.base, 0, 'full', true, pol); for (const t of tr) if (t.s > 0 && t.i + 120 < X.n && (t.oth || (t.q >= 0 && which(R.filter((r) => r.conds.every((cd) => X.ind[cd.ind]))[t.q])))) { let m = t.p, d = 0; for (let k = t.i; k <= t.i + 120; k++) if (X.c[k] < m) { m = X.c[k]; d = k - t.i; } W += t.amt; wf += t.amt * (1 - m / t.p) * 100; D += t.amt * d; } }
  return `${(wf / W).toFixed(1)}%/${(D / W).toFixed(0)}д`;
}
const Rev = (kb, d, N) => ({ ...base, other: isRev, buyO: ({ X, j, share, st }) => { if (X.ind.bpk10[j] >= 0.98) { st.ot = j; return share * kb; } return share; },
  releaseO: ({ X, j, st }) => (X.ind.bpk10[j] < 1 - d || j - st.ot >= N ? 1 : 0) });
const Liq = (kb, gap, N) => ({ ...base, other: isLiq, buyO: ({ X, j, share, st }) => { const o = X.ind.oidd30; if (o[j] < o[j - 1]) { st.ot = j; return share * kb; } return share; },
  releaseO: ({ X, j, st }) => { const o = X.ind.oidd30; return o[j] > o[j - 1] + gap || j - st.ot >= N ? 1 : 0; } });
console.log('разворот BTC в кандидате:', otherFall(base, isRev), '| волна ликв.:', otherFall(base, isLiq));
for (const kb of [0, 0.25, 0.5]) for (const d of [0.05, 0.1]) for (const N of [20, 40]) { const pol = Rev(kb, d, N); H.run(`разворот BTC kb${kb} откат${d} N${N}`, pol); console.log('     покупки разворота:', otherFall(pol, isRev)); }
for (const kb of [0, 0.5]) for (const gap of [0, 2]) for (const N of [10, 30]) { const pol = Liq(kb, gap, N); H.run(`ликвидации kb${kb} OI вверх>${gap} N${N}`, pol); console.log('     покупки волны:', otherFall(pol, isLiq)); }
console.log(H.summary());
