/* Межмонетные индикаторы структуры рынка (только прошлое; вселенная — 81 монета отбора, экзамена и 50 случайных, без 100 новых, чтобы 100 новых остались независимыми).
   На каждый день t:
     disp30 — разброс (ст. откл. по монетам) лог-доходностей за 30 дней; нужно ≥ 15 монет с историей;
     herd30 — средняя по монетам корреляция дневных лог-доходностей с BTC за 30 дней (стадность);
     lo90f  — доля монет у своего 90-дн. минимума (закрытие ≤ 1,02 × минимум 90 дн.), %;
     hi90f  — доля монет у своего 90-дн. максимума (≥ 0,98 × максимум), %;
     *_pr   — процентиль значения среди всех прошлых значений этого индикатора (≥ 365 дней истории), 0…1.
   Индикаторы кладутся в X.ind каждой монеты (по дате t). Использование: require('./wild_mkt.js')(W.G) */
module.exports = function (G) {
  if (G._mkt) return G._mkt;
  const U = [...G.sel, ...G.ex, ...G.rnd];
  let t0 = Infinity, t1 = -Infinity; for (const X of U) { t0 = Math.min(t0, X.t[0]); t1 = Math.max(t1, X.t[X.n - 1]); }
  const N = t1 - t0 + 1, idx = U.map((X) => { const m = new Int32Array(N).fill(-1); for (let i = 0; i < X.n; i++) m[X.t[i] - t0] = i; return m; });
  const btc = U.find((X) => X.name === 'BTC'), bi = idx[U.indexOf(btc)];
  const disp = new Float64Array(N).fill(NaN), herd = new Float64Array(N).fill(NaN), lo = new Float64Array(N).fill(NaN), hi = new Float64Array(N).fill(NaN);
  const lr = (X, i) => Math.log(X.c[i] / X.c[i - 1]);
  for (let d = 90; d < N; d++) {
    const rs = [], cs = []; let nl = 0, nh = 0, nn = 0;
    const b = bi[d];
    for (let u = 0; u < U.length; u++) {
      const X = U[u], i = idx[u][d]; if (i < 90) continue;
      if (!(X.c[i] > 0 && X.c[i - 30] > 0)) continue;
      rs.push(Math.log(X.c[i] / X.c[i - 30]));
      let mn = Infinity, mx = -Infinity; for (let k = i - 89; k <= i; k++) { if (X.c[k] < mn) mn = X.c[k]; if (X.c[k] > mx) mx = X.c[k]; }
      nn++; if (X.c[i] <= 1.02 * mn) nl++; if (X.c[i] >= 0.98 * mx) nh++;
      if (X !== btc && b >= 30) { // корреляция за 30 дней с BTC (по датам)
        let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, m = 0;
        for (let k = 0; k < 30; k++) { const ix = idx[u][d - k], ib = bi[d - k]; if (ix < 1 || ib < 1) continue; const x = lr(X, ix), y = lr(btc, ib); if (!isFinite(x) || !isFinite(y)) continue; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y; m++; }
        if (m >= 25) { const cv = sxy / m - (sx / m) * (sy / m), vx = sxx / m - (sx / m) ** 2, vy = syy / m - (sy / m) ** 2; if (vx > 0 && vy > 0) cs.push(cv / Math.sqrt(vx * vy)); }
      }
    }
    if (rs.length >= 15) { const mu = rs.reduce((a, b) => a + b, 0) / rs.length; disp[d] = Math.sqrt(rs.reduce((a, b) => a + (b - mu) ** 2, 0) / rs.length); }
    if (cs.length >= 10) herd[d] = cs.reduce((a, b) => a + b, 0) / cs.length;
    if (nn >= 15) { lo[d] = (100 * nl) / nn; hi[d] = (100 * nh) / nn; }
  }
  // процентиль среди прошлых значений (≥ 365 значений)
  const prc = (a) => { const o = new Float64Array(N).fill(NaN), past = []; for (let d = 0; d < N; d++) { if (!isFinite(a[d])) continue; if (past.length >= 365) { let lo = 0, h = past.length; while (lo < h) { const m = (lo + h) >> 1; if (past[m] < a[d]) lo = m + 1; else h = m; } o[d] = lo / past.length; } let lo2 = 0, h2 = past.length; while (lo2 < h2) { const m = (lo2 + h2) >> 1; if (past[m] < a[d]) lo2 = m + 1; else h2 = m; } past.splice(lo2, 0, a[d]); } return o; };
  const M = { t0, N, disp30: disp, herd30: herd, lo90f: lo, hi90f: hi };
  for (const k of ['disp30', 'herd30', 'lo90f', 'hi90f']) M[k + '_pr'] = prc(M[k]);
  for (const g in G) for (const X of G[g]) for (const k of Object.keys(M)) if (M[k] instanceof Float64Array) { const a = new Float64Array(X.n).fill(NaN); for (let i = 0; i < X.n; i++) { const d = X.t[i] - t0; if (d >= 0 && d < N) a[i] = M[k][d]; } X.ind[k] = a; }
  G._mkt = M; return M;
};
