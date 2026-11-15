/* «Кому подходит стратегия»: связь признаков монеты с результатом combo4 к DCA (181 монета: отбор, экзамен, 50 случайных, 100 новых).
   Описательно: признаки и результат на всей истории. Прогноз: признаки по 1-й половине истории → результат во 2-й половине (без заглядывания вперёд).
   Запуск: node fit_coins.js */
const P2 = require('./panicx_p2.js'), P = P2.P;
const pol = P2.Boost(2, { k: 0 }), S = P.base;
const all = Object.entries(P2.G).flatMap(([g, a]) => a.map((X) => ((X.grp = g), X)));
const L = (e) => Math.log1p(e / 100);
function feats(X, a, b) {
  const c = X.c, bt = X.ind.btcp, r = [], rb = [];
  for (let i = a + 1; i < b; i++) { const x = Math.log(c[i] / c[i - 1]); if (isFinite(x)) { r.push(x); const y = bt ? Math.log(bt[i] / bt[i - 1]) : NaN; rb.push(isFinite(y) ? y : 0); } }
  const n = r.length, m = r.reduce((s, x) => s + x, 0) / n, sd = Math.sqrt(r.reduce((s, x) => s + (x - m) ** 2, 0) / n);
  const mb = rb.reduce((s, x) => s + x, 0) / n, sb = Math.sqrt(rb.reduce((s, x) => s + (x - mb) ** 2, 0) / n);
  const cov = r.reduce((s, x, i) => s + (x - m) * (rb[i] - mb), 0) / n;
  let pk = 0, mdd = 0, cyc = 0, lo = Infinity, hi = 0, st = 0, above = 0, cnt = 0;
  for (let i = a; i < b; i++) {
    const p = c[i]; if (p > pk) pk = p; mdd = Math.max(mdd, 1 - p / pk);
    // циклы: рост ×2 от минимума, затем падение −50% от максимума
    if (st === 0) { lo = Math.min(lo, p); if (p > 2 * lo) { st = 1; hi = p; } } else { hi = Math.max(hi, p); if (p < 0.5 * hi) { cyc++; st = 0; lo = p; } }
    if (i >= a + 200) { let s = 0; for (let k = i - 199; k <= i; k++) s += c[k]; above += p > s / 200 ? 1 : 0; cnt++; }
  }
  const r30 = []; for (let i = a + 30; i < b; i += 30) r30.push(Math.log(c[i] / c[i - 30]));
  let ac = 0; if (r30.length > 4) { const mm = r30.reduce((s, x) => s + x, 0) / r30.length; let nu = 0, de = 0; for (let i = 1; i < r30.length; i++) nu += (r30[i] - mm) * (r30[i - 1] - mm); for (const x of r30) de += (x - mm) ** 2; ac = nu / de; }
  const sk = r.reduce((s, x) => s + ((x - m) / sd) ** 3, 0) / n;
  return { vol: sd * Math.sqrt(365) * 100, corr: cov / (sd * sb), beta: cov / (sb * sb), bh: Math.log(c[b - 1] / c[a]), cagr: (Math.exp(Math.log(c[b - 1] / c[a]) * 365 / (b - a)) - 1) * 100, mdd: mdd * 100, cyc: cyc / ((b - a) / 365), trend: cnt ? (above / cnt) * 100 : NaN, ac30: ac, skew: sk, days: b - a };
}
const rows = [];
for (const X of all) {
  const h = Math.floor(X.n / 2);
  rows.push({ name: X.name, grp: X.grp, seg: X.seg, n: X.n, f: P.E(X, S, 'full', pol), h1: P.E(X, S, 'h1', pol), h2: P.E(X, S, 'h2', pol), F: feats(X, 0, X.n), F1: feats(X, 0, h) });
}
// годовой перевес над DCA: лог(1 + результат) / лет, в % (иначе длинная история раздувает результат)
const A = (e, d) => (Math.exp(Math.log1p(e / 100) / (d / 365)) - 1) * 100;
for (const r of rows) { r.af = A(r.f, r.n); r.ah2 = A(r.h2, r.n - Math.floor(r.n / 2)); }
const rank = (a) => { const o = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]), r = new Array(a.length); o.forEach(([, i], k) => (r[i] = k)); return r; };
const sp = (x, y) => { const ok = x.map((v, i) => isFinite(v) && isFinite(y[i])); const a = rank(x.filter((_, i) => ok[i])), b = rank(y.filter((_, i) => ok[i])); const n = a.length, ma = (n - 1) / 2; let nu = 0, da = 0, db = 0; for (let i = 0; i < n; i++) { nu += (a[i] - ma) * (b[i] - ma); da += (a[i] - ma) ** 2; db += (b[i] - ma) ** 2; } return nu / Math.sqrt(da * db); };
const med = (a) => { const s = a.filter(isFinite).sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
const K = ['vol', 'corr', 'beta', 'bh', 'cagr', 'mdd', 'cyc', 'trend', 'ac30', 'skew', 'days'];
const NM = { vol: 'волатильность, %/год', corr: 'корреляция с BTC', beta: 'бета к BTC', bh: 'рост купи-и-держи (лог)', cagr: 'годовой рост, %', mdd: 'макс. просадка, %', cyc: 'циклов ×2/−50% в год', trend: 'доля дней выше SMA200, %', ac30: 'автокорр. 30-дн. доходностей', skew: 'асимметрия дневных доходностей', days: 'длина истории, дней' };
console.log(`монет ${rows.length}; медиана combo4 к DCA ${med(rows.map((r) => r.f)).toFixed(0)}%, в минусе ${rows.filter((r) => r.f < 0).length}`);
console.log('\nпризнак | связь с результатом (вся история, Спирмен) | прогноз: признак 1-й половины → результат 2-й половины');
for (const k of K) console.log(NM[k].padEnd(32), '|', sp(rows.map((r) => r.F[k]), rows.map((r) => r.af)).toFixed(2).padStart(6), '|', sp(rows.map((r) => r.F1[k]), rows.map((r) => r.ah2)).toFixed(2).padStart(6));
console.log('\nтерцили признака 1-й половины → медиана результата 2-й половины, % (и доля половин в минусе)');
for (const k of K) {
  const v = rows.filter((r) => isFinite(r.F1[k])).sort((x, y) => x.F1[k] - y.F1[k]), t = Math.floor(v.length / 3), parts = [v.slice(0, t), v.slice(t, 2 * t), v.slice(2 * t)];
  console.log(NM[k].padEnd(32), parts.map((p) => `${p[0].F1[k].toFixed(2)}…${p[p.length - 1].F1[k].toFixed(2)}: ${med(p.map((r) => r.ah2)).toFixed(0)}%/год (${Math.round((p.filter((r) => r.h2 < 0).length / p.length) * 100)}%)`).join(' | '));
}
console.log('\nсегменты (вся история): ' + ['big', 'alt', 'meme'].map((s) => { const a = rows.filter((r) => r.seg === s); return `${s} ${a.length}: медиана ${med(a.map((r) => r.af)).toFixed(0)}%/год, в минусе ${a.filter((r) => r.f < 0).length}`; }).join(' | '));
console.log('\nхудшие 15 монет:'); rows.slice().sort((a, b) => a.f - b.f).slice(0, 15).forEach((r) => console.log(`  ${r.name} (${r.seg}, ${r.grp}) ${r.f.toFixed(0)}% (${r.af.toFixed(0)}%/год) | вол ${r.F.vol.toFixed(0)} корр ${r.F.corr.toFixed(2)} рост ${r.F.bh.toFixed(2)} просадка ${r.F.mdd.toFixed(0)} циклов ${r.F.cyc.toFixed(2)} SMA200 ${r.F.trend.toFixed(0)}% дней ${r.n}`));
require('fs').writeFileSync(process.argv[2] || '/tmp/claude-0/-home-user-Saturday/15711ac5-c34f-5060-9e22-6f2cb5b0f75f/scratchpad/fit_rows.json', JSON.stringify(rows));

// корреляция × просадка: годовой перевес 2-й половины по признакам 1-й половины
console.log('\nкорреляция с BTC (1-я пол.) × длина истории → медиана 2-й половины, %/год (монет, половин в минусе)');
for (const [ca, cb, cn] of [[-1, 0.3, 'корр < 0,3'], [0.3, 0.5, '0,3–0,5'], [0.5, 2, '> 0,5']]) {
  const s = rows.filter((r) => r.F1.corr >= ca && r.F1.corr < cb);
  console.log(cn.padEnd(12), [[0, 600, 'история < 600 дн'], [600, 1e9, '≥ 600 дн']].map(([da, db, dn]) => { const q = s.filter((r) => r.n >= da && r.n < db); return `${dn}: ${med(q.map((r) => r.ah2)).toFixed(0)}% (${q.length}, ${q.filter((r) => r.h2 < 0).length})`; }).join(' | '));
}
