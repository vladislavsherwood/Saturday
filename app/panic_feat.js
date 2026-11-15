/* Чем ранние покупки паники (после покупки цена упала > 30%) отличаются от удачных (упала < 10%): признаки накануне покупки. */
const Z = require('./combo2_sim.js');
const { recs } = require('./panic_early.js');
const G = Z.load(['sel', 'ex', 'rnd']);
const byName = new Map(Object.values(G).flat().map((X) => [X.name, X]));
function extra(X) {
  if (X.ind.usdtpk) return;
  const n = X.n, u = X.ind.usdt, a = new Float64Array(n), b = new Float64Array(n);
  for (let i = 0; i < n; i++) { let m = -Infinity; for (let j = Math.max(0, i - 9); j <= i; j++) if (u[j] > m) m = u[j]; a[i] = u[i] / m; b[i] = i >= 7 ? u[i] / u[i - 7] : NaN; }
  X.ind.usdtpk = a; X.ind.usdt7 = b;
}
const F = ['dd', 'ddm90', 'rdd90', 'btcath', 'btcr30', 'btcr14', 'fng', 'fngd7', 'rsi', 'ret30', 'usdt', 'usdtpk', 'usdt7', 'oidd30', 'lsr', 'fund7', 'panicd', 'up90'];
const P = recs.filter((x) => x.L === 'паника');
const bad = [], good = [];
for (const r of P) {
  const X = byName.get(r.coin); extra(X);
  const i = Array.prototype.indexOf.call(X.t, r.t) - 1; const v = {};
  for (const k of F) v[k] = X.ind[k] ? X.ind[k][i] : NaN;
  v.w = r.amt; (r.fall > 30 ? bad : r.fall < 10 ? good : []).push(v);
}
const wq = (a, k, f) => { const s = a.filter((x) => isFinite(x[k])).sort((x, y) => x[k] - y[k]); if (!s.length) return NaN; const W = s.reduce((t, x) => t + x.w, 0); let c = 0; for (const x of s) { c += x.w; if (c >= f * W) return x[k]; } return s[s.length - 1][k]; };
console.log('ранних', bad.length, 'удачных', good.length, '(взвешено по деньгам: квартили 25/50/75)');
for (const k of F) console.log(k.padEnd(8), 'ранние', [0.25, 0.5, 0.75].map((f) => wq(bad, k, f)?.toFixed(2)).join(' / ').padEnd(26), 'удачные', [0.25, 0.5, 0.75].map((f) => wq(good, k, f)?.toFixed(2)).join(' / '));
