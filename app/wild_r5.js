/* Круг 5. Самообучение: доля продаж подстраивается под точность прошлых продаж (только созревшие исходы — прошлое).
   Исход продажи (день i, цена p): o = ln(цена через H дней / p); o > 0 — продали зря (монета выросла). Оценка — среднее o по деньгам.
   (a) «своя память»: по прошлым продажам ЭТОЙ монеты (созревшим: i + H ≤ j), нужно ≥ nmin созревших дней продаж;
   (b) «память рынка»: по продажам ЭТОГО КЛАССА правил у всех 81 монет (сделки combo4, созревшие к дате решения), без текущей монеты.
   Множитель доли: k = clamp(exp(−γ·score), lo, hi). Запуск: node wild_r5.js > scratchpad/wild/r5.log */
const W = require('./wild_sim.js');
function own({ H = 180, g = 1, lo = 0.5, hi = 1.5, nmin = 10, side = 'sell' }) {
  return {
    init: () => ({ tr: [], k: 0, sw: 0, so: 0, n: 0 }),
    after: ({ i, s, sold, bought, p }) => { if (side === 'sell' && sold > 0) s.tr.push([i, p, sold]); if (side === 'buy' && bought > 0) s.tr.push([i, p, bought]); },
    act: ({ X, j, a, s }) => {
      while (s.k < s.tr.length && s.tr[s.k][0] + H <= j) { const [i, p, w] = s.tr[s.k++]; s.so += w * Math.log(X.c[i + H] / p); s.sw += w; s.n++; }
      if (s.n < nmin) return a;
      const sc = s.so / s.sw, k = Math.min(hi, Math.max(lo, Math.exp((side === 'sell' ? -g : g) * sc)));
      if (side === 'sell' && a < 0) return Math.max(-1, a * k);
      if (side === 'buy' && a > 1) return 1 + (a - 1) * k;
      return a;
    },
  };
}
// память рынка: сделки combo4 по всем монетам → по датам t: накопленные (сумма w·o, сумма w) по классу, созревшие к дате
const MK = {};
function market(H) {
  if (MK[H]) return MK[H];
  const ev = []; // [t созревания, класс, имя монеты, w, w·o]
  for (const g of ['sel', 'ex', 'rnd']) for (const X of W.G[g]) {
    const R = W.compile(X, W.BASE.rules), { tr } = W.edge(X, W.BASE, 0, 'full', true);
    for (const t of tr) if (t.s < 0 && t.q >= 0 && t.i + H < X.n) ev.push([X.t[t.i + H], W.cls(R[t.q].r), X.name, t.amt / t.p * X.c[t.i] /* $ */, 0, Math.log(X.c[t.i + H] / t.p)]);
  }
  ev.sort((x, y) => x[0] - y[0]);
  // для экономии — нормирую вес по монете: каждая продажа весит долю продаж монеты (иначе решают монеты с огромными позициями)
  const tot = {}; for (const e of ev) tot[e[2]] = (tot[e[2]] || 0) + e[3];
  for (const e of ev) { e[3] = e[3] / tot[e[2]]; e[4] = e[3] * e[5]; }
  return (MK[H] = ev);
}
function mkt({ H = 180, g = 1, lo = 0.5, hi = 1.5, nmin = 200, by = 'cls' }) {
  const ev = market(H);
  return {
    init: (X) => ({ k: 0, acc: {}, name: X.name }),
    act: ({ X, j, q, a, R, s }) => {
      const t = X.t[j];
      while (s.k < ev.length && ev[s.k][0] <= t) { const e = ev[s.k++]; if (e[2] === s.name) continue; const key = by === 'cls' ? e[1] : 'all'; const z = (s.acc[key] = s.acc[key] || [0, 0, 0]); z[0] += e[4]; z[1] += e[3]; z[2]++; }
      if (!(a < 0)) return a;
      const z = s.acc[by === 'cls' ? W.cls(R[q].r) : 'all']; if (!z || z[2] < nmin) return a;
      return Math.max(-1, a * Math.min(hi, Math.max(lo, Math.exp(-g * (z[0] / z[1])))));
    },
  };
}
module.exports = { own, mkt, market };
if (require.main === module) {
const arg = process.argv[2] || 'grid';
if (arg === 'grid') {
W.report('combo4');
for (const H of [90, 180, 365]) for (const g of [1, 2]) W.report(`своя продажи H${H} γ${g}`, W.BASE, W.POL, own({ H, g }));
W.report('своя продажи H180 γ2 0.75–1.25', W.BASE, W.POL, own({ H: 180, g: 2, lo: 0.75, hi: 1.25 }));
W.report('своя продажи H180 γ1 nmin 30', W.BASE, W.POL, own({ H: 180, g: 1, nmin: 30 }));
for (const H of [90, 180]) for (const g of [1, 2]) W.report(`своя покупки H${H} γ${g}`, W.BASE, W.POL, own({ H, g, side: 'buy' }));
for (const H of [90, 180, 365]) for (const g of [1, 2]) W.report(`рынок по классам H${H} γ${g}`, W.BASE, W.POL, mkt({ H, g }));
W.report('рынок все классы H180 γ2', W.BASE, W.POL, mkt({ H: 180, g: 2, by: 'all' }));
console.log(W.summary());
}
if (arg === 'split') {
  const show = (r) => { const B = W.base(); const out = []; for (const g of ['sel', 'ex', 'rnd']) r.R[g].forEach((x, i) => { const y = B[g][i]; for (const k of ['h1', 'h2']) if (x[k] < y[k] - 0.5 && (y[k] < 30 || x[k] < 0)) out.push(`${g}:${x.name}.${k} ${y[k].toFixed(1)}→${x[k].toFixed(1)}`); }); console.log('   хуже (слабые половины):', out.slice(0, 14).join(', ')); };
  for (const H of [180]) {
    show(W.report(`своя H${H} γ1 только вверх (lo 1)`, W.BASE, W.POL, own({ H, g: 1, lo: 1, hi: 1.5 })));
    show(W.report(`своя H${H} γ1 только вниз (hi 1)`, W.BASE, W.POL, own({ H, g: 1, lo: 0.5, hi: 1 })));
    show(W.report(`своя H${H} γ1 обе`, W.BASE, W.POL, own({ H, g: 1 })));
    show(W.report(`рынок H${H} γ1 только вверх`, W.BASE, W.POL, mkt({ H, g: 1, lo: 1, hi: 1.5 })));
    show(W.report(`рынок H${H} γ1 только вниз`, W.BASE, W.POL, mkt({ H, g: 1, lo: 0.5, hi: 1 })));
  }
}
if (arg === 'down') { // плато «память рынка, только ослабление» (hi 1)
  for (const H of [90, 180, 365]) for (const g of [1, 2, 4]) for (const lo of [0.5, 0.25]) W.report(`рынок вниз H${H} γ${g} lo${lo}`, W.BASE, W.POL, mkt({ H, g, lo, hi: 1 }));
  for (const nmin of [50, 500]) W.report(`рынок вниз H180 γ2 lo0.5 nmin${nmin}`, W.BASE, W.POL, mkt({ H: 180, g: 2, lo: 0.5, hi: 1, nmin }));
  W.report('рынок вниз H180 γ2 lo0.5 все классы вместе', W.BASE, W.POL, mkt({ H: 180, g: 2, lo: 0.5, hi: 1, by: 'all' }));
  console.log(W.summary(W.rows.slice(0)));
}

}
