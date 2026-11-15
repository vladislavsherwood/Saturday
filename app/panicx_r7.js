/* Круг 7: перенос денег паники с дней, когда usdt ещё растёт (у 10-дн. пика, upk10 ≥ t), на дни разворота usdt (upk10 < 0,96).
   Политика: в день паники с usdt у пика правило тратит долю × k, остаток — в долг; долг выдаётся целиком в первый день покупки с upk10 < 0,96
   (или в конце эпизода — end 1 / сгорает — end 0). Только с дня эпизода ≥ d (первые дни не трогаем: они точнее середины). Запуск: node panicx_r7.js */
const P = require('./panicx_sim.js'), Z = P.Z;
const G = P.load();
for (const g in G) for (const X of G[g]) if (!X.ind.upk10) { const u = X.ind.usdt, a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { let m = -Infinity; for (let k = Math.max(0, i - 9); k <= i; k++) if (u[k] > m) m = u[k]; a[i] = u[i] / m; } X.ind.upk10 = a; }
const why = (r) => { const { BS } = P.baseline(); return Z.SEGS.map((s) => { const w = Z.strict(r.RS, BS, s); return w.length ? `${s}: ${w.join(',')}` : ''; }).filter(Boolean).join(' | '); };
const run = (nm, S, pol) => { const r = P.report(nm, S, pol, { quiet: true }); console.log(r.line.replace(/ (sel|ex|rnd):\S*/g, '').replace(/ +/g, ' '), '||', why(r)); return r; };
const Pol = (t, k, d, end, rv = 0.96) => ({
  buy: ({ X, j, share }) => { const I = X.ind; return I.pday[j] >= d && I.upk10[j] >= t ? share * k : share; },
  release: ({ X, j }) => (X.ind.upk10[j] < rv ? 1 : X.ind.pend[j] ? end : 0),
});
P.report('основа', P.base, null);
if (!process.argv[2]) for (const t of [0.98, 0.99]) for (const d of [1, 4, 8]) for (const k of [0, 0.5]) for (const end of [1, 0]) run(`usdt у пика≥${t} день≥${d} k${k} end${end}`, P.base, Pol(t, k, d, end));
if (process.argv[2] === 'diag') {
  const { BR } = P.baseline();
  for (const [nm, pol] of [['k0', Pol(0.98, 0, 1, 1)], ['k0.5', Pol(0.98, 0.5, 1, 1)]]) {
    const r = run(nm, P.base, pol); console.log('—', nm);
    for (const g of ['sel', 'ex', 'rnd']) r.R[g].forEach((x, i) => { const y = BR[g][i]; const w = ['f', 'h1', 'h2'].filter((k) => x[k] < y[k] - 0.01 && (y[k] < 60 || x[k] < y[k] * 0.85)); if (w.length) console.log('   ', g, x.name, x.seg, 'n', G[g][i].n, w.map((k) => `${k} ${y[k].toFixed(1)}→${x[k].toFixed(1)}`).join(' ')); });
  }
}
// сетка с фильтром возраста: у монет младше A дней паника работает как в основе
const PolA = (t, k, rv, A) => ({
  buy: ({ X, j, share }) => { const I = X.ind; return I.age[j] > A && I.upk10[j] >= t ? share * k : share; },
  release: ({ X, j }) => (X.ind.upk10[j] < rv || X.ind.pend[j] ? 1 : 0),
});
if (process.argv[2] === 'grid') for (const A of [0, 365, 540]) for (const t of [0.97, 0.98, 0.99]) for (const k of [0, 0.25, 0.5, 0.75]) for (const rv of [0.95, 0.96, 0.97]) if (rv < t) run(`age>${A} пик≥${t} k${k} разворот<${rv}`, P.base, PolA(t, k, rv, A));
module.exports = { PolA };
