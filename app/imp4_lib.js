/* imp4 (резкие обвалы): помощники. Основа — found/combo-best.json (F + C1.25 + C6), быстрый оценщик agent_sim.js через combo_sim.js.
   path(X, S, lag) — повтор edge() без шорта с дневным состоянием (монеты, резерв, доля в монете, сработавшее правило);
   market(G) — дневной «рынок» по всем монетам групп (медиана дневной доходности альтов, BTC); crashes() — список обвалов. Только прошлое для решений. */
const K = require('./combo_sim.js');
const fs = require('fs');
const BASE = JSON.parse(fs.readFileSync(__dirname + '/found/combo-best.json', 'utf8'));
const S0 = { base: BASE.base, rules: BASE.rules };
const FEE = 0.001, UNIT = 10;
const day = (t) => new Date(t * 864e5).toISOString().slice(0, 10);
const tOf = (s) => Math.round(Date.parse(s + 'T00:00:00Z') / 864e5);
const compile = (X, rules) => rules.filter((r) => r.conds.every((cd) => X.ind[cd.ind])).map((r) => ({ act: r.act, cs: r.conds.map((cd) => [X.ind[cd.ind], cd.op === '<', cd.v]), r }));
function decide(R, j) { for (let q = 0; q < R.length; q++) { const cs = R[q].cs; let ok = true; for (let k = 0; k < cs.length; k++) { const v = cs[k][0][j]; if (!(cs[k][1] ? v < cs[k][2] : v > cs[k][2])) { ok = false; break; } } if (ok) return q; } return -1; }
function path(X, S, lag = 0) {
  const n = X.n, c = X.c, R = compile(X, S.rules);
  const U = new Float64Array(n), C = new Float64Array(n), Q = new Int16Array(n), A = new Float64Array(n), DU = new Float64Array(n);
  let cash = 0, units = 0, du = 0;
  for (let i = 0; i < n; i++) {
    const p = c[i], j = i - 1 - lag; du += (UNIT * (1 - FEE)) / p;
    const q = j >= 0 ? decide(R, j) : -2, before = cash;
    const a = q >= 0 ? R[q].act : q === -2 ? 1 : S.base;
    cash += UNIT;
    if (a < 0) { const amt = -a * units * p; if (amt > 0) { units -= amt / p; cash += amt * (1 - FEE); } }
    else if (a > 0) { const amt = Math.min(cash, UNIT + (a - 1) * before); units += (amt * (1 - FEE)) / p; cash -= amt; }
    U[i] = units; C[i] = cash; Q[i] = q >= 0 ? R[q].r.__id ?? q : q; A[i] = a; DU[i] = du;
  }
  return { U, C, Q, A, DU, eq: (i) => U[i] * c[i] + C[i], dca: (i) => DU[i] * c[i], expo: (i) => (U[i] * c[i]) / (U[i] * c[i] + C[i]) };
}
// рынок: медиана дневной доходности по монетам (кроме BTC и стейблов), BTC
function market(G) {
  const by = new Map();
  for (const g in G) for (const X of G[g]) { if (X.name === 'BTC' || /USD|CHF|DAI/.test(X.name)) continue; for (let i = 1; i < X.n; i++) { const r = X.c[i] / X.c[i - 1] - 1; if (!isFinite(r) || Math.abs(r) > 3) continue; const t = X.t[i]; if (!by.has(t)) by.set(t, []); by.get(t).push(r); } }
  const btcX = Object.values(G).flat().find((X) => X.name === 'BTC');
  const B = new Map(); for (let i = 1; i < btcX.n; i++) B.set(btcX.t[i], btcX.c[i] / btcX.c[i - 1] - 1);
  const T = [...by.keys()].sort((a, b) => a - b), M = new Map();
  for (const t of T) { const v = by.get(t); if (v.length < 8) continue; M.set(t, { alt: K.med(v), n: v.length, btc: B.get(t) }); }
  // xret(t, w): медиана по монетам их собственной доходности от t−w до t (обе цены есть)
  const CO = []; for (const g in G) for (const X of G[g]) if (X.name !== 'BTC' && !/USD|CHF|DAI/.test(X.name)) CO.push(X);
  const cache = new Map();
  const xret = (t, w) => { const key = t * 1000 + w; if (cache.has(key)) return cache.get(key); const v = []; for (const X of CO) { const i = t - X.t[0], j = i - w; if (j < 0 || i >= X.n || X.t[i] !== t || X.t[j] !== t - w) continue; const r = X.c[i] / X.c[j] - 1; if (isFinite(r)) v.push(r); } const o = v.length >= 8 ? K.med(v) : NaN; cache.set(key, o); return o; };
  return { M, btcX, xret };
}
module.exports = { K, BASE, S0, path, market, day, tOf, compile, decide, FEE, UNIT };
// ZEC (нет в группах): рыночные индикаторы — с BTC той же даты, свои — c, h, l, hi90, up90, rel180 (как в lab.js/agent_sim/combo_inject)
function zecX(G, file = (process.env.IMP4_ZEC || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/imp4_zec.json')) {
  const Z = JSON.parse(fs.readFileSync(file, 'utf8')), B = G.sel.find((X) => X.name === 'BTC');
  const i0 = Z.t.indexOf(B.t[0]) >= 0 ? 0 : 0, tt = [], cc = [];
  for (let k = 0; k < Z.t.length; k++) { const i = Z.t[k] - B.t[0]; if (i >= 0 && i < B.n && B.t[i] === Z.t[k]) { tt.push(i); cc.push(Z.c[k]); } }
  const n = cc.length, X = { name: 'ZEC', n, ind: {} };
  for (const k in B.ind) { const a = new Float64Array(n); for (let q = 0; q < n; q++) a[q] = B.ind[k][tt[q]]; X.ind[k] = a; }
  const c = Float64Array.from(cc); X.ind.c = c; X.ind.h = c; X.ind.l = c; X.c = c; X.h = c; X.l = c; X.t = X.ind.t;
  const b = X.ind.btcp || Float64Array.from(tt.map((i) => B.c[i]));
  X.ind.hi90 = Float64Array.from(c, (x, i) => { for (let j = Math.max(0, i - 6); j <= i; j++) { let top = j >= 60; for (let q = Math.max(0, j - 89); q < j && top; q++) if (c[q] > c[j]) top = false; if (top) return 1; } return 0; });
  X.ind.up90 = Float64Array.from(c, (x, i) => { let m = Infinity; for (let j = Math.max(0, i - 89); j <= i; j++) if (c[j] < m) m = c[j]; return (x / m - 1) * 100; });
  X.ind.rel180 = Float64Array.from(c, (x, i) => (i >= 180 && b[i] > 0 && b[i - 180] > 0 ? ((x / c[i - 180]) / (b[i] / b[i - 180]) - 1) * 100 : NaN));
  X.ind.btcp = b;
  return X;
}
module.exports.zecX = zecX;
