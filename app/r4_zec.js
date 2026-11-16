/* r4: ZEC как отдельная монета для проверок (нет в группах). Цены — scratchpad/imp4_zec.json (Yahoo, по 2026-11-13); рыночные индикаторы — с BTC той же даты;
   свои — hi90, up90, rel180, beta180/corr180/vol180 (как agent4c_sim.coinFeatures), age, флаги сегмента (альт). Использование: const ZX = require('./r4_zec.js').zec() */
const fs = require('fs'), L = require('./r4_lib.js'), { G, P } = L;
function zec(file = process.env.IMP4_ZEC || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp4_zec.json') {
  const Zd = JSON.parse(fs.readFileSync(file, 'utf8')), B = G.sel.find((X) => X.name === 'BTC');
  const tt = [], cc = [];
  for (let k = 0; k < Zd.t.length; k++) { const i = Zd.t[k] - B.t[0]; if (i >= 0 && i < B.n && B.t[i] === Zd.t[k] && Zd.c[k] > 0) { tt.push(i); cc.push(Zd.c[k]); } }
  const n = cc.length, X = { name: 'ZEC', n, ind: {}, seg: 'alt', grp: 'zec' };
  for (const k in B.ind) { if (k === '_ep0') continue; const a = new Float64Array(n); for (let q = 0; q < n; q++) a[q] = B.ind[k][tt[q]]; X.ind[k] = a; }
  const c = Float64Array.from(cc), I = X.ind; I.c = c; I.h = c; I.l = c; X.c = c; X.h = c; X.l = c; X.t = I.t;
  const b = Float64Array.from(tt.map((i) => B.c[i])); I.btcp = b;
  I.hi90 = Float64Array.from(c, (x, i) => { for (let j = Math.max(0, i - 6); j <= i; j++) { let top = j >= 60; for (let q = Math.max(0, j - 89); q < j && top; q++) if (c[q] > c[j]) top = false; if (top) return 1; } return 0; });
  I.up90 = Float64Array.from(c, (x, i) => { let m = Infinity; for (let j = Math.max(0, i - 89); j <= i; j++) if (c[j] < m) m = c[j]; return (x / m - 1) * 100; });
  I.rel180 = Float64Array.from(c, (x, i) => (i >= 180 ? ((x / c[i - 180]) / (b[i] / b[i - 180]) - 1) * 100 : NaN));
  { const w = 180, beta = new Float64Array(n), vol = new Float64Array(n), corr = new Float64Array(n); let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, k = 0; const q = [];
    for (let i = 0; i < n; i++) { let x = NaN, y = NaN; if (i > 0) { x = Math.log(b[i] / b[i - 1]); y = Math.log(c[i] / c[i - 1]); } q.push([x, y]); if (!isNaN(x)) { sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; k++; }
      if (q.length > w) { const [x0, y0] = q.shift(); if (!isNaN(x0)) { sx -= x0; sy -= y0; sxx -= x0 * x0; syy -= y0 * y0; sxy -= x0 * y0; k--; } }
      if (k >= w * 0.8) { const vx = sxx / k - (sx / k) ** 2, vy = syy / k - (sy / k) ** 2, cv = sxy / k - (sx / k) * (sy / k); beta[i] = cv / vx; vol[i] = Math.sqrt(Math.max(vy, 0) * 365) * 100; corr[i] = cv / Math.sqrt(vx * vy); } else { beta[i] = NaN; vol[i] = NaN; corr[i] = NaN; } }
    I.beta180 = beta; I.vol180 = vol; I.corr180 = corr; }
  I.age = Float64Array.from(c, (x, i) => i); I.agei = I.age;
  const f = (v) => new Float64Array(n).fill(v); I.isbig = f(0); I.meme = f(0); I.isalt = f(1);
  return X;
}
module.exports = { zec };
if (require.main === module) {
  const R4 = require('./r4_sim.js'), { cls } = require('./r4_r5.js'), X = zec(), I = X.ind;
  console.log('ZEC', L.day(X.t[0]), '…', L.day(X.t[X.n - 1]), 'дней', X.n);
  for (const part of ['full', 'h1', 'h2']) console.log(part, 'combo4 к DCA, %:', R4.E(X, L.S0, part, L.pol0).toFixed(1), '| без эйфории', R4.E(X, (() => { const S = L.clone(); S.rules.pop(); return S; })(), part, L.pol0).toFixed(1), '| без отложенной', R4.E(X, L.S0, part, null).toFixed(1));
  // по годам: что продавали/покупали (класс → $), цена
  const { tr } = R4.edge(X, L.S0, 0, 'full', true, L.pol0); const Y = {};
  for (const t of tr) { const y = L.day(X.t[t.i]).slice(0, 4), k = cls(t.r) + (t.rel && !t.r ? ' (долг)' : ''); Y[y] = Y[y] || {}; Y[y][k] = (Y[y][k] || 0) + t.amt; }
  for (const y in Y) console.log(y, Object.entries(Y[y]).map(([k, v]) => `${k} ${Math.round(v)}`).join(', '));
  // ралли 2025: сделки с августа 2025 по январь 2026
  let cash = 0;
  for (const t of tr) { const d = L.day(X.t[t.i]); if (d >= '2025-08-15' && d <= '2026-01-31' && (t.s < 0 ? t.amt > 50 : t.amt > 200)) console.log(d, t.s < 0 ? 'ПРОДАЖА' : 'покупка', Math.round(t.amt), 'цена', t.p.toFixed(0), cls(t.r), 'fng', I.fng[t.j], 'usdt', I.usdt[t.j].toFixed(2), 'othd', I.othd[t.j].toFixed(1), 'rel180', I.rel180[t.j].toFixed(0), 'up90', I.up90[t.j].toFixed(0), 'beta', I.beta180[t.j].toFixed(2)); }
}
