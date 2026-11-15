/* Круг 8: доводка переноса денег паники на разворот usdt (круг 7). Основной вариант: монета старше A дней, usdt у 10-дн. пика (upk10 ≥ t) →
   правило паники тратит долю × k, остаток — в долг; долг целиком выдаётся в первый день покупки с upk10 < rv (или в конце эпизода).
   Доводки: (s) не откладывать сильную панику (usdt > 1,2); (f) выдавать долг и при капитуляции (fng < 10); A 365/540/730.
   Запуск: node panicx_r8.js [grid|btc] */
const P = require('./panicx_sim.js'), Z = P.Z;
const G = P.load();
for (const g in G) for (const X of G[g]) if (!X.ind.upk10) { const u = X.ind.usdt, a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { let m = -Infinity; for (let k = Math.max(0, i - 9); k <= i; k++) if (u[k] > m) m = u[k]; a[i] = u[i] / m; } X.ind.upk10 = a; }
const why = (r) => { const { BS } = P.baseline(); return Z.SEGS.map((s) => { const w = Z.strict(r.RS, BS, s); return w.length ? `${s}: ${w.join(',')}` : ''; }).filter(Boolean).join(' | '); };
const btcH1 = (r) => { const x = r.R.sel.find((y) => y.name === 'BTC'); return `BTC ${x.f.toFixed(1)}/${x.h1.toFixed(2)}/${x.h2.toFixed(1)}`; };
const run = (nm, pol) => { const r = P.report(nm, P.base, pol, { quiet: true }); const L = r.line.replace(/ (sel|ex|rnd):\S*/g, '').replace(/ +/g, ' '); console.log(L, btcH1(r), '||', why(r)); return r; };
const Pol = ({ t = 0.98, k = 0.25, rv = 0.96, A = 540, strong = false, cap = false, su = 1.2 } = {}) => ({
  buy: ({ X, j, share }) => { const I = X.ind; if (strong && I.usdt[j] > su) return share; return I.age[j] > A && I.upk10[j] >= t ? share * k : share; },
  release: ({ X, j }) => { const I = X.ind; return I.upk10[j] < rv || I.pend[j] || (cap && I.fng[j] < 10) ? 1 : 0; },
});
module.exports = { Pol };
if (require.main === module) {
  P.report('основа', P.base, null);
  const { BR } = P.baseline(); const b = BR.sel.find((y) => y.name === 'BTC'); console.log('основа BTC', b.f.toFixed(1), b.h1.toFixed(2), b.h2.toFixed(1));
  const mode = process.argv[2] || 'grid';
  if (mode === 'grid') for (const A of [365, 540, 730]) for (const strong of [false, true]) for (const cap of [false, true]) for (const t of [0.97, 0.98]) for (const k of [0.25, 0.5]) run(`A${A}${strong ? ' s' : ''}${cap ? ' f' : ''} t${t} k${k}`, Pol({ A, strong, cap, t, k }));
}
