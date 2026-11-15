/* tune1 (шлифовка покупок у дна): помощники поверх combo2_sim.js (только чтение общих файлов).
   Свои индикаторы на каждой монете (по found/liq_extra.json, как liq_inject.js / ls_inject.js):
   - oiddW{W}: OI BTC к максимуму за W дней, % (W=30 — то же, что oidd30);
   - dlyT{w}_{t}_{x}_{y}_{W}{m}: отложенная после выноса — за w дней OI (окно макс. W) был ниже t, сейчас выше t, lsr > x, мин. lsr за w дней < y;
     m = 'f' — только первый день, 'a' — все дни, 'kN' — первые N дней подряд.
   S0 — combo2 (59 правил). setBuy(S, i, rule) — заменить правило покупки i (0 — капитуляция, 1 — отложенная, 2 — волна ликвидаций).
   ev(G, S) → сводка по группам и сегментам; cmp(R, B) → доход, строгая всей выборки и сегментов. */
const Z = require('./combo2_sim.js'); const { K, c } = Z; const fs = require('fs');
const EX = JSON.parse(fs.readFileSync(__dirname + '/found/liq_extra.json', 'utf8'));
const S0 = Z.build({ a1: true, as: true, cm2: true, b65: 'list' });
const at = new Map(); EX.t.forEach((t, i) => at.set(t, i));
function series(X, key) { let last = NaN; const a = new Float64Array(X.n); for (let i = 0; i < X.n; i++) { const k = at.get(X.t[i]); if (k != null && EX[key][k] != null) last = EX[key][k]; else if (k == null) last = NaN; a[i] = last; } return a; }
function fix(a) { let last = NaN; return a.map((x) => { if (x > 0 && !(x < 0.7 * last)) last = x; else if (x > 0 && x < 0.7 * last) return last; return x > 0 ? x : last; }); }
function oic(X) { return X._oic || (X._oic = fix(series(X, 'boic'))); }
function oidd(X, W) {
  const k = 'oiddW' + W; if (X.ind[k]) return X.ind[k];
  const o = oic(X), a = new Float64Array(X.n);
  for (let i = 0; i < X.n; i++) { let m = -Infinity; for (let j = Math.max(0, i - W + 1); j <= i; j++) if (o[j] > m) m = o[j]; a[i] = (o[i] / m - 1) * 100; }
  return (X.ind[k] = a);
}
// как ls_inject: минимум по окну w; NaN в окне или неполное окно — NaN
const mn = (a, w, n) => { const o = new Float64Array(n); for (let i = 0; i < n; i++) { if (i < w - 1) { o[i] = NaN; continue; } let m = Infinity, bad = false; for (let j = i - w + 1; j <= i; j++) { if (isNaN(a[j])) { bad = true; break; } if (a[j] < m) m = a[j]; } o[i] = bad ? NaN : m; } return o; };
function dly(X, { w = 20, t = -28, x = 1.0, y = 0.9, W = 30, m = 'f' } = {}) {
  const k = `dlyT${w}_${t}_${x}_${y}_${W}${m}`; if (X.ind[k]) return k;
  const n = X.n, oi = oidd(X, W), lsr = X.ind.lsr, om = mn(oi, w, n), lm = mn(lsr, w, n), on = new Float64Array(n), f = new Float64Array(n);
  for (let i = 0; i < n; i++) on[i] = om[i] < t && oi[i] > t && lsr[i] > x && lm[i] < y ? 1 : 0;
  if (m === 'a') f.set(on);
  else { const N = m === 'f' ? 1 : +m.slice(1); let r = 0; for (let i = 0; i < n; i++) { r = on[i] ? r + 1 : 0; f[i] = r >= 1 && r <= N ? 1 : 0; } }
  X.ind[k] = f; return k;
}
function prep(G, fn) { for (const g in G) for (const X of G[g]) fn(X); }
const setBuy = (S, i, r) => ({ ...S, rules: S.rules.map((x, q) => (q === i ? r : x)) });
const insBuy = (S, i, r) => ({ ...S, rules: [...S.rules.slice(0, i), r, ...S.rules.slice(i)] });
const GR = ['sel', 'ex', 'rnd'];
const ev = (G, S, gs = GR) => { const r = Z.evc(G, S, gs); return { S: Z.sum(r), r }; };
function cmp(A, B) {
  const o = { inc: {}, st: {} };
  for (const s of ['all', 'big', 'alt', 'meme']) { o.inc[s] = Z.inc(A.S, s) - Z.inc(B.S, s); o.st[s] = Z.strict(A.S, B.S, s); }
  o.ok = Object.values(o.st).every((v) => !v.length) && ['big', 'alt', 'meme'].every((s) => o.inc[s] >= -1e-9);
  return o;
}
const fmt = (o) => `доход ${o.inc.all >= 0 ? '+' : ''}${o.inc.all.toFixed(3)} (кр ${o.inc.big.toFixed(3)} ал ${o.inc.alt.toFixed(3)} мем ${o.inc.meme.toFixed(3)}) ${o.ok ? '✔' : '· ' + Object.entries(o.st).filter(([, v]) => v.length).map(([s, v]) => s + ':' + v.join(',')).join(' ')}`;
const meds = (A) => GR.concat(A.S.n100 ? ['n100'] : []).map((g) => `${A.S[g].all.med.toFixed(0)}/${A.S[g].all.pos}/${A.S[g].all.hpos}`).join(' | ');
module.exports = { Z, K, c, EX, S0, oidd, dly, prep, setBuy, insBuy, ev, cmp, fmt, meds, GR };
