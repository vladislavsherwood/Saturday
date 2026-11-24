/* op, круг 2: сигналы круга 1 — (а) сверх состояния самой крипты: избыток к средней монеты в той же клетке
   (решение combo6 в этот день: покупка из резерва / продажа / взнос × BTC выше/ниже 200д), только дни, где признак определён;
   (б) не совпадение дат: круговой сдвиг ряда признака относительно крипты (300 сдвигов внутри отрезка, где признак есть; минимум 90 дн от краёв);
   (в) список эпизодов (даты начала, дней) — на чём держится. Запуск: node op_r2.js (лог scratchpad/op/r2.txt) */
const O = require('./op_lib.js'), { M, T0, XS, BY, S6, day, T } = O;
O.tee('r2');
const R6 = S6.rules;
function cls(X) { const R = R6.filter((r) => r.conds.every((cd) => X.ind[cd.ind])); const a = new Int8Array(X.n); for (let j = 0; j < X.n; j++) { for (const r of R) if (r.conds.every((cd) => { const v = X.ind[cd.ind][j]; return cd.op === '<' ? v < cd.v : v > cd.v; })) { a[j] = r.act > 1.0001 ? 1 : r.act < 0 ? -1 : 0; break; } } return a; }
const H = [30, 90];
const PRE = XS.map((X) => { const I = X.ind, cl = cls(X); const f = H.map((h) => Float64Array.from({ length: X.n }, (_, j) => (j >= 60 && j + h < X.n ? Math.log(X.c[j + h] / X.c[j]) : NaN)));
  const cell = Int8Array.from({ length: X.n }, (_, j) => (cl[j] + 1) * 2 + (I.btc200[j] >= 1 ? 1 : 0)); const k = Int32Array.from(I.t, (t) => t - T0); return { X, f, cell, k }; });
// события: [имя, функция календарного индекса k → true/false/NaN (не определено)]
const g = (a, v) => (k) => (isFinite(M[a][k]) ? M[a][k] > v : NaN), l = (a, v) => (k) => (isFinite(M[a][k]) ? M[a][k] < v : NaN);
const EVS = [
  ['VIX/SMA50 > 1,5 (st B)', g('op_vixr', 1.5)], ['VIX9D/VIX3M > 1,1', g('op_ts', 1.1)], ['VIX9D/VIX3M > 1,25', g('op_ts', 1.25)], ['VIX9D/VIX3M > 1', g('op_ts', 1)],
  ['VIX3M/VIX6M > 1', g('op_ts6', 1)], ['VIX9D/VIX3M < 0,8', l('op_ts', 0.8)],
  ['SKEW − ср.250 > +10', g('op_skewz', 10)], ['SKEW > 150', g('op_skew', 150)], ['VIX/реализ. S&P < 0,9', l('op_vrp', 0.9)],
  ['put/call акции 10д > 0,8', g('op_pce10', 0.8)], ['put/call акции 10д > 0,75', g('op_pce10', 0.75)], ['put/call акции z > 2', g('op_pcez', 2)], ['put/call акции z < −1,5', l('op_pcez', -1.5)], ['put/call день > 1,0', g('op_pce', 1.0)],
  ['MOVE/SMA50 > 1,3', g('op_mover', 1.3)], ['MOVE < 70', l('op_move', 70)],
  ['реализ. вол BTC / ср.90 > 1,5', g('op_rvr', 1.5)],
  ['DVOL / реализ. < 0,9', l('op_dvrv', 0.9)], ['DVOL / реализ. < 1,0', l('op_dvrv', 1.0)], ['DVOL за 7 дн ×1,25', g('op_dvr7', 1.25)], ['DVOL/SMA50 > 1,3', g('op_dvr', 1.3)], ['DVOL/SMA50 < 0,8', l('op_dvr', 0.8)],
  ['DVOL ETH / BTC > 1,4', (k) => (isFinite(M.op_dv[k]) ? M.op_dve[k] / M.op_dv[k] > 1.4 : NaN)], ['DVOL > 90', g('op_dv', 90)],
];
function exc(ev, sh, lo, hi, mode) {
  const L = hi - lo + 1, E = new Uint8Array(L); for (let q = 0; q < L; q++) { const k0 = lo + ((q - sh) % L + L) % L; E[q] = ev(k0) === true ? 1 : 0; }
  return H.map((h, hj) => { let t = 0, nn = 0; for (const p of PRE) { const r = p.f[hj]; const s = new Float64Array(6), m = new Float64Array(6); let sa = 0, ma = 0;
      for (let j = 0; j < p.X.n; j++) { const k = p.k[j]; if (k < lo || k > hi) continue; const v = r[j]; if (!isFinite(v)) continue; s[p.cell[j]] += v; m[p.cell[j]]++; sa += v; ma++; }
      let se = 0, me = 0; for (let j = 0; j < p.X.n; j++) { const k = p.k[j]; if (k < lo || k > hi || !E[k - lo]) continue; const v = r[j]; if (!isFinite(v)) continue; const b = mode === 'all' ? sa / ma : s[p.cell[j]] / m[p.cell[j]]; se += v - b; me++; }
      if (me >= 5) { t += se / me; nn++; } } return nn ? t / nn : NaN; });
}
const pc = (v) => (isFinite(v) ? (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%' : '—');
function eps(ev, lo, hi) { const o = []; let st = -1, last = -1e9, d = 0; for (let k = lo; k <= hi; k++) if (ev(k) === true) { if (k - last > 10) { if (st >= 0) o.push([st, d]); st = k; d = 0; } last = k; d++; } if (st >= 0) o.push([st, d]); return o; }
const KLO = Math.min(...PRE.map((p) => p.k[0])), KHI = Math.max(...PRE.map((p) => p.k[p.k.length - 1]));
console.log('событие'.padEnd(32), 'к обычному 30/90 | к клетке 30/90 | p сдвига 30/90 (клетка) | эпизоды (начало:дней)');
const res = [];
for (const [nm, ev] of EVS) {
  let lo = KLO, hi = KHI; while (lo < hi && !isFinite(ev(lo))) lo++; while (hi > lo && !isFinite(ev(hi))) hi--;
  const a = exc(ev, 0, lo, hi, 'all'), b = exc(ev, 0, lo, hi, 'cell'); const L = hi - lo + 1; let s = 777; const SH = []; for (let q = 0; q < 300; q++) { s = (s * 1103515245 + 12345) % 2147483648; SH.push(90 + (s % (L - 180))); }
  const sh = SH.map((x) => exc(ev, x, lo, hi, 'cell')); const p = H.map((h, hj) => sh.filter((x) => Math.sign(x[hj]) === Math.sign(b[hj]) && Math.abs(x[hj]) >= Math.abs(b[hj])).length / sh.length);
  const E = eps(ev, lo, hi);
  res.push({ nm, a, b, p, E: E.map(([k, d]) => [day(T0 + k), d]) });
  console.log(`${nm.padEnd(32)} ${pc(a[0])} / ${pc(a[1])} | ${pc(b[0])} / ${pc(b[1])} | p ${p[0].toFixed(2)} / ${p[1].toFixed(2)} | ${E.length} эп.: ${E.slice(0, 16).map(([k, d]) => day(T0 + k).slice(0, 7) + ':' + d).join(' ')}${E.length > 16 ? ' …' : ''}`);
}
require('fs').writeFileSync(O.LOG + 'r2.json', JSON.stringify(res));
