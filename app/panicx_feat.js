/* panicx: признаки эпизода у покупок паники основы (combo3 без tune1): падение после покупки и дни до дна по корзинам признака накануне.
   Корзины по pday (день эпизода), pdrop (падение монеты от старта эпизода), bdrop (то же BTC), pmin (отскок от минимума эпизода), pupk (usdt к пику эпизода), brsi (RSI BTC). */
const P = require('./panicx_sim.js');
const G = P.load(), H = 120, recs = [];
for (const g of ['sel', 'ex', 'rnd']) for (const X of G[g]) {
  const { tr } = P.edge(X, P.base, 0, 'full', true, null);
  for (const t of tr) if (t.s > 0 && t.pan && t.i + H < X.n) {
    let m = t.p, d = 0; for (let k = t.i; k <= t.i + H; k++) if (X.c[k] < m) { m = X.c[k]; d = k - t.i; }
    const j = t.i - 1, I = X.ind; recs.push({ w: t.amt, fall: (1 - m / t.p) * 100, d, coin: X.name, pday: I.pday[j], pdrop: I.pdrop[j], bdrop: I.bdrop[j], pmin: I.pmin[j], pupk: I.pupk[j], brsi: I.brsi[j], rsi: I.rsi[j] });
  }
}
const row = (nm, a) => { if (!a.length) return; const W = a.reduce((s, x) => s + x.w, 0); const coins = new Set(a.map((x) => x.coin)).size; const fc = {}; for (const x of a) { (fc[x.coin] = fc[x.coin] || [0, 0, 0]); fc[x.coin][0] += x.w; fc[x.coin][1] += x.w * x.fall; fc[x.coin][2] += x.w * x.d; } const v = Object.values(fc); console.log(nm.padEnd(22), String(a.length).padStart(6), 'деньги', (W / 1e6).toFixed(0).padStart(6) + 'M', 'падение', (a.reduce((s, x) => s + x.w * x.fall, 0) / W).toFixed(1), 'дни', (a.reduce((s, x) => s + x.w * x.d, 0) / W).toFixed(0), '| по монетам', (v.reduce((s, x) => s + x[1] / x[0], 0) / v.length).toFixed(1), (v.reduce((s, x) => s + x[2] / x[0], 0) / v.length).toFixed(0), 'монет', coins); };
row('все', recs);
const B = { pday: [[1, 2], [2, 4], [4, 8], [8, 16], [16, 31], [31, 9999]], pdrop: [[-999, 0], [0, 5], [5, 10], [10, 20], [20, 30], [30, 999]], bdrop: [[-999, 0], [0, 5], [5, 10], [10, 20], [20, 999]], pmin: [[-1, 3], [3, 8], [8, 15], [15, 30], [30, 9999]], pupk: [[0, 0.95], [0.95, 0.98], [0.98, 0.995], [0.995, 2]], brsi: [[0, 30], [30, 40], [40, 50], [50, 60], [60, 101]] };
for (const k in B) { console.log('—', k); for (const [a, b] of B[k]) row(`${k} ${a}…${b}`, recs.filter((x) => x[k] >= a && x[k] < b)); }
